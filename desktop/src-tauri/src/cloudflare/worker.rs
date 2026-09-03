use super::client::{
    assert_r2_subscription, enable_workers_dev, ensure_r2_bucket, find_r2_bucket,
    put_worker_secret, upload_worker_script, worker_health_ok, worker_script_exists, CfClient,
};
use crate::storage::StoredCredentials;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

pub const DEFAULT_SCRIPT: &str = "relaybase-api";
pub const R2_BUCKET: &str = "relaybase-mailbox";

/// Minimal Worker stub shipped with the app when a full server build is not embedded.
/// Production releases should replace this via `worker_js_override` from the release channel
/// or by bundling `relaybase-worker` build output under resources.
const EMBEDDED_WORKER_STUB: &str = r#"
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/health") {
      return Response.json({ ok: true, stub: true, inbound: { r2Configured: !!env.INBOUND } });
    }
    return Response.json({ error: "Relaybase Worker stub — replace with full server build via Update Worker", stub: true }, { status: 501 });
  },
  async email(message, env) {
    const id = crypto.randomUUID();
    const domain = (message.to || "").split("@")[1] || "unknown";
    await env.INBOUND.put(`inbound/${domain}/${id}/raw.eml`, message.raw);
    return;
  }
};
"#;

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallResult {
    pub worker_url: String,
    pub worker_script_name: String,
    pub r2_bucket: String,
    /// true when an existing named install was reused without uploading a new script
    pub skipped: bool,
    pub admin_relinked: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ResourceCheck {
    pub name: String,
    pub kind: String,
    pub present: bool,
    pub detail: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProbeResult {
    /// "ready" | "partial" | "missing"
    pub status: String,
    pub worker_script_name: String,
    pub worker_url: Option<String>,
    pub health_ok: bool,
    pub resources: Vec<ResourceCheck>,
    pub summary: String,
}

fn client_from(account_id: &str, api_token: &str) -> CfClient {
    CfClient {
        account_id: account_id.to_string(),
        api_token: api_token.to_string(),
    }
}

pub async fn probe_install(account_id: &str, api_token: &str) -> Result<ProbeResult, String> {
    let client = client_from(account_id, api_token);
    assert_r2_subscription(&client).await?;
    let script_name = DEFAULT_SCRIPT.to_string();

    let script_present = worker_script_exists(&client, &script_name).await?;
    let r2_present = find_r2_bucket(&client, R2_BUCKET).await?;

    let worker_url = if script_present {
        match enable_workers_dev(&client, &script_name).await {
            Ok(url) => Some(url),
            Err(_) => Some(format!("https://{script_name}.workers.dev")),
        }
    } else {
        None
    };

    let health_ok = if let Some(ref url) = worker_url {
        worker_health_ok(url).await
    } else {
        false
    };

    let resources = vec![
        ResourceCheck {
            name: script_name.clone(),
            kind: "worker".into(),
            present: script_present,
            detail: if script_present {
                "Worker script found by exact name".into()
            } else {
                "Not found — will be created on install".into()
            },
        },
        ResourceCheck {
            name: R2_BUCKET.into(),
            kind: "r2".into(),
            present: r2_present,
            detail: if r2_present {
                "R2 bucket found by name".into()
            } else {
                "Stores inbound email raw messages".into()
            },
        },
    ];

    let all_present = script_present && r2_present;
    let any_present = script_present || r2_present;

    let status = if all_present && health_ok {
        "ready"
    } else if any_present || script_present {
        "partial"
    } else {
        "missing"
    };

    let summary = match status {
        "ready" => format!(
            "Found healthy Worker `{script_name}` with matching R2 resources. Install can be skipped."
        ),
        "partial" => format!(
            "Some Relaybase resources exist under the expected names, but the install is incomplete or unhealthy."
        ),
        _ => format!(
            "No Worker named `{script_name}` (or matching R2) found in this account yet."
        ),
    };

    Ok(ProbeResult {
        status: status.into(),
        worker_script_name: script_name,
        worker_url,
        health_ok,
        resources,
        summary: summary.into(),
    })
}

/// Bind an already-installed named Worker into local credentials without re-uploading script.
pub async fn adopt_worker(
    account_id: &str,
    api_token: &str,
    existing: &StoredCredentials,
) -> Result<(InstallResult, StoredCredentials), String> {
    let probe = probe_install(account_id, api_token).await?;
    if probe.status != "ready" {
        return Err(
            "Install is not ready to skip. Approve and run Install instead.".into(),
        );
    }
    let script_name = probe.worker_script_name.clone();
    let worker_url = probe
        .worker_url
        .clone()
        .ok_or_else(|| "Could not resolve workers.dev URL".to_string())?;

    let result = InstallResult {
        worker_url: worker_url.clone(),
        worker_script_name: script_name.clone(),
        r2_bucket: R2_BUCKET.to_string(),
        skipped: true,
        admin_relinked: false,
    };

    let mut creds = existing.clone();
    creds.account_id = account_id.to_string();
    creds.worker_url = worker_url;
    creds.worker_script_name = script_name;

    Ok((result, creds))
}

pub async fn install_worker(
    account_id: &str,
    api_token: &str,
    worker_js: Option<String>,
    existing: &StoredCredentials,
) -> Result<(InstallResult, StoredCredentials), String> {
    let probe = probe_install(account_id, api_token).await?;
    if probe.status == "ready" {
        return adopt_worker(account_id, api_token, existing).await;
    }

    let client = client_from(account_id, api_token);
    let script_name = DEFAULT_SCRIPT.to_string();
    ensure_r2_bucket(&client, R2_BUCKET).await?;

    let source = worker_js.unwrap_or_else(|| EMBEDDED_WORKER_STUB.trim().to_string());
    upload_worker_script(
        &client,
        &script_name,
        &source,
        R2_BUCKET,
        &[],
        "",
    )
    .await?;

    let auth_pepper = format!("{}", Uuid::new_v4().simple());
    put_worker_secret(&client, &script_name, "AUTH_PEPPER", &auth_pepper).await?;
    put_worker_secret(&client, &script_name, "CF_ACCOUNT_ID", account_id).await?;

    let worker_url = enable_workers_dev(&client, &script_name).await?;

    let result = InstallResult {
        worker_url: worker_url.clone(),
        worker_script_name: script_name.clone(),
        r2_bucket: R2_BUCKET.to_string(),
        skipped: false,
        admin_relinked: false,
    };

    let mut creds = existing.clone();
    creds.account_id = account_id.to_string();
    creds.worker_url = worker_url;
    creds.worker_script_name = script_name;

    Ok((result, creds))
}

pub async fn update_worker(
    creds: &StoredCredentials,
    worker_js: Option<String>,
) -> Result<InstallResult, String> {
    let client = CfClient {
        account_id: creds.account_id.clone(),
        api_token: creds.install_token.clone(),
    };
    let script_name = if creds.worker_script_name.is_empty() {
        DEFAULT_SCRIPT.to_string()
    } else {
        creds.worker_script_name.clone()
    };
    ensure_r2_bucket(&client, R2_BUCKET).await?;
    let source = worker_js.unwrap_or_else(|| EMBEDDED_WORKER_STUB.trim().to_string());
    upload_worker_script(
        &client,
        &script_name,
        &source,
        R2_BUCKET,
        &[],
        "",
    )
    .await?;
    Ok(InstallResult {
        worker_url: creds.worker_url.clone(),
        worker_script_name: script_name,
        r2_bucket: R2_BUCKET.to_string(),
        skipped: false,
        admin_relinked: false,
    })
}
