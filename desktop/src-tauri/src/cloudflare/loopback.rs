use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use base64::Engine as _;
use sha2::{Digest, Sha256};
use uuid::Uuid;

use crate::storage::{
    load_credentials, load_credentials_merged, save_credentials, set_cf_oauth_session,
    CfOAuthSession, StoredCredentials,
};
use super::client::{
    resolve_account_id, resolve_account_id_for_recover,
    resolve_account_id_for_recover_with_hint,
};
use super::oauth::{new_iso_expires, save_keyring_oauth_refresh};

/// Relaybase console base URL. The desktop calls console.relaybase.xyz for
/// account/session, license, recovery, and CF OAuth (install-token) flows.
/// Override with the RELAYBASE_CONSOLE_URL env var for dev/staging.
pub fn console_base_url() -> String {
    std::env::var("RELAYBASE_CONSOLE_URL")
        .ok()
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| "https://console.relaybase.xyz".to_string())
}

// In-flight CF OAuth data, minted in `start_cf_oauth` and consumed in
// `complete_cf_oauth`. The OAuth client is a PUBLIC PKCE client (no secret),
// so the desktop holds the `code_verifier` and exchanges the code itself.
// No Relaybase console session is required.
struct InFlightOauth {
    state: String,
    verifier: String,
    client_id: String,
    redirect_uri: String,
    purpose: String,
}
static CF_OAUTH_INFLIGHT: Mutex<Option<InFlightOauth>> = Mutex::new(None);

/// Loopback HTTP port the console callback page POSTs to. Works in `tauri
/// dev` (where `relaybase://` is often not registered with Launch Services)
/// and in production as a reliable fallback next to the custom-scheme link.
pub const OAUTH_LOOPBACK_PORT: u16 = 32831;
static OAUTH_LOOPBACK_BOUND: AtomicBool = AtomicBool::new(false);

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

#[derive(Debug, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OAuthStartResult {
    pub authorize_url: String,
    pub state: String,
}

pub async fn start_cf_oauth_inner<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    purpose: Option<String>,
) -> Result<OAuthStartResult, String> {
    ensure_oauth_loopback(app).await?;
    let purpose = match purpose.as_deref().map(str::trim) {
        Some("recover") => "recover",
        _ => "install",
    };
    let url = format!(
        "{}/api/v1/oauth/config?purpose={purpose}",
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
        .unwrap_or(if purpose == "recover" {
            "secrets-store.write"
        } else {
            "d1.write workers-r2.write workers-scripts.write"
        })
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
            purpose: purpose.to_string(),
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

pub async fn complete_cf_oauth_inner(
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
    let mut account_id = tokens
        .get("account_id")
        .and_then(|v| v.as_str())
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty());
    if account_id.is_none() {
        account_id = resolve_account_id(&access_token).await.ok();
    }
    if account_id.is_none() {
        account_id = resolve_account_id_for_recover(&access_token).await.ok();
    }
    if account_id.is_none() {
        if let Ok(Some(creds)) = load_credentials() {
            let worker_url = creds.worker_url.trim().trim_end_matches('/');
            if !worker_url.is_empty() {
                let url = format!("{worker_url}/console/auth-status");
                if let Ok(res) = reqwest::Client::new().get(&url).send().await {
                    if res.status().is_success() {
                        if let Ok(json) = res.json::<serde_json::Value>().await {
                            let hint = json
                                .get("cfAccountId")
                                .and_then(|v| v.as_str())
                                .map(str::trim)
                                .filter(|s| !s.is_empty());
                            account_id = resolve_account_id_for_recover_with_hint(
                                &access_token,
                                hint,
                            )
                            .await
                            .ok();
                        }
                    }
                }
            }
        }
    }
    let expires_at = new_iso_expires(expires_in);

    set_cf_oauth_session(CfOAuthSession {
        access_token: access_token.clone(),
        refresh_token: refresh_token.clone(),
        access_expires_at: expires_at.clone(),
        account_id: account_id.clone().unwrap_or_default(),
        client_id: inflight.client_id.clone(),
    });

    if inflight.purpose != "recover" && !refresh_token.is_empty() {
        if let Err(e) = save_keyring_oauth_refresh(
            &refresh_token,
            account_id.as_deref().unwrap_or(""),
            &inflight.client_id,
        ) {
            log::error!("Failed to persist CF OAuth refresh token to keyring: {e}");
        }
    }

    let mut creds = load_credentials()?.unwrap_or_default();
    if let Some(acct) = account_id {
        let acct = acct.trim();
        if !acct.is_empty() {
            creds.account_id = acct.to_string();
        }
    }
    save_credentials(&creds)?;
    load_credentials_merged()
}

pub fn parse_oauth_callback_url(raw: &str) -> Option<(String, String)> {
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

pub fn emit_oauth_result<R: tauri::Runtime>(
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

fn oauth_loopback_in_use_error() -> String {
    format!(
        "Cloudflare callback port 127.0.0.1:{OAUTH_LOOPBACK_PORT} is already in use. \
         Quit the installed Relaybase.app (or any other Relaybase window) and try Authorize again."
    )
}

async fn bind_oauth_loopback() -> Result<tokio::net::TcpListener, String> {
    let addr = format!("127.0.0.1:{OAUTH_LOOPBACK_PORT}");
    match tokio::net::TcpListener::bind(&addr).await {
        Ok(listener) => {
            OAUTH_LOOPBACK_BOUND.store(true, Ordering::SeqCst);
            log::info!("OAuth loopback listening on http://{addr}/oauth/callback");
            Ok(listener)
        }
        Err(e) if e.kind() == std::io::ErrorKind::AddrInUse => Err(oauth_loopback_in_use_error()),
        Err(e) => Err(format!(
            "Could not start Cloudflare callback listener on {addr}: {e}"
        )),
    }
}

pub async fn ensure_oauth_loopback<R: tauri::Runtime>(app: tauri::AppHandle<R>) -> Result<(), String> {
    if OAUTH_LOOPBACK_BOUND.load(Ordering::SeqCst) {
        return Ok(());
    }
    let listener = bind_oauth_loopback().await?;
    tauri::async_runtime::spawn(async move {
        accept_oauth_loopback(app, listener).await;
    });
    Ok(())
}

/// Accept `GET /oauth/callback?code=&state=` from the console callback page
/// (browser on this machine). CORS-open so https://console.relaybase.xyz can
/// fetch it. Bound to 127.0.0.1 only.
pub async fn run_oauth_loopback_server<R: tauri::Runtime>(app: tauri::AppHandle<R>) {
    let listener = match bind_oauth_loopback().await {
        Ok(l) => l,
        Err(e) => {
            log::warn!("{e}");
            return;
        }
    };
    accept_oauth_loopback(app, listener).await;
}

async fn accept_oauth_loopback<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    listener: tokio::net::TcpListener,
) {
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
