//! Single reader for the in-memory Cloudflare OAuth session.
//!
//! Tauri commands that talk to Cloudflare (or send `X-Cf-Access-Token` to the
//! product Worker) call [`require_cf_oauth`]. A fresh access token is returned
//! from memory with no network. The Cloudflare token endpoint is hit only when
//! the access token expires within 60 seconds.

use crate::secrets::{
    clear_cf_oauth_session, get_cf_oauth_session, load_credentials, set_cf_oauth_session,
};

pub const CLOUDFLARE_AUTH_EXPIRED: &str = "CLOUDFLARE_AUTH_EXPIRED";

const AUTH_AGAIN: &str = "Authorize with Cloudflare again";

#[derive(Debug, Clone)]
pub struct CfOAuthCreds {
    pub access_token: String,
    pub account_id: String,
}

/// Memory OAuth session only. No disk `install_token` fallback.
pub async fn require_cf_oauth() -> Result<CfOAuthCreds, String> {
    let session = require_cf_oauth_session().await?;
    let access_token = session.access_token.trim().to_string();
    let account_id = account_id_from_memory(&session)?;
    Ok(CfOAuthCreds {
        access_token,
        account_id,
    })
}

/// Same session/refresh rules as [`require_cf_oauth`], but only the access
/// token — no CF account id. Used by forgot-passtoken reset: the recover
/// OAuth client has `secrets-store.write` only, so we cannot list `/accounts`
/// to resolve an account id on the desktop; the Worker verifies the token.
pub async fn require_cf_oauth_access_token() -> Result<String, String> {
    let session = require_cf_oauth_session().await?;
    let access_token = session.access_token.trim().to_string();
    if access_token.is_empty() {
        return Err(expired(AUTH_AGAIN));
    }
    Ok(access_token)
}

async fn require_cf_oauth_session(
) -> Result<crate::secrets::CfOAuthSession, String> {
    let Some(mut session) = get_cf_oauth_session() else {
        return Err(expired(AUTH_AGAIN));
    };

    let now_secs = now_unix_secs();
    let expires_at_secs = parse_iso_to_secs(&session.access_expires_at);
    let fresh = session.access_expires_at.is_empty()
        || expires_at_secs.saturating_sub(now_secs) >= 60;
    if !fresh {
        if session.refresh_token.trim().is_empty() {
            return Err(expired(AUTH_AGAIN));
        }
        session = refresh_oauth_session(session).await?;
    }

    Ok(session)
}

/// Refresh if a session exists and is expiring; `Ok(None)` when the user has
/// not authorized. Used by schema commands that also accept pepper / console
/// session.
pub async fn cf_oauth_if_present() -> Result<Option<CfOAuthCreds>, String> {
    if get_cf_oauth_session().is_none() {
        return Ok(None);
    }
    Ok(Some(require_cf_oauth().await?))
}

fn account_id_from_memory(
    session: &crate::secrets::CfOAuthSession,
) -> Result<String, String> {
    let from_session = session.account_id.trim();
    if !from_session.is_empty() {
        return Ok(from_session.to_string());
    }
    let disk = load_credentials()?.unwrap_or_default();
    let from_disk = disk.account_id.trim();
    if !from_disk.is_empty() {
        return Ok(from_disk.to_string());
    }
    Err(expired(AUTH_AGAIN))
}

async fn refresh_oauth_session(
    mut session: crate::secrets::CfOAuthSession,
) -> Result<crate::secrets::CfOAuthSession, String> {
    let client_id = if session.client_id.trim().is_empty() {
        fetch_oauth_client_id("install").await?
    } else {
        session.client_id.clone()
    };
    let http = reqwest::Client::new();
    let refresh_body = url::form_urlencoded::Serializer::new(String::new())
        .append_pair("grant_type", "refresh_token")
        .append_pair("refresh_token", &session.refresh_token)
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
            clear_cf_oauth_session();
            return Err(expired(AUTH_AGAIN));
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
        .unwrap_or_else(|| session.refresh_token.clone());

    session.access_token = access_token;
    session.refresh_token = next_refresh;
    session.access_expires_at = new_iso_expires(expires_in);
    session.client_id = client_id;
    set_cf_oauth_session(session.clone());
    Ok(session)
}

async fn fetch_oauth_client_id(purpose: &str) -> Result<String, String> {
    let purpose = if purpose == "recover" {
        "recover"
    } else {
        "install"
    };
    let url = format!(
        "{}/api/v1/oauth/config?purpose={purpose}",
        crate::console_base_url().trim_end_matches('/')
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

fn expired(detail: &str) -> String {
    format!("{CLOUDFLARE_AUTH_EXPIRED}: {detail}")
}

/// ISO-8601 timestamp `expires_in` seconds from now.
pub(crate) fn new_iso_expires(expires_in: u64) -> String {
    let secs = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
        .saturating_add(expires_in);
    let days = secs / 86400;
    let rem = secs % 86400;
    let h = rem / 3600;
    let m = (rem % 3600) / 60;
    let s = rem % 60;
    let (y, mo, dd) = days_to_ymd(days as i64);
    format!("{y:04}-{mo:02}-{dd:02}T{h:02}:{m:02}:{s:02}Z")
}

fn now_unix_secs() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

fn parse_iso_to_secs(iso: &str) -> u64 {
    if iso.is_empty() {
        return 0;
    }
    let bytes = iso.as_bytes();
    if bytes.len() < 19 {
        return 0;
    }
    let to_i = |a: usize, b: usize| -> Option<u64> {
        std::str::from_utf8(&bytes[a..b])
            .ok()
            .and_then(|s| s.parse::<u64>().ok())
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

fn days_from_civil(y: i64, m: i64, d: i64) -> i64 {
    let y = if m <= 2 { y - 1 } else { y };
    let era = if y >= 0 { y } else { y - 399 } / 400;
    let yoe = y - era * 400;
    let doy = (153 * (if m > 2 { m - 3 } else { m + 9 }) + 2) / 5 + d - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    era * 146097 + doe - 719468
}

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
