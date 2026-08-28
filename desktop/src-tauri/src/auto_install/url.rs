use crate::cloudflare::{account_workers_dev_url, CfClient};
use crate::worker::DEFAULT_SCRIPT;

use super::types::WorkerUpdateTarget;

/// OAuth account's workers.dev URL does not match the saved Worker.
pub const WORKER_URL_ACCOUNT_MISMATCH: &str = "WORKER_URL_ACCOUNT_MISMATCH";

pub fn worker_url_host(raw: &str) -> Option<String> {
    let trimmed = raw.trim().trim_end_matches('/').to_lowercase();
    let rest = trimmed
        .strip_prefix("https://")
        .or_else(|| trimmed.strip_prefix("http://"))?;
    let host = rest.split('/').next()?.trim();
    if host.is_empty() {
        None
    } else {
        Some(host.to_string())
    }
}

pub fn worker_urls_match(expected: &str, oauth: &str) -> bool {
    match (worker_url_host(expected), worker_url_host(oauth)) {
        (Some(a), Some(b)) => a == b,
        _ => false,
    }
}

pub(crate) fn is_workers_dev_url(raw: &str) -> bool {
    worker_url_host(raw)
        .map(|h| h.ends_with(".workers.dev"))
        .unwrap_or(false)
}

fn mismatch_error(expected: &str, oauth: &str) -> String {
    format!(
        "{WORKER_URL_ACCOUNT_MISMATCH}: This Cloudflare login is a different account than your saved Worker.\n\
         Saved Worker: {expected}\n\
         This login would update: {oauth}\n\
         Authorize again and choose the Cloudflare account that owns your Worker. No script was uploaded."
    )
}

async fn peek_worker_account_id(worker_url: &str, admin_token: &str) -> Option<String> {
    let base = worker_url.trim().trim_end_matches('/');
    let token = admin_token.trim();
    if base.is_empty() || token.is_empty() {
        return None;
    }
    let http = reqwest::Client::new();
    let res = http
        .get(format!("{base}/console/connect"))
        .header("Authorization", format!("Bearer {token}"))
        .send()
        .await
        .ok()?;
    if !res.status().is_success() {
        return None;
    }
    let value: serde_json::Value = res.json().await.ok()?;
    value
        .get("accountId")
        .and_then(|v| v.as_str())
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string())
}

/// Resolve the OAuth account's workers.dev URL and compare it to the saved Worker.
/// Custom-domain installs match when `/console/connect` reports the same account id.
pub async fn preview_worker_update_target(
    api_token: &str,
    account_id: &str,
    expected_worker_url: &str,
    script_name: &str,
) -> Result<WorkerUpdateTarget, String> {
    let expected = expected_worker_url.trim().trim_end_matches('/').to_string();
    if expected.is_empty() {
        return Err("No Worker URL saved. Complete install first.".into());
    }
    if account_id.trim().is_empty() {
        return Err("Authorize with Cloudflare first.".into());
    }
    let script = if script_name.trim().is_empty() {
        DEFAULT_SCRIPT
    } else {
        script_name.trim()
    };
    let client = CfClient {
        account_id: account_id.trim().to_string(),
        api_token: api_token.trim().to_string(),
    };
    let oauth_worker_url = account_workers_dev_url(&client, script).await?;
    let access = crate::owner_session::current_access_token().unwrap_or_default();
    let connected_account_id = peek_worker_account_id(&expected, &access)
        .await
        .unwrap_or_default();
    let url_match = worker_urls_match(&expected, &oauth_worker_url);
    let account_match = !connected_account_id.is_empty()
        && connected_account_id.eq_ignore_ascii_case(account_id.trim());
    let matches = url_match || (!is_workers_dev_url(&expected) && account_match);
    Ok(WorkerUpdateTarget {
        expected_worker_url: expected,
        oauth_account_id: account_id.trim().to_string(),
        oauth_worker_url,
        connected_account_id,
        matches,
    })
}

pub fn assert_worker_update_target_matches(target: &WorkerUpdateTarget) -> Result<(), String> {
    if target.matches {
        Ok(())
    } else {
        Err(mismatch_error(
            &target.expected_worker_url,
            &target.oauth_worker_url,
        ))
    }
}

#[cfg(test)]
mod worker_url_match_tests {
    use super::{worker_url_host, worker_urls_match};

    #[test]
    fn hosts_match_ignore_scheme_slash_case() {
        assert!(worker_urls_match(
            "https://relaybase-api.sf-parkinglot.workers.dev/",
            "HTTPS://relaybase-api.sf-parkinglot.workers.dev"
        ));
        assert_eq!(
            worker_url_host("https://relaybase-api.sf-parkinglot.workers.dev/foo"),
            Some("relaybase-api.sf-parkinglot.workers.dev".into())
        );
    }

    #[test]
    fn different_subdomain_does_not_match() {
        assert!(!worker_urls_match(
            "https://relaybase-api.sf-parkinglot.workers.dev",
            "https://relaybase-api.other-account.workers.dev"
        ));
    }

    #[test]
    fn custom_domain_does_not_match_workers_dev() {
        assert!(!worker_urls_match(
            "https://mail.example.com",
            "https://relaybase-api.sf-parkinglot.workers.dev"
        ));
    }
}
