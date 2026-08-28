use tauri::AppHandle;

use super::cancel::check_cancelled;
use super::constants::WARMUP_BACKOFF_SECS;
use super::log::emit_log;

async fn probe_worker_health(worker_url: &str) -> Result<bool, String> {
    let value = fetch_worker_health_json(worker_url).await?;
    Ok(value.get("ok") == Some(&serde_json::Value::Bool(true)))
}

async fn fetch_worker_health_json(worker_url: &str) -> Result<serde_json::Value, String> {
    let base = worker_url.trim().trim_end_matches('/');
    if base.is_empty() {
        return Err("Worker URL is empty".into());
    }
    let client = reqwest::Client::new();
    let res = client
        .get(format!("{base}/health"))
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !res.status().is_success() {
        return Err(format!("health HTTP {}", res.status()));
    }
    let body = res.text().await.unwrap_or_default();
    serde_json::from_str(&body).map_err(|e| e.to_string())
}

/// Log `/health` shape. Missing `d1Bound` means the hosted ZIP is stale.
pub(crate) async fn log_worker_health_shape(app: &AppHandle, worker_url: &str) {
    match fetch_worker_health_json(worker_url).await {
        Ok(health) => {
            let version = health
                .get("version")
                .and_then(|v| v.as_str())
                .unwrap_or("?");
            let d1_bound = health.get("d1Bound");
            let schema_migrate = health
                .get("schemaMigrate")
                .and_then(|v| v.as_str())
                .unwrap_or("missing");
            match d1_bound {
                Some(bound) => emit_log(
                    app,
                    "warmup",
                    "info",
                    format!(
                        "Worker /health version={version} schemaMigrate={schema_migrate} d1Bound={bound}"
                    ),
                ),
                None => {
                    emit_log(
                        app,
                        "warmup",
                        "stderr",
                        format!(
                            "Worker /health version={version} has no d1Bound — the hosted install ZIP is stale. Re-pack with `pnpm pack:worker-install`, deploy the website, then Try again."
                        ),
                    );
                }
            }
        }
        Err(e) => emit_log(
            app,
            "warmup",
            "info",
            format!("Could not read /health after warmup: {e}"),
        ),
    }
}

/// Poll GET /health until the Worker responds or ~30s elapses (post-deploy warm-up).
pub(crate) async fn wait_for_worker_ready(app: &AppHandle, worker_url: &str) -> Result<(), String> {
    emit_log(
        app,
        "warmup",
        "info",
        format!("Waiting for {worker_url} to become reachable…"),
    );
    for attempt in 0..=WARMUP_BACKOFF_SECS.len() {
        if attempt > 0 {
            check_cancelled()?;
            let delay = WARMUP_BACKOFF_SECS[attempt - 1];
            emit_log(
                app,
                "warmup",
                "info",
                format!(
                    "Worker not ready yet — retrying in {delay}s (attempt {}/{})…",
                    attempt + 1,
                    WARMUP_BACKOFF_SECS.len() + 1
                ),
            );
            tokio::time::sleep(tokio::time::Duration::from_secs(delay)).await;
            check_cancelled()?;
        }
        match probe_worker_health(worker_url).await {
            Ok(true) => {
                emit_log(
                    app,
                    "warmup",
                    "info",
                    format!("Worker is reachable (attempt {})", attempt + 1),
                );
                return Ok(());
            }
            Ok(false) => {}
            Err(e) => {
                emit_log(
                    app,
                    "warmup",
                    "info",
                    format!("Health check failed (attempt {}): {e}", attempt + 1),
                );
            }
        }
    }
    emit_log(
        app,
        "warmup",
        "stderr",
        "Worker did not respond to /health within ~30s — continuing anyway. You can verify manually.",
    );
    Ok(())
}

pub(crate) async fn fetch_worker_version(worker_url: &str) -> Option<String> {
    let base = worker_url.trim().trim_end_matches('/');
    if base.is_empty() {
        return None;
    }
    let client = reqwest::Client::new();
    let res = client.get(format!("{base}/health")).send().await.ok()?;
    if !res.status().is_success() {
        return None;
    }
    let body = res.text().await.ok()?;
    let value: serde_json::Value = serde_json::from_str(&body).ok()?;
    value
        .get("version")
        .and_then(|v| v.as_str())
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty() && s != "unknown")
}
