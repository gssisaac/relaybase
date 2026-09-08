use tauri::AppHandle;

use super::errors::format_worker_http_error;
use super::log::emit_log;

#[derive(serde::Deserialize, Default)]
struct RoutingRule {
    #[serde(default)]
    enabled: bool,
    #[serde(default)]
    action: String,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct RoutingStatusEntry {
    domain: String,
    #[serde(default)]
    rules: Option<Vec<RoutingRule>>,
    #[serde(default)]
    error: Option<String>,
}

#[derive(serde::Deserialize)]
struct RoutingStatusResponse {
    #[serde(default)]
    domains: Vec<RoutingStatusEntry>,
}

/// Best-effort: re-apply Cloudflare Email Routing rules for every domain
/// whose literal-To rule Cloudflare left `enabled: false` after this Worker
/// script upload (the `550 5.1.1 Address not found` bounce case). Never
/// fails the install — only a console session exists once an owner has
/// completed setup, so this is a no-op on first install.
pub(crate) async fn repair_email_routing_for_all_domains(
    app: &AppHandle,
    worker_url: &str,
    console_access: Option<&str>,
) {
    let Some(token) = console_access.map(str::trim).filter(|t| !t.is_empty()) else {
        return;
    };
    let base = worker_url.trim().trim_end_matches('/');
    if base.is_empty() {
        return;
    }

    let client = reqwest::Client::new();
    let status_url = format!("{base}/console/domains/routing");
    let res = match client
        .get(&status_url)
        .header("Authorization", format!("Bearer {token}"))
        .send()
        .await
    {
        Ok(r) => r,
        Err(e) => {
            emit_log(
                app,
                "repair_routing",
                "info",
                format!("Could not check Email Routing status: {e}"),
            );
            return;
        }
    };
    if !res.status().is_success() {
        let status = res.status();
        let text = res.text().await.unwrap_or_default();
        emit_log(
            app,
            "repair_routing",
            "info",
            format!(
                "Email Routing status check failed: {}",
                format_worker_http_error("routing status", status, &text)
            ),
        );
        return;
    }
    let body: RoutingStatusResponse = match res.json().await {
        Ok(b) => b,
        Err(e) => {
            emit_log(
                app,
                "repair_routing",
                "info",
                format!("Could not parse Email Routing status: {e}"),
            );
            return;
        }
    };

    let mut repaired = 0usize;
    for entry in body.domains {
        if entry.error.is_some() {
            continue;
        }
        let has_disabled_rule = entry
            .rules
            .unwrap_or_default()
            .iter()
            .any(|r| r.action == "worker" && !r.enabled);
        if !has_disabled_rule {
            continue;
        }

        let repair_url = format!("{base}/console/domains/routing/repair");
        match client
            .post(&repair_url)
            .header("Authorization", format!("Bearer {token}"))
            .header("Content-Type", "application/json")
            .json(&serde_json::json!({ "domain": entry.domain }))
            .send()
            .await
        {
            Ok(r) if r.status().is_success() => {
                repaired += 1;
                emit_log(
                    app,
                    "repair_routing",
                    "info",
                    format!("Repaired Email Routing rules for {}", entry.domain),
                );
            }
            Ok(r) => {
                let status = r.status();
                let text = r.text().await.unwrap_or_default();
                emit_log(
                    app,
                    "repair_routing",
                    "info",
                    format!(
                        "Could not repair {}: {}",
                        entry.domain,
                        format_worker_http_error("routing repair", status, &text)
                    ),
                );
            }
            Err(e) => {
                emit_log(
                    app,
                    "repair_routing",
                    "info",
                    format!("Could not repair {}: {e}", entry.domain),
                );
            }
        }
    }

    if repaired > 0 {
        emit_log(
            app,
            "repair_routing",
            "info",
            format!("Email Routing self-heal complete — fixed {repaired} domain(s)"),
        );
    }
}
