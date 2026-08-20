mod auto_install;
mod cloudflare;
mod notify;
mod secrets;
mod worker;

/// Relaybase console base URL. The desktop calls console.relaybase.xyz for
/// account/session, license, recovery, and CF OAuth (install-token) flows.
/// Override with the RELAYBASE_CONSOLE_URL env var for dev/staging.
fn console_base_url() -> String {
    std::env::var("RELAYBASE_CONSOLE_URL")
        .ok()
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| "https://console.relaybase.xyz".to_string())
}

use auto_install::{
    auto_install_worker, init_worker_db, merge_into_credentials, probe_install_resources,
    request_install_cancel, rollback_all_install, AutoInstallResult, InitDbResult, InstallDecision,
    InstallProbeResult,
};
use cloudflare::{list_zones, verify_token, ZoneSummary};
use secrets::{
    clear_credentials, clear_team_login, load_api_key_vault, load_cache_json as read_cache_json,
    load_credentials, load_email_prefs, load_mail_json as read_mail_json, load_team_login,
    migrate_mail_to_desktop_user, remove_api_key_vault_entry, save_cache_json as write_cache_json,
    save_credentials, save_email_prefs as write_email_prefs, save_mail_json as write_mail_json,
    save_team_login, upsert_api_key_vault_entry, ApiKeyVault, ApiKeyVaultEntry, EmailPrefs,
    StoredCredentials, TeamLogin,
};
use worker::{adopt_worker, install_worker, probe_install, update_worker, InstallResult, ProbeResult};

use std::sync::Mutex;
use uuid::Uuid;

use base64::Engine as _;
use sha2::{Digest, Sha256};

// In-flight CF OAuth data, minted in `start_cf_oauth` and consumed in
// `complete_cf_oauth`. The OAuth client is a PUBLIC PKCE client (no secret),
// so the desktop holds the `code_verifier` and exchanges the code itself.
// No Relaybase console session is required.
struct InFlightOauth {
    state: String,
    verifier: String,
    client_id: String,
    redirect_uri: String,
}
static CF_OAUTH_INFLIGHT: Mutex<Option<InFlightOauth>> = Mutex::new(None);

/// Loopback HTTP port the console callback page POSTs to. Works in `tauri
/// dev` (where `relaybase://` is often not registered with Launch Services)
/// and in production as a reliable fallback next to the custom-scheme link.
const OAUTH_LOOPBACK_PORT: u16 = 32831;

/// Random PKCE code_verifier (64 hex chars — valid: 43-128 unreserved chars).
fn new_pkce_verifier() -> String {
    let a = Uuid::new_v4().simple().to_string();
    let b = Uuid::new_v4().simple().to_string();
    format!("{a}{b}")
}

/// S256 code_challenge = base64url-no-pad(SHA-256(verifier)).
fn pkce_challenge(verifier: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(verifier.as_bytes());
    let digest = hasher.finalize();
    base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(digest)
}

#[tauri::command]
async fn save_cf_credentials(
    account_id: String,
    install_token: String,
    server_token: String,
) -> Result<StoredCredentials, String> {
    let mut creds = load_credentials()?.unwrap_or_default();
    creds.account_id = account_id.trim().to_string();
    // Merge semantics: an empty install_token means "leave the existing one
    // alone" (Settings only manages the server token; the install token is
    // persisted during install and reused for wrangler auth). Only overwrite
    // when a non-empty value is passed (install flow / explicit re-enter).
    let install_trimmed = install_token.trim();
    if !install_trimmed.is_empty() {
        creds.install_token = install_trimmed.to_string();
    }
    // Clearing the server token also clears the pushed-at timestamp so the
    // dashboard stops claiming "Pushed to Worker" after a wipe.
    if server_token.trim().is_empty() {
        creds.server_token.clear();
        creds.server_token_pushed_at.clear();
    } else {
        creds.server_token = server_token.trim().to_string();
    }
    save_credentials(&creds)?;
    Ok(creds)
}

#[tauri::command]
async fn get_credentials() -> Result<Option<StoredCredentials>, String> {
    load_credentials()
}

#[tauri::command]
async fn clear_stored_credentials() -> Result<(), String> {
    clear_credentials()
}

#[tauri::command]
async fn get_email_prefs() -> Result<Option<EmailPrefs>, String> {
    load_email_prefs()
}

#[tauri::command]
async fn save_email_prefs(prefs: EmailPrefs) -> Result<(), String> {
    write_email_prefs(&prefs)
}

#[tauri::command]
async fn get_api_key_vault() -> Result<ApiKeyVault, String> {
    load_api_key_vault()
}

#[tauri::command]
async fn save_api_key_vault_entry(entry: ApiKeyVaultEntry) -> Result<ApiKeyVault, String> {
    upsert_api_key_vault_entry(entry)
}

#[tauri::command]
async fn remove_api_key_vault_entry_cmd(id: String) -> Result<ApiKeyVault, String> {
    remove_api_key_vault_entry(id.trim())
}

#[tauri::command]
async fn migrate_mail_user_folder() -> Result<Option<String>, String> {
    migrate_mail_to_desktop_user()
}

#[tauri::command]
async fn get_mail_json(relative_path: String) -> Result<Option<serde_json::Value>, String> {
    read_mail_json(&relative_path)
}

#[tauri::command]
async fn save_mail_json(
    relative_path: String,
    value: serde_json::Value,
) -> Result<(), String> {
    write_mail_json(&relative_path, &value)
}

#[tauri::command]
async fn get_cache_json(relative_path: String) -> Result<Option<serde_json::Value>, String> {
    read_cache_json(&relative_path)
}

#[tauri::command]
async fn save_cache_json(
    relative_path: String,
    value: serde_json::Value,
) -> Result<(), String> {
    write_cache_json(&relative_path, &value)
}

#[tauri::command]
async fn verify_cf_token(
    account_id: String,
    api_token: String,
    scope: Option<String>,
) -> Result<cloudflare::TokenVerifyResult, String> {
    let s = scope.as_deref().unwrap_or("install");
    verify_token(account_id.trim(), api_token.trim(), s).await
}

#[tauri::command]
async fn list_cf_zones() -> Result<Vec<ZoneSummary>, String> {
    let install_token = refresh_install_token_if_needed().await?;
    let creds = load_credentials()?.ok_or("No credentials stored")?;
    let client = cloudflare::CfClient {
        account_id: creds.account_id,
        api_token: install_token,
    };
    list_zones(&client).await
}

#[tauri::command]
async fn probe_routing_worker() -> Result<ProbeResult, String> {
    let install_token = refresh_install_token_if_needed().await?;
    let creds = load_credentials()?.ok_or("Connect Cloudflare first")?;
    if creds.account_id.is_empty() || install_token.is_empty() {
        return Err("Connect Cloudflare first".into());
    }
    probe_install(&creds.account_id, &install_token).await
}

#[tauri::command]
async fn adopt_routing_worker() -> Result<InstallResult, String> {
    let install_token = refresh_install_token_if_needed().await?;
    let creds = load_credentials()?.ok_or("Connect Cloudflare first")?;
    let (result, next) = adopt_worker(&creds.account_id, &install_token, &creds).await?;
    save_credentials(&next)?;
    Ok(result)
}

#[tauri::command]
async fn install_routing_worker(worker_js: Option<String>) -> Result<InstallResult, String> {
    let install_token = refresh_install_token_if_needed().await?;
    let creds = load_credentials()?.ok_or("Connect Cloudflare first")?;
    let (result, next) =
        install_worker(&creds.account_id, &install_token, worker_js, &creds).await?;
    save_credentials(&next)?;
    Ok(result)
}

#[tauri::command]
async fn update_routing_worker(worker_js: Option<String>) -> Result<InstallResult, String> {
    let install_token = refresh_install_token_if_needed().await?;
    let creds = load_credentials()?.ok_or("Connect Cloudflare first")?;
    // update_worker reads creds.install_token internally; sync it first so a
    // freshly-refreshed OAuth token is used.
    let mut next = creds;
    next.install_token = install_token;
    let result = update_worker(&next, worker_js).await?;
    Ok(result)
}

#[tauri::command]
async fn save_license_key(license_key: String) -> Result<(), String> {
    let mut creds = load_credentials()?.unwrap_or_default();
    creds.license_key = license_key.trim().to_string();
    save_credentials(&creds)
}

#[tauri::command]
async fn save_relaybase_account(
    account_id: String,
    email: String,
    session: String,
    tier: Option<String>,
) -> Result<StoredCredentials, String> {
    let mut creds = load_credentials()?.unwrap_or_default();
    creds.relaybase_account_id = account_id.trim().to_string();
    creds.relaybase_email = email.trim().to_string();
    creds.relaybase_session = session.trim().to_string();
    creds.relaybase_tier = tier.unwrap_or_default().trim().to_string();
    save_credentials(&creds)?;
    Ok(creds)
}

#[tauri::command]
async fn clear_relaybase_account() -> Result<StoredCredentials, String> {
    let mut creds = load_credentials()?.unwrap_or_default();
    creds.relaybase_account_id.clear();
    creds.relaybase_email.clear();
    creds.relaybase_session.clear();
    creds.relaybase_tier.clear();
    save_credentials(&creds)?;
    Ok(creds)
}

#[tauri::command]
async fn get_team_login() -> Result<Option<TeamLogin>, String> {
    load_team_login()
}

#[tauri::command]
async fn save_team_login_cmd(
    worker_url: String,
    account_email: String,
    mobile_password: String,
) -> Result<TeamLogin, String> {
    let login = TeamLogin {
        worker_url: worker_url.trim().trim_end_matches('/').to_string(),
        account_email: account_email.trim().to_lowercase(),
        mobile_password: mobile_password,
    };
    save_team_login(&login)?;
    Ok(login)
}

#[tauri::command]
async fn clear_team_login_cmd() -> Result<(), String> {
    clear_team_login()
}

/// List Relaybase Worker / R2 / D1 resources already in the Cloudflare account.
#[tauri::command]
async fn probe_auto_install(
    _api_token: String,
    account_id: Option<String>,
) -> Result<InstallProbeResult, String> {
    let token = refresh_install_token_if_needed().await?;
    probe_install_resources(token, account_id).await
}

#[tauri::command]
async fn auto_install_routing_worker(
    app: tauri::AppHandle,
    _api_token: String,
    account_id: Option<String>,
    server_token: Option<String>,
    decisions: Option<Vec<InstallDecision>>,
) -> Result<AutoInstallResult, String> {
    let server = server_token
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty());
    let token = refresh_install_token_if_needed().await?;
    let result = auto_install_worker(
        app,
        token.clone(),
        account_id.clone(),
        server.clone(),
        decisions.unwrap_or_default(),
    )
    .await?;
    let existing = load_credentials()?.unwrap_or_default();
    let mut next = merge_into_credentials(&existing, &result, account_id);
    // Persist the install token used so later update_worker / push_server_token
    // can re-auth wrangler without re-entering it.
    next.install_token = token;
    // If a server token was supplied and pushed, record the pushed-at time.
    if let Some(srv) = server {
        next.server_token = srv;
        next.server_token_pushed_at = auto_install::now_iso();
    }
    save_credentials(&next)?;
    Ok(result)
}

/// Stop an in-flight auto-install. Does not delete Cloudflare resources —
/// the UI offers a separate Rollback action after stop/error/complete.
#[tauri::command]
fn cancel_auto_install() {
    request_install_cancel();
}

/// Delete every Relaybase Worker / D1 / R2 resource in the connected account.
#[tauri::command]
async fn rollback_auto_install(
    app: tauri::AppHandle,
    api_token: String,
    account_id: Option<String>,
) -> Result<(), String> {
    rollback_all_install(app, api_token, account_id).await?;
    if let Ok(Some(mut creds)) = load_credentials() {
        creds.worker_url.clear();
        creds.admin_token.clear();
        creds.worker_script_name.clear();
        let _ = save_credentials(&creds);
    }
    Ok(())
}

/// Call the deployed Worker's POST /console/init-db to initialize or clear D1.
/// Used by the UI after install when the DB was already initialized — the user
/// decides whether to clear existing data, and that decision goes through the
/// Worker endpoint, not direct D1 access.
#[tauri::command]
async fn init_worker_db_cmd(
    worker_url: String,
    admin_token: String,
    clear: bool,
) -> Result<InitDbResult, String> {
    init_worker_db(&worker_url, &admin_token, clear).await
}

/// Push the saved server token (Email Sending Edit) to the deployed Worker as
/// the `CF_API_TOKEN` wrangler secret, using the install token for wrangler
/// auth. Requires wrangler available locally (same as auto-install). The
/// install token is transparently refreshed via CF OAuth (through the
/// console) if it is short-lived and expiring.
#[tauri::command]
async fn push_server_token() -> Result<serde_json::Value, String> {
    // Refresh first so a fresh OAuth access token is used for wrangler auth.
    let install_token = refresh_install_token_if_needed().await?;
    let creds = load_credentials()?.ok_or("Connect Cloudflare first")?;
    if creds.account_id.is_empty() || install_token.is_empty() {
        return Err("Install token (Workers Scripts Edit) is required to push the server token".into());
    }
    if creds.server_token.is_empty() {
        return Err("No server token saved. Add an Email Sending Edit token in Settings first.".into());
    }
    if creds.worker_script_name.is_empty() {
        return Err("No deployed Worker found. Install the routing Worker first.".into());
    }

    let pushed_at = auto_install::push_cf_api_token_secret(
        &creds.worker_script_name,
        &install_token,
        &creds.server_token,
    )
    .await?;

    // Persist the pushed-at timestamp so the dashboard can show "Pushed".
    let mut next = creds;
    next.server_token_pushed_at = pushed_at.clone();
    save_credentials(&next)?;

    Ok(serde_json::json!({ "ok": true, "message": "Server token pushed to Worker as CF_API_TOKEN.", "pushedAt": pushed_at }))
}

// --- Cloudflare OAuth (install token) ---
//
// The install token (Workers Scripts / KV / R2 Edit) is now obtained via a
// Cloudflare OAuth authorization-code + refresh flow. console.relaybase.xyz
// is the confidential callback (holds the client secret). The desktop stores
// the short-lived access token + the refresh token in ~/.relaybase and
// proxies refreshes through the console. `install_token` is kept in sync
// with the OAuth access token so existing wrangler/CF-API call sites work
// unchanged. Legacy manual install tokens still work — when no OAuth refresh
// token is present, refresh is a no-op.

#[derive(Debug, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct OAuthStartResult {
    authorize_url: String,
    state: String,
}

/// Begin the CF OAuth flow. Fetches the public OAuth client config
/// (clientId, redirectUri, scopes) from the console — no Relaybase session
/// required — mints a `state`, builds the Cloudflare authorize URL, and
/// remembers the state for CSRF verification in `complete_cf_oauth`.
#[tauri::command]
async fn start_cf_oauth() -> Result<OAuthStartResult, String> {
    let url = format!(
        "{}/api/v1/oauth/config",
        console_base_url().trim_end_matches('/')
    );
    let http = reqwest::Client::new();
    let res = http
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Could not reach Relaybase console: {e}"))?;
    let status = res.status();
    let body = res.text().await.unwrap_or_default();
    if !status.is_success() {
        return Err(format!("Console rejected OAuth config (HTTP {status}): {body}"));
    }
    let value: serde_json::Value = serde_json::from_str(&body)
        .map_err(|_| "Console returned a non-JSON OAuth config response".to_string())?;
    let client_id = value
        .get("clientId")
        .and_then(|v| v.as_str())
        .ok_or("Console did not return a clientId")?
        .to_string();
    let redirect_uri = value
        .get("redirectUri")
        .and_then(|v| v.as_str())
        .ok_or("Console did not return a redirectUri")?
        .to_string();
    let scopes = value
        .get("scopes")
        .and_then(|v| v.as_str())
        .unwrap_or("d1.write secrets-store.write workers-r2.write workers-scripts.write")
        .to_string();

    let state = Uuid::new_v4().to_string();
    let verifier = new_pkce_verifier();
    let challenge = pkce_challenge(&verifier);
    if let Ok(mut guard) = CF_OAUTH_INFLIGHT.lock() {
        *guard = Some(InFlightOauth {
            state: state.clone(),
            verifier,
            client_id: client_id.clone(),
            redirect_uri: redirect_uri.clone(),
        });
    }

    let mut authorize_url = url::Url::parse("https://dash.cloudflare.com/oauth2/auth")
        .map_err(|e| format!("Bad authorize URL: {e}"))?;
    authorize_url
        .query_pairs_mut()
        .append_pair("response_type", "code")
        .append_pair("client_id", &client_id)
        .append_pair("redirect_uri", &redirect_uri)
        .append_pair("scope", &scopes)
        .append_pair("state", &state)
        .append_pair("code_challenge", &challenge)
        .append_pair("code_challenge_method", "S256");

    Ok(OAuthStartResult {
        authorize_url: authorize_url.to_string(),
        state,
    })
}

/// Complete the CF OAuth flow from the `relaybase://oauth/callback` deep
/// link or the localhost loopback. The console relays `code` + `state` to
/// the desktop (public PKCE client — no secret). We verify `state` matches
/// the in-flight flow (CSRF), then exchange `code` + our PKCE `code_verifier`
/// directly with Cloudflare and persist the tokens to ~/.relaybase.
#[tauri::command]
async fn complete_cf_oauth(
    state: String,
    code: String,
) -> Result<StoredCredentials, String> {
    complete_cf_oauth_inner(state, code).await
}

async fn complete_cf_oauth_inner(
    state: String,
    code: String,
) -> Result<StoredCredentials, String> {
    // CSRF + retrieve the PKCE verifier + client config for this flow.
    let inflight = {
        match CF_OAUTH_INFLIGHT.lock() {
            Ok(mut guard) => guard.take(),
            Err(_) => return Err("OAuth state store poisoned.".into()),
        }
    };
    let inflight = match inflight {
        Some(f) if f.state == state => f,
        Some(f) => {
            // Put it back so a racing second delivery (deep-link + loopback)
            // can still complete.
            if let Ok(mut guard) = CF_OAUTH_INFLIGHT.lock() {
                *guard = Some(f);
            }
            return Err(
                "OAuth state does not match the flow you started. Try again.".into(),
            );
        }
        None => {
            return Err(
                "OAuth state does not match the flow you started. Try again.".into(),
            );
        }
    };
    if code.is_empty() {
        // Restore so the user can retry.
        if let Ok(mut guard) = CF_OAUTH_INFLIGHT.lock() {
            *guard = Some(inflight);
        }
        return Err("OAuth callback is missing an authorization code.".into());
    }

    // Exchange code + verifier directly with Cloudflare (public PKCE client,
    // no client_secret).
    let http = reqwest::Client::new();
    let token_body = url::form_urlencoded::Serializer::new(String::new())
        .append_pair("grant_type", "authorization_code")
        .append_pair("code", &code)
        .append_pair("redirect_uri", &inflight.redirect_uri)
        .append_pair("client_id", &inflight.client_id)
        .append_pair("code_verifier", &inflight.verifier)
        .finish();
    let token_res = http
        .post("https://dash.cloudflare.com/oauth2/token")
        .header("Content-Type", "application/x-www-form-urlencoded")
        .body(token_body)
        .send()
        .await
        .map_err(|e| format!("Token exchange request failed: {e}"))?;
    let status = token_res.status();
    let body = token_res.text().await.unwrap_or_default();
    if !status.is_success() {
        return Err(format!("Token exchange failed (HTTP {status}): {body}"));
    }
    let tokens: serde_json::Value = serde_json::from_str(&body)
        .map_err(|_| "Token endpoint returned a non-JSON response".to_string())?;
    let access_token = tokens
        .get("access_token")
        .and_then(|v| v.as_str())
        .ok_or("Token endpoint did not return an access_token")?
        .to_string();
    // Refresh token is issued only when the authorize request included
    // `offline_access` AND the OAuth client has the refresh_token grant.
    // Missing it is not fatal — the access token still connects the account.
    let refresh_token = tokens
        .get("refresh_token")
        .and_then(|v| v.as_str())
        .or_else(|| tokens.get("refreshToken").and_then(|v| v.as_str()))
        .unwrap_or("")
        .to_string();
    if refresh_token.is_empty() {
        log::warn!("CF OAuth token response had no refresh_token; access token still saved");
    }
    let expires_in = tokens
        .get("expires_in")
        .and_then(|v| v.as_u64())
        .unwrap_or(3600);
    let account_id = tokens
        .get("account_id")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let expires_at = new_iso_expires(expires_in);

    let mut creds = load_credentials()?.unwrap_or_default();
    creds.cf_oauth_access_token = access_token.clone();
    creds.cf_oauth_refresh_token = refresh_token;
    creds.cf_oauth_access_expires_at = expires_at;
    if let Some(acct) = account_id {
        let acct = acct.trim();
        if !acct.is_empty() {
            creds.cf_oauth_account_id = acct.to_string();
            creds.account_id = acct.to_string();
        }
    }
    // Keep install_token in sync so existing wrangler/CF-API call sites work.
    creds.install_token = access_token;
    save_credentials(&creds)?;
    Ok(creds)
}

fn parse_oauth_callback_url(raw: &str) -> Option<(String, String)> {
    let url = url::Url::parse(raw).ok()?;
    let is_scheme = url.scheme() == "relaybase"
        && url.host_str() == Some("oauth")
        && url.path() == "/callback";
    let is_loopback = (url.scheme() == "http" || url.scheme() == "https")
        && matches!(url.host_str(), Some("127.0.0.1") | Some("localhost"))
        && url.path() == "/oauth/callback";
    if !is_scheme && !is_loopback {
        return None;
    }
    let state = url.query_pairs().find(|(k, _)| k == "state")?.1.into_owned();
    let code = url.query_pairs().find(|(k, _)| k == "code")?.1.into_owned();
    if state.is_empty() || code.is_empty() {
        return None;
    }
    Some((state, code))
}

fn emit_oauth_result<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    result: Result<StoredCredentials, String>,
) {
    use tauri::Emitter;
    match result {
        Ok(_) => {
            let _ = app.emit("cf-oauth-complete", serde_json::json!({ "ok": true }));
        }
        Err(e) => {
            let _ = app.emit(
                "cf-oauth-error",
                serde_json::json!({ "ok": false, "error": e }),
            );
        }
    }
}

/// Accept `GET /oauth/callback?code=&state=` from the console callback page
/// (browser on this machine). CORS-open so https://console.relaybase.xyz can
/// fetch it. Bound to 127.0.0.1 only.
async fn run_oauth_loopback_server<R: tauri::Runtime>(app: tauri::AppHandle<R>) {
    let addr = format!("127.0.0.1:{OAUTH_LOOPBACK_PORT}");
    let listener = match tokio::net::TcpListener::bind(&addr).await {
        Ok(l) => l,
        Err(e) => {
            log::warn!("OAuth loopback listen failed on {addr}: {e}");
            return;
        }
    };
    log::info!("OAuth loopback listening on http://{addr}/oauth/callback");
    loop {
        let (mut socket, _) = match listener.accept().await {
            Ok(s) => s,
            Err(_) => continue,
        };
        let app = app.clone();
        tauri::async_runtime::spawn(async move {
            use tokio::io::{AsyncReadExt, AsyncWriteExt};
            let mut buf = vec![0u8; 4096];
            let n = match socket.read(&mut buf).await {
                Ok(n) if n > 0 => n,
                _ => return,
            };
            let req = String::from_utf8_lossy(&buf[..n]);
            let first = req.lines().next().unwrap_or("");
            let is_options = first.starts_with("OPTIONS ");
            let path = first.split_whitespace().nth(1).unwrap_or("");
            let full = format!("http://127.0.0.1:{OAUTH_LOOPBACK_PORT}{path}");
            let cors = "Access-Control-Allow-Origin: *\r\nAccess-Control-Allow-Methods: GET, OPTIONS\r\nAccess-Control-Allow-Headers: *\r\n";
            if is_options {
                let _ = socket
                    .write_all(
                        format!("HTTP/1.1 204 No Content\r\n{cors}Connection: close\r\n\r\n")
                            .as_bytes(),
                    )
                    .await;
                return;
            }
            if let Some((state, code)) = parse_oauth_callback_url(&full) {
                let result = complete_cf_oauth_inner(state, code).await;
                let ok = result.is_ok();
                emit_oauth_result(&app, result);
                let status = if ok { "200 OK" } else { "400 Bad Request" };
                let body = if ok { "ok" } else { "error" };
                let _ = socket
                    .write_all(
                        format!(
                            "HTTP/1.1 {status}\r\n{cors}Content-Type: text/plain\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
                            body.len()
                        )
                        .as_bytes(),
                    )
                    .await;
            } else {
                let body = "not found";
                let _ = socket
                    .write_all(
                        format!(
                            "HTTP/1.1 404 Not Found\r\n{cors}Content-Type: text/plain\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
                            body.len()
                        )
                        .as_bytes(),
                    )
                    .await;
            }
        });
    }
}

/// ISO-8601 timestamp `expires_in` seconds from now.
fn new_iso_expires(expires_in: u64) -> String {
    let secs = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
        .saturating_add(expires_in);
    // Format as YYYY-MM-DDTHH:MM:SSZ (UTC). Simple manual formatting to avoid
    // pulling a datetime crate.
    let days = secs / 86400;
    let rem = secs % 86400;
    let h = rem / 3600;
    let m = (rem % 3600) / 60;
    let s = rem % 60;
    let (y, mo, dd) = days_to_ymd(days as i64);
    format!("{y:04}-{mo:02}-{dd:02}T{h:02}:{m:02}:{s:02}Z")
}

/// Convert days-since-epoch (1970-01-01) to (year, month, day). Civil-from-days
/// algorithm (Howard Hinnant). Returns 1-indexed month/day.
fn days_to_ymd(days: i64) -> (i64, i64, i64) {
    let z = days + 719468;
    let era = if z >= 0 { z } else { z - 146096 } / 146097;
    let doe = z - era * 146097;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = if m <= 2 { y + 1 } else { y };
    (y, m, d)
}

/// Ensure a fresh CF OAuth access token before any wrangler/CF-API call.
/// No-op when there is no OAuth refresh token (legacy manual install token
/// still in use). Refreshes directly with Cloudflare (public PKCE client —
/// no client secret; only `client_id` + `refresh_token` are needed) when the
/// access token is missing or expiring within 60s. Persists the refreshed
/// tokens and keeps `install_token` in sync. Returns the current install
/// token (fresh if refreshed).
pub const CLOUDFLARE_AUTH_EXPIRED: &str = "CLOUDFLARE_AUTH_EXPIRED";

async fn refresh_install_token_if_needed() -> Result<String, String> {
    let creds = load_credentials()?.unwrap_or_default();
    // Legacy manual install token path: nothing to refresh.
    if creds.cf_oauth_refresh_token.trim().is_empty() {
        if oauth_access_expired(&creds) {
            return Err(
                format!(
                    "{CLOUDFLARE_AUTH_EXPIRED}: Cloudflare authorization expired. \
                     Go back and Authorize again."
                ),
            );
        }
        return Ok(creds.install_token);
    }
    let now_secs = now_unix_secs();
    let expires_at_secs = parse_iso_to_secs(&creds.cf_oauth_access_expires_at);
    let fresh = creds
        .cf_oauth_access_expires_at
        .is_empty()
        || expires_at_secs.saturating_sub(now_secs) < 60;
    if !fresh {
        return Ok(creds.install_token);
    }

    // Public PKCE client: refresh needs only client_id (no secret). Fetch it
    // from the console's public /config endpoint.
    let client_id = fetch_oauth_client_id().await?;
    let http = reqwest::Client::new();
    let refresh_body = url::form_urlencoded::Serializer::new(String::new())
        .append_pair("grant_type", "refresh_token")
        .append_pair("refresh_token", &creds.cf_oauth_refresh_token)
        .append_pair("client_id", &client_id)
        .finish();
    let res = http
        .post("https://dash.cloudflare.com/oauth2/token")
        .header("Content-Type", "application/x-www-form-urlencoded")
        .body(refresh_body)
        .send()
        .await
        .map_err(|e| format!("Token refresh request failed: {e}"))?;
    let status = res.status();
    let body = res.text().await.unwrap_or_default();
    if !status.is_success() {
        let lower = body.to_lowercase();
        if status.as_u16() == 400 || lower.contains("invalid_grant") || lower.contains("invalid") {
            return Err(format!(
                "{CLOUDFLARE_AUTH_EXPIRED}: Cloudflare authorization expired. \
                 Go back and Authorize again."
            ));
        }
        return Err(format!("Token refresh failed (HTTP {status}): {body}"));
    }
    let tokens: serde_json::Value = serde_json::from_str(&body)
        .map_err(|_| "Token endpoint returned a non-JSON refresh response".to_string())?;
    let access_token = tokens
        .get("access_token")
        .and_then(|v| v.as_str())
        .ok_or("Token refresh did not return an access_token")?
        .to_string();
    let expires_in = tokens.get("expires_in").and_then(|v| v.as_u64()).unwrap_or(3600);
    let next_refresh = tokens
        .get("refresh_token")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .unwrap_or_else(|| creds.cf_oauth_refresh_token.clone());

    let mut next = creds;
    next.cf_oauth_access_token = access_token.clone();
    next.cf_oauth_refresh_token = next_refresh;
    next.cf_oauth_access_expires_at = new_iso_expires(expires_in);
    next.install_token = access_token.clone();
    save_credentials(&next)?;
    Ok(access_token)
}

/// Fetch the public OAuth client_id from the console's /config endpoint.
async fn fetch_oauth_client_id() -> Result<String, String> {
    let url = format!(
        "{}/api/v1/oauth/config",
        console_base_url().trim_end_matches('/')
    );
    let res = reqwest::Client::new()
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Could not reach Relaybase console for OAuth config: {e}"))?;
    let status = res.status();
    let body = res.text().await.unwrap_or_default();
    if !status.is_success() {
        return Err(format!("Console rejected OAuth config (HTTP {status}): {body}"));
    }
    let value: serde_json::Value = serde_json::from_str(&body)
        .map_err(|_| "Console returned a non-JSON OAuth config response".to_string())?;
    value
        .get("clientId")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .ok_or_else(|| "Console did not return a clientId".to_string())
}

/// Force a refresh of the CF OAuth access token (or no-op for legacy manual
/// install tokens). Returns the updated credentials. The Rust side also
/// refreshes automatically before wrangler/CF-API calls, so this is mainly
/// for the UI to update the "expires in" display on demand.
#[tauri::command]
async fn refresh_install_token() -> Result<StoredCredentials, String> {
    refresh_install_token_if_needed().await?;
    load_credentials()?.ok_or_else(|| "No credentials stored".to_string())
}

fn now_unix_secs() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

fn oauth_access_expired(creds: &StoredCredentials) -> bool {
    if creds.cf_oauth_access_expires_at.trim().is_empty() {
        return false;
    }
    parse_iso_to_secs(&creds.cf_oauth_access_expires_at) < now_unix_secs().saturating_add(60)
}

/// Best-effort ISO-8601 → unix seconds. Returns 0 on parse failure (which
/// forces a refresh, which is the safe fallback).
fn parse_iso_to_secs(iso: &str) -> u64 {
    if iso.is_empty() {
        return 0;
    }
    // Accept "YYYY-MM-DDTHH:MM:SS(.sss)Z" — parse the fixed fields.
    let bytes = iso.as_bytes();
    if bytes.len() < 19 {
        return 0;
    }
    let to_i = |a: usize, b: usize| -> Option<u64> {
        std::str::from_utf8(&bytes[a..b]).ok().and_then(|s| s.parse::<u64>().ok())
    };
    let y = match to_i(0, 4) {
        Some(v) => v,
        None => return 0,
    };
    let mo = match to_i(5, 7) {
        Some(v) => v,
        None => return 0,
    };
    let d = match to_i(8, 10) {
        Some(v) => v,
        None => return 0,
    };
    let h = match to_i(11, 13) {
        Some(v) => v,
        None => return 0,
    };
    let mi = match to_i(14, 16) {
        Some(v) => v,
        None => return 0,
    };
    let s = match to_i(17, 19) {
        Some(v) => v,
        None => return 0,
    };
    if y < 1970 || mo == 0 || mo > 12 || d == 0 || d > 31 || h > 23 || mi > 59 || s > 59 {
        return 0;
    }
    let days = days_from_civil(y as i64, mo as i64, d as i64);
    (days as u64) * 86_400 + h * 3600 + mi * 60 + s
}

/// Howard Hinnant's days_from_civil — converts a Gregorian date to days
/// since 1970-01-01 (unix epoch). Returns a signed count.
fn days_from_civil(y: i64, m: i64, d: i64) -> i64 {
    let y = if m <= 2 { y - 1 } else { y };
    let era = if y >= 0 { y } else { y - 399 } / 400;
    let yoe = (y - era * 400) as i64;
    let doy = (153 * (if m > 2 { m - 3 } else { m + 9 }) + 2) / 5 + d - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    era * 146097 + doe - 719468
}

#[derive(Debug, serde::Serialize, serde::Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct D1BindingSnapshot {
    configured: bool,
    database_name: String,
    binding: String,
    size_bytes: Option<u64>,
}

impl Default for D1BindingSnapshot {
    fn default() -> Self {
        Self {
            configured: false,
            database_name: String::new(),
            binding: String::new(),
            size_bytes: None,
        }
    }
}

fn default_d1_logs() -> D1BindingSnapshot {
    D1BindingSnapshot {
        configured: false,
        database_name: "relaybase-logs".into(),
        binding: "RELAYBASE_LOGS".into(),
        size_bytes: None,
    }
}

fn default_d1_inbox_index() -> D1BindingSnapshot {
    D1BindingSnapshot {
        configured: false,
        database_name: "relaybase-inbox-index".into(),
        binding: "RELAYBASE_INBOX_INDEX".into(),
        size_bytes: None,
    }
}

fn default_d1_app() -> D1BindingSnapshot {
    D1BindingSnapshot {
        configured: false,
        database_name: "relaybase-db".into(),
        binding: "RELAYBASE_DB".into(),
        size_bytes: None,
    }
}

fn parse_d1_binding(value: &serde_json::Value, kind: &str) -> D1BindingSnapshot {
    let defaults = match kind {
        "logs" => default_d1_logs(),
        "inboxIndex" => default_d1_inbox_index(),
        _ => default_d1_app(),
    };
    let Some(d1) = value.get("d1") else {
        return defaults;
    };

    if let Some(nested) = d1.get(kind) {
        return D1BindingSnapshot {
            configured: nested
                .get("configured")
                .and_then(|v| v.as_bool())
                .unwrap_or(false),
            database_name: nested
                .get("databaseName")
                .and_then(|v| v.as_str())
                .unwrap_or(defaults.database_name.as_str())
                .into(),
            binding: nested
                .get("binding")
                .and_then(|v| v.as_str())
                .unwrap_or(defaults.binding.as_str())
                .into(),
            size_bytes: nested.get("sizeBytes").and_then(|v| v.as_u64()),
        };
    }

    if kind == "logs" {
        D1BindingSnapshot {
            configured: d1
                .get("logsConfigured")
                .and_then(|v| v.as_bool())
                .unwrap_or(false),
            database_name: d1
                .get("logsDatabaseName")
                .and_then(|v| v.as_str())
                .unwrap_or("relaybase-logs")
                .into(),
            binding: "RELAYBASE_LOGS".into(),
            size_bytes: None,
        }
    } else {
        D1BindingSnapshot {
            configured: d1
                .get("inboxIndexConfigured")
                .and_then(|v| v.as_bool())
                .unwrap_or(false),
            database_name: d1
                .get("inboxIndexDatabaseName")
                .and_then(|v| v.as_str())
                .unwrap_or("relaybase-inbox-index")
                .into(),
            binding: "RELAYBASE_INBOX_INDEX".into(),
            size_bytes: None,
        }
    }
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct WorkerConnectResult {
    ok: bool,
    product: String,
    worker_script_name: String,
    worker_url: String,
    r2_configured: bool,
    inbound_bucket_name: String,
    /// Sum of object sizes in the inbound R2 bucket (bytes). None if unknown.
    r2_total_bytes: Option<u64>,
    r2_object_count: Option<u64>,
    /// True when the Worker stopped scanning early (large bucket).
    r2_usage_truncated: Option<bool>,
    /// True when the Worker has a CF_API_TOKEN wrangler secret set.
    cf_api_token_set: bool,
    d1_logs: D1BindingSnapshot,
    d1_inbox_index: D1BindingSnapshot,
    d1_app: D1BindingSnapshot,
}

fn normalize_worker_url(raw: &str) -> Result<String, String> {
    let trimmed = raw.trim().trim_end_matches('/');
    if trimmed.is_empty() {
        return Err("Worker URL is required".into());
    }
    let with_scheme = if trimmed.starts_with("https://") || trimmed.starts_with("http://") {
        trimmed.to_string()
    } else {
        format!("https://{trimmed}")
    };
    let url = reqwest::Url::parse(&with_scheme).map_err(|_| {
        "Worker URL looks invalid. Use https://relaybase-api.<subdomain>.workers.dev".to_string()
    })?;
    if url.scheme() != "https" && url.scheme() != "http" {
        return Err("Worker URL must be http(s)".into());
    }
    Ok(with_scheme.trim_end_matches('/').to_string())
}

async fn probe_d1_when_connect_omits(
    http: &reqwest::Client,
    base: &str,
    token: &str,
) -> (bool, bool) {
    let auth = format!("Bearer {token}");
    let mut logs_configured = false;
    let mut inbox_configured = false;

    if let Ok(res) = http
        .get(format!("{base}/health"))
        .send()
        .await
    {
        if res.status().is_success() {
            if let Ok(json) = res.json::<serde_json::Value>().await {
                if json.get("d1").is_some() {
                    logs_configured = json
                        .pointer("/d1/logsConfigured")
                        .and_then(|v| v.as_bool())
                        .unwrap_or(false);
                    inbox_configured = json
                        .pointer("/d1/inboxIndexConfigured")
                        .and_then(|v| v.as_bool())
                        .unwrap_or(false);
                    return (logs_configured, inbox_configured);
                }
            }
        }
    }

    if let Ok(res) = http
        .get(format!("{base}/console/ops-logs?limit=1"))
        .header("Authorization", &auth)
        .send()
        .await
    {
        if res.status().is_success() {
            if let Ok(json) = res.json::<serde_json::Value>().await {
                if let Some(v) = json.get("d1Configured").and_then(|v| v.as_bool()) {
                    logs_configured = v;
                } else if json
                    .pointer("/summary/total")
                    .and_then(|v| v.as_u64())
                    .unwrap_or(0)
                    > 0
                {
                    logs_configured = true;
                }
            }
        }
    }

    if let Ok(res) = http
        .get(format!("{base}/console/domains"))
        .header("Authorization", &auth)
        .send()
        .await
    {
        if res.status().is_success() {
            if let Ok(json) = res.json::<serde_json::Value>().await {
                let domain = json.get("domains").and_then(|domains| {
                    domains.as_array().and_then(|entries| {
                        entries.iter().find_map(|entry| {
                            entry
                                .get("domain")
                                .and_then(|v| v.as_str())
                                .map(str::trim)
                                .filter(|s| !s.is_empty())
                                .map(|s| s.to_string())
                        })
                    })
                });
                if let Some(domain) = domain {
                    if let Ok(search) = http
                        .get(format!(
                            "{base}/mail/inbox/search?domain={domain}&q=te&limit=1"
                        ))
                        .header("Authorization", &auth)
                        .send()
                        .await
                    {
                        inbox_configured = search.status().as_u16() != 503;
                    }
                }
            }
        }
    }

    (logs_configured, inbox_configured)
}

/// Verify user-deployed Worker via GET /console/connect (admin Bearer).
#[tauri::command]
async fn verify_worker_connection(
    worker_url: String,
    admin_token: String,
) -> Result<WorkerConnectResult, String> {
    let base = normalize_worker_url(&worker_url)?;
    let token = admin_token.trim();
    if token.is_empty() {
        return Err("Admin token is required (same value as wrangler secret ADMIN_TOKEN)".into());
    }

    let url = format!("{base}/console/connect");
    let http = reqwest::Client::new();
    let res = http
        .get(&url)
        .header("Authorization", format!("Bearer {token}"))
        .send()
        .await
        .map_err(|e| format!("Could not reach Worker ({e}). Check the URL and your network."))?;

    let status = res.status();
    let body = res.text().await.unwrap_or_default();
    if status.as_u16() == 401 || status.as_u16() == 403 {
        return Err(
            "Admin token was rejected by the Worker. Use the same value you set with `wrangler secret put ADMIN_TOKEN`."
                .into(),
        );
    }
    if !status.is_success() {
        return Err(format!(
            "Worker connect check failed (HTTP {}). Is this a Relaybase Worker URL?",
            status.as_u16()
        ));
    }

    let value: serde_json::Value =
        serde_json::from_str(&body).map_err(|_| {
            "Worker responded, but not with a Relaybase connect payload. Confirm you deployed the install package.".to_string()
        })?;

    if value.get("ok") != Some(&serde_json::Value::Bool(true))
        || value.get("product").and_then(|v| v.as_str()) != Some("relaybase")
    {
        return Err(
            "This URL is reachable but does not look like a Relaybase Worker. Redeploy the install package."
                .into(),
        );
    }

    let usage = value.pointer("/inbound/usage");
    let mut d1_logs = parse_d1_binding(&value, "logs");
    let mut d1_inbox_index = parse_d1_binding(&value, "inboxIndex");
    let d1_app = parse_d1_binding(&value, "app");

    if value.get("d1").is_none()
        && !d1_logs.configured
        && !d1_inbox_index.configured
    {
        let (logs, inbox) = probe_d1_when_connect_omits(&http, &base, token).await;
        d1_logs.configured = logs;
        d1_inbox_index.configured = inbox;
    }

    Ok(WorkerConnectResult {
        ok: true,
        product: "relaybase".into(),
        worker_script_name: value
            .get("workerScriptName")
            .and_then(|v| v.as_str())
            .unwrap_or("relaybase-api")
            .into(),
        worker_url: base,
        r2_configured: value
            .pointer("/inbound/r2Configured")
            .and_then(|v| v.as_bool())
            .unwrap_or(false),
        inbound_bucket_name: value
            .pointer("/inbound/bucketName")
            .and_then(|v| v.as_str())
            .unwrap_or("relaybase-mailbox")
            .into(),
        r2_total_bytes: usage
            .and_then(|u| u.get("totalBytes"))
            .and_then(|v| v.as_u64()),
        r2_object_count: usage
            .and_then(|u| u.get("objectCount"))
            .and_then(|v| v.as_u64()),
        r2_usage_truncated: usage
            .and_then(|u| u.get("truncated"))
            .and_then(|v| v.as_bool()),
        cf_api_token_set: value
            .get("cfApiTokenSet")
            .and_then(|v| v.as_bool())
            .unwrap_or(false),
        d1_logs,
        d1_inbox_index,
        d1_app,
    })
}

#[tauri::command]
async fn save_worker_connection(
    worker_url: String,
    admin_token: String,
    worker_script_name: Option<String>,
) -> Result<StoredCredentials, String> {
    let base = normalize_worker_url(&worker_url)?;
    let token = admin_token.trim();
    if token.is_empty() {
        return Err("Admin token is required".into());
    }
    // Prefer merging into existing creds, but never block a successful verify
    // on a legacy/unreadable credentials.json — overwrite with what we know.
    let mut creds = match load_credentials() {
        Ok(existing) => existing.unwrap_or_default(),
        Err(e) => {
            log::warn!("load_credentials failed during save_worker_connection: {e}");
            StoredCredentials::default()
        }
    };
    creds.worker_url = base;
    creds.admin_token = token.to_string();
    creds.worker_script_name = worker_script_name
        .unwrap_or_default()
        .trim()
        .to_string();
    if creds.worker_script_name.is_empty() {
        creds.worker_script_name = "relaybase-api".into();
    }
    save_credentials(&creds)?;
    Ok(creds)
}

#[tauri::command]
async fn get_desktop_info() -> Result<serde_json::Value, String> {
    Ok(serde_json::json!({
        "isDesktop": true,
        "product": "Relaybase",
        "version": env!("CARGO_PKG_VERSION"),
    }))
}

/// Open an http(s) URL in the system browser. Used both by the
/// `open_external_url` IPC command and the webview `on_new_window` handler
/// (email `<a target="_blank">` links must not open an in-app window).
fn open_url_in_os_browser(url: &str) -> Result<(), String> {
    let url = url.trim();
    if !(url.starts_with("https://") || url.starts_with("http://")) {
        return Err("Only http(s) URLs can be opened".into());
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(url)
            .spawn()
            .map_err(|e| format!("Failed to open browser: {e}"))?;
        return Ok(());
    }
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/C", "start", "", url])
            .spawn()
            .map_err(|e| format!("Failed to open browser: {e}"))?;
        return Ok(());
    }
    #[cfg(all(unix, not(target_os = "macos")))]
    {
        std::process::Command::new("xdg-open")
            .arg(url)
            .spawn()
            .map_err(|e| format!("Failed to open browser: {e}"))?;
        return Ok(());
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows", unix)))]
    {
        let _ = url;
        Err("Opening external URLs is not supported on this platform".into())
    }
}

/// Open https links in the system browser (webview <a target=_blank> is blocked).
#[tauri::command]
async fn open_external_url(url: String) -> Result<(), String> {
    open_url_in_os_browser(&url)
}

/// Open an attachment with the OS default application. The frontend base64-encodes
/// the attachment bytes (already fetched via the authenticated blob URL) and
/// passes them here; we decode, write a temp file with the original extension,
/// and hand it to the OS opener so Preview / Acrobat / Photos opens it directly.
#[tauri::command]
async fn open_local_file_with_default_app(name: String, base64_data: String) -> Result<(), String> {
    use base64::Engine as _;
    let bytes = base64::prelude::BASE64_STANDARD
        .decode(base64_data.as_bytes())
        .map_err(|e| format!("Invalid attachment data: {e}"))?;
    let ext = name
        .rsplit('.')
        .next()
        .filter(|s| !s.is_empty())
        .unwrap_or("bin");
    let temp = std::env::temp_dir()
        .join(format!("relaybase-attach-{}.{ext}", uuid::Uuid::new_v4()));
    std::fs::write(&temp, &bytes)
        .map_err(|e| format!("Failed to write temp file: {e}"))?;
    open::that(&temp).map_err(|e| format!("Failed to open file: {e}"))?;
    Ok(())
}

fn downloads_dir() -> std::path::PathBuf {
    dirs::download_dir().unwrap_or_else(std::env::temp_dir)
}

fn unique_download_path(dir: &std::path::Path, name: &str) -> std::path::PathBuf {
    let safe_name = name
        .trim()
        .replace(['/', '\\'], "_")
        .chars()
        .filter(|c| *c != '\0')
        .collect::<String>();
    let safe_name = if safe_name.is_empty() {
        "download".into()
    } else {
        safe_name
    };
    let mut candidate = dir.join(&safe_name);
    if !candidate.exists() {
        return candidate;
    }
    let path = std::path::Path::new(&safe_name);
    let stem = path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("download");
    let ext = path.extension().and_then(|s| s.to_str());
    for i in 1..100 {
        let next = match ext {
            Some(ext) if !ext.is_empty() => format!("{stem} ({i}).{ext}"),
            _ => format!("{stem} ({i})"),
        };
        candidate = dir.join(next);
        if !candidate.exists() {
            return candidate;
        }
    }
    dir.join(format!(
        "{stem}-{}.{ext}",
        uuid::Uuid::new_v4(),
        ext = ext.unwrap_or("bin")
    ))
}

/// Save a downloaded attachment to the user's Downloads folder and return the path.
#[tauri::command]
async fn save_download_file(name: String, base64_data: String) -> Result<String, String> {
    use base64::Engine as _;
    let bytes = base64::prelude::BASE64_STANDARD
        .decode(base64_data.as_bytes())
        .map_err(|e| format!("Invalid attachment data: {e}"))?;
    let path = unique_download_path(&downloads_dir(), &name);
    std::fs::write(&path, &bytes).map_err(|e| format!("Failed to save download: {e}"))?;
    Ok(path.to_string_lossy().into_owned())
}

/// Open a local file path with the OS default application.
#[tauri::command]
async fn open_file_path(path: String) -> Result<(), String> {
    let path = path.trim();
    if path.is_empty() {
        return Err("File path is empty".into());
    }
    open::that(path).map_err(|e| format!("Failed to open file: {e}"))
}

/// Reveal a downloaded file in the system file manager.
#[tauri::command]
async fn reveal_file_in_folder(path: String) -> Result<(), String> {
    let path = path.trim();
    if path.is_empty() {
        return Err("File path is empty".into());
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .args(["-R", path])
            .spawn()
            .map_err(|e| format!("Failed to reveal file: {e}"))?;
        return Ok(());
    }
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .args(["/select,", path])
            .spawn()
            .map_err(|e| format!("Failed to reveal file: {e}"))?;
        return Ok(());
    }
    #[cfg(all(unix, not(target_os = "macos")))]
    {
        let parent = std::path::Path::new(path)
            .parent()
            .ok_or_else(|| "File has no parent folder".to_string())?;
        open::that(parent).map_err(|e| format!("Failed to open folder: {e}"))?;
        return Ok(());
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows", unix)))]
    {
        let _ = path;
        Err("Reveal in folder is not supported on this platform".into())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            // Seed ~/.relaybase/icon.png for notification identity image.
            if let Err(e) = notify::ensure_notification_icon() {
                log::warn!("notification icon seed failed: {e}");
            }

            // Deep-link + loopback: production uses `relaybase://`; `tauri
            // dev` on macOS often does not register that scheme, so the
            // console callback also fetches http://127.0.0.1:32831.
            {
                use tauri_plugin_deep_link::DeepLinkExt;
                #[cfg(any(windows, target_os = "linux"))]
                {
                    if let Err(e) = app.deep_link().register("relaybase") {
                        log::warn!("deep-link register failed: {e}");
                    }
                }
                let handle = app.handle().clone();
                app.deep_link().on_open_url(move |event| {
                    for url in event.urls() {
                        let raw = url.to_string();
                        let handle = handle.clone();
                        tauri::async_runtime::spawn(async move {
                            if let Some((state, code)) = parse_oauth_callback_url(&raw) {
                                let result = complete_cf_oauth_inner(state, code).await;
                                emit_oauth_result(&handle, result);
                            }
                        });
                    }
                });
                let handle = app.handle().clone();
                tauri::async_runtime::spawn(async move {
                    run_oauth_loopback_server(handle).await;
                });
            }

            // Build the main window programmatically (rather than via the
            // tauri.conf.json `app.windows` array) so we can attach an
            // `on_new_window` handler. Email HTML is rendered in a sandboxed
            // <iframe sandbox="allow-same-origin allow-popups">; links use
            // target="_blank", which the webview turns into a new-window
            // request. Route those to the system browser and deny the in-app
            // window so external links never open inside Relaybase.
            let builder = tauri::WebviewWindowBuilder::new(
                app,
                "main",
                tauri::WebviewUrl::App("index.html".into()),
            )
            .title("Relaybase")
            .inner_size(1280.0, 840.0)
            .min_inner_size(960.0, 640.0)
            .resizable(true)
            .fullscreen(false)
            .decorations(true)
            .accept_first_mouse(true)
            .disable_drag_drop_handler()
            .zoom_hotkeys_enabled(false);

            // macOS-only window chrome options. These Tauri 2.x builder
            // methods are gated to macOS; calling them unconditionally breaks
            // `cargo check` on Linux/Windows.
            #[cfg(target_os = "macos")]
            let builder = builder
                .title_bar_style(tauri::TitleBarStyle::Overlay)
                .hidden_title(true)
                .traffic_light_position(tauri::LogicalPosition::new(14.0, 21.0));

            builder
            .on_new_window(move |url, _features| {
                let s = url.as_str().to_string();
                if s.starts_with("http://") || s.starts_with("https://") {
                    if let Err(e) = open_url_in_os_browser(&s) {
                        log::warn!("open_external_url failed: {e}");
                    }
                }
                tauri::webview::NewWindowResponse::Deny
            })
            // Safety net: if a link ever navigates the main webview itself
            // (e.g. a top-level <a> without target, or an iframe whose
            // in-place navigation bubbles up), deny the in-app load and
            // route the URL to the system browser. App-internal navigations
            // (dev server / static export) are still allowed.
            .on_navigation(move |url| {
                let s = url.as_str().to_string();
                if s.starts_with("http://") || s.starts_with("https://") {
                    // Only intercept external hosts — never block the app's
                    // own dev URL (http://127.0.0.1:32830 / localhost) or the
                    // tauri.localhost / asset:// app origin, otherwise the
                    // shell would stop loading routes.
                    let is_app_origin = s.starts_with("http://127.0.0.1")
                        || s.starts_with("http://localhost")
                        || s.starts_with("https://127.0.0.1")
                        || s.starts_with("https://localhost");
                    if !is_app_origin {
                        if let Err(e) = open_url_in_os_browser(&s) {
                            log::warn!("on_navigation open_external_url failed: {e}");
                        }
                        return false;
                    }
                }
                true
            })
            .build()?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            save_cf_credentials,
            get_credentials,
            clear_stored_credentials,
            get_email_prefs,
            save_email_prefs,
            get_api_key_vault,
            save_api_key_vault_entry,
            remove_api_key_vault_entry_cmd,
            migrate_mail_user_folder,
            get_mail_json,
            save_mail_json,
            get_cache_json,
            save_cache_json,
            verify_cf_token,
            list_cf_zones,
            probe_routing_worker,
            adopt_routing_worker,
            install_routing_worker,
            update_routing_worker,
            save_license_key,
            save_relaybase_account,
            clear_relaybase_account,
            get_team_login,
            save_team_login_cmd,
            clear_team_login_cmd,
            probe_auto_install,
            auto_install_routing_worker,
            cancel_auto_install,
            rollback_auto_install,
            init_worker_db_cmd,
            push_server_token,
            start_cf_oauth,
            complete_cf_oauth,
            refresh_install_token,
            verify_worker_connection,
            save_worker_connection,
            get_desktop_info,
            open_external_url,
            open_local_file_with_default_app,
            save_download_file,
            open_file_path,
            reveal_file_in_folder,
            notify::show_notification,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Relaybase desktop");
}
