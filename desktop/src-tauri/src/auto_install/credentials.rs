use crate::cloudflare::{put_worker_secret, CfClient};
use crate::secrets::StoredCredentials;

use super::types::AutoInstallResult;

pub(crate) fn generate_auth_pepper() -> String {
    // 32 hex chars = 128 bits of entropy (two uuid v4s concatenated).
    let a = uuid::Uuid::new_v4().simple().to_string();
    let b = uuid::Uuid::new_v4().simple().to_string();
    format!("{a}{b}")
}

/// Merge an auto-install result into stored credentials (preserves
/// Relaybase account + CF account id if already present).
pub fn merge_into_credentials(
    existing: &StoredCredentials,
    result: &AutoInstallResult,
    account_id: Option<String>,
) -> StoredCredentials {
    let mut next = existing.clone();
    next.account_id = account_id
        .filter(|a| !a.trim().is_empty())
        .or_else(|| (!result.account_id.is_empty()).then(|| result.account_id.clone()))
        .unwrap_or_else(|| existing.account_id.clone());
    next.worker_url = result.worker_url.clone();
    next.admin_token.clear();
    next.worker_script_name = result.worker_script_name.clone();
    if !result.worker_version.trim().is_empty() {
        next.worker_version = result.worker_version.clone();
    }
    next
}

/// PUT the Worker `CF_API_TOKEN` secret using the install (OAuth) token
/// for API auth and the server token as the secret value. Used by Settings
/// after install.
pub async fn push_cf_api_token_secret(
    account_id: &str,
    script_name: &str,
    install_token: &str,
    server_token: &str,
) -> Result<String, String> {
    if script_name.is_empty() {
        return Err("No deployed Worker script name found.".into());
    }
    if install_token.is_empty() {
        return Err("Authorize with Cloudflare again".into());
    }
    if server_token.is_empty() {
        return Err("Server token is empty.".into());
    }
    let account_id = account_id.trim();
    if account_id.is_empty() {
        return Err("Authorize with Cloudflare again".into());
    }
    let account_id = account_id.to_string();
    let client = CfClient {
        account_id,
        api_token: install_token.to_string(),
    };
    put_worker_secret(&client, script_name, "CF_API_TOKEN", server_token).await?;
    Ok(now_iso())
}

pub fn now_iso() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    // Simple fixed-offset ISO-ish timestamp; precision is not important for
    // display, only "was it pushed after the last save".
    let days = secs / 86_400;
    let secs_of_day = secs % 86_400;
    let h = secs_of_day / 3600;
    let m = (secs_of_day % 3600) / 60;
    let s = secs_of_day % 60;
    // 1970-01-01 + days — approximate date math (good enough for a label).
    let (y, mo, dd) = days_to_ymd(days as i64);
    format!("{y:04}-{mo:02}-{dd:02}T{h:02}:{m:02}:{s:02}Z")
}

fn days_to_ymd(days: i64) -> (i64, i64, i64) {
    // Civil-from-days algorithm (Howard Hinnant). days since 1970-01-01.
    let z = days + 719_468;
    let era = (if z >= 0 { z } else { z - 146_096 }) / 146_097;
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = yoe + era * 400 + (if m <= 2 { 1 } else { 0 });
    (y, m, d)
}
