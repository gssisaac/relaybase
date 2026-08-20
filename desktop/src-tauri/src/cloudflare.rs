use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

const CF_API: &str = "https://api.cloudflare.com/client/v4";

#[derive(Debug, Clone)]
pub struct CfClient {
    pub account_id: String,
    pub api_token: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ZoneSummary {
    pub id: String,
    pub name: String,
    pub status: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TokenVerifyResult {
    pub ok: bool,
    pub account_id: String,
    pub message: String,
}

async fn cf_request(
    client: &CfClient,
    method: reqwest::Method,
    path: &str,
    body: Option<Value>,
) -> Result<Value, String> {
    let url = format!("{CF_API}{path}");
    let http = reqwest::Client::new();
    let mut req = http
        .request(method, &url)
        .header("Authorization", format!("Bearer {}", client.api_token))
        .header("Content-Type", "application/json");
    if let Some(b) = body {
        req = req.json(&b);
    }
    let res = req.send().await.map_err(|e| e.to_string())?;
    let status = res.status();
    let value: Value = res.json().await.map_err(|e| e.to_string())?;
    if !status.is_success() || value.get("success") == Some(&Value::Bool(false)) {
        let errors = value
            .get("errors")
            .cloned()
            .unwrap_or_else(|| json!([]));
        return Err(format!("Cloudflare API error ({status}): {errors}"));
    }
    Ok(value)
}

pub async fn verify_token(
    account_id: &str,
    api_token: &str,
    scope: &str,
) -> Result<TokenVerifyResult, String> {
    let client = CfClient {
        account_id: account_id.to_string(),
        api_token: api_token.to_string(),
    };
    let value = cf_request(&client, reqwest::Method::GET, "/user/tokens/verify", None).await?;
    let status = value
        .pointer("/result/status")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    if status != "active" {
        return Ok(TokenVerifyResult {
            ok: false,
            account_id: account_id.to_string(),
            message: format!("Token status: {status}"),
        });
    }
    // Confirm account access by listing zones (limit 1)
    let zones = list_zones(&client).await?;

    // For the server token, additionally probe Email Sending access so the
    // user gets a clear error in Settings before they try to send and hit
    // [10000] Authentication error. There is no clean account-level Email
    // Sending endpoint, so we probe a zone-scoped subdomains list (needs
    // Email Sending Read). If no zones exist, fall back to active-only.
    if scope == "server" {
        let mut checked: Vec<&str> = Vec::new();
        checked.push("active");
        if !zones.is_empty() {
            checked.push("Zone Read");
        }
        if let Some(zone) = zones.first() {
            let path = format!("/zones/{}/email/sending/subdomains", zone.id);
            match cf_request(&client, reqwest::Method::GET, &path, None).await {
                Ok(_) => {
                    checked.push("Email Sending");
                }
                Err(e) => {
                    let lower = e.to_string().to_lowercase();
                    if lower.contains("10000")
                        || lower.contains("10102")
                        || lower.contains("forbidden")
                        || lower.contains("unauthorized")
                        || lower.contains("authentication")
                    {
                        return Ok(TokenVerifyResult {
                            ok: false,
                            account_id: account_id.to_string(),
                            message:
                                "Token is active but lacks Email Sending permission. \
                                 Grant Account → Email Sending → Edit and retry."
                                    .into(),
                        });
                    }
                    // Non-auth error (e.g. sending not enabled for the zone) —
                    // don't block the save; sending will surface the real error.
                }
            }
        }
        // Email Routing Rules Edit has no clean read-only probe; we can't
        // confirm it from the API. Be honest about that in the message.
        let msg = if !zones.is_empty() {
            format!(
                "Token verified ({}). Email Routing Rules Edit could not be \
                 probed — grant it in Cloudflare if you use zone routing assist.",
                checked.join(", ")
            )
        } else {
            "Token is active. No zones in this account, so Email Sending and \
             Zone Read could not be probed — grant Account → Email Sending → \
             Edit, Zone → Email Routing Rules → Edit, and Zone → Zone → Read."
                .into()
        };
        return Ok(TokenVerifyResult {
            ok: true,
            account_id: account_id.to_string(),
            message: msg,
        });
    }
    Ok(TokenVerifyResult {
        ok: true,
        account_id: account_id.to_string(),
        message: "Token verified".into(),
    })
}

/// Resolve the Cloudflare account id for a token by listing `/accounts`.
/// Used to push `CF_ACCOUNT_ID` as a Worker secret during auto-install when
/// the caller does not already know the account id.
pub async fn resolve_account_id(api_token: &str) -> Result<String, String> {
    let client = CfClient {
        account_id: String::new(),
        api_token: api_token.to_string(),
    };
    let value = cf_request(&client, reqwest::Method::GET, "/accounts?per_page=50", None).await?;
    let id = value
        .pointer("/result/0/id")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "No Cloudflare accounts accessible with this token.".to_string())?;
    Ok(id.to_string())
}

pub async fn list_zones(client: &CfClient) -> Result<Vec<ZoneSummary>, String> {
    let mut zones = Vec::new();
    let mut page = 1u32;
    loop {
        let path = format!("/zones?account.id={}&per_page=50&page={page}", client.account_id);
        let value = cf_request(client, reqwest::Method::GET, &path, None).await?;
        let result = value
            .get("result")
            .and_then(|v| v.as_array())
            .cloned()
            .unwrap_or_default();
        if result.is_empty() {
            break;
        }
        for z in result {
            zones.push(ZoneSummary {
                id: z.get("id").and_then(|v| v.as_str()).unwrap_or("").into(),
                name: z.get("name").and_then(|v| v.as_str()).unwrap_or("").into(),
                status: z
                    .get("status")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .into(),
            });
        }
        let total_pages = value
            .pointer("/result_info/total_pages")
            .and_then(|v| v.as_u64())
            .unwrap_or(1);
        if page as u64 >= total_pages {
            break;
        }
        page += 1;
    }
    Ok(zones)
}

pub async fn find_kv_namespace(client: &CfClient, title: &str) -> Result<Option<String>, String> {
    let path = format!("/accounts/{}/storage/kv/namespaces", client.account_id);
    let list = cf_request(client, reqwest::Method::GET, &format!("{path}?per_page=100"), None).await?;
    if let Some(arr) = list.get("result").and_then(|v| v.as_array()) {
        for ns in arr {
            if ns.get("title").and_then(|v| v.as_str()) == Some(title) {
                let id = ns.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string();
                if !id.is_empty() {
                    return Ok(Some(id));
                }
            }
        }
    }
    Ok(None)
}

pub async fn ensure_kv_namespace(client: &CfClient, title: &str) -> Result<String, String> {
    if let Some(id) = find_kv_namespace(client, title).await? {
        return Ok(id);
    }
    let path = format!("/accounts/{}/storage/kv/namespaces", client.account_id);
    let created = cf_request(
        client,
        reqwest::Method::POST,
        &path,
        Some(json!({ "title": title })),
    )
    .await?;
    created
        .pointer("/result/id")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .ok_or_else(|| "Failed to create KV namespace".into())
}

pub async fn find_r2_bucket(client: &CfClient, name: &str) -> Result<bool, String> {
    let path = format!("/accounts/{}/r2/buckets", client.account_id);
    let list = cf_request(client, reqwest::Method::GET, &path, None).await?;
    if let Some(arr) = list.pointer("/result/buckets").and_then(|v| v.as_array()) {
        for b in arr {
            if b.get("name").and_then(|v| v.as_str()) == Some(name) {
                return Ok(true);
            }
        }
    }
    Ok(false)
}

pub async fn ensure_r2_bucket(client: &CfClient, name: &str) -> Result<(), String> {
    if find_r2_bucket(client, name).await? {
        return Ok(());
    }
    let path = format!("/accounts/{}/r2/buckets", client.account_id);
    let _ = cf_request(
        client,
        reqwest::Method::POST,
        &path,
        Some(json!({ "name": name })),
    )
    .await?;
    Ok(())
}

/// Returns true when a Worker script with this exact name already exists.
pub async fn worker_script_exists(client: &CfClient, script_name: &str) -> Result<bool, String> {
    let path = format!(
        "/accounts/{}/workers/scripts/{script_name}",
        client.account_id
    );
    let url = format!("{CF_API}{path}");
    let http = reqwest::Client::new();
    let res = http
        .get(&url)
        .header("Authorization", format!("Bearer {}", client.api_token))
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if res.status().as_u16() == 404 {
        return Ok(false);
    }
    let status = res.status();
    let value: Value = res.json().await.map_err(|e| e.to_string())?;
    if !status.is_success() || value.get("success") == Some(&Value::Bool(false)) {
        // Some accounts return 400-style errors for missing scripts — treat as missing.
        if status.as_u16() == 400 || status.as_u16() == 404 {
            return Ok(false);
        }
        let errors = value
            .get("errors")
            .cloned()
            .unwrap_or_else(|| json!([]));
        return Err(format!("Cloudflare API error ({status}): {errors}"));
    }
    Ok(true)
}

pub async fn worker_health_ok(worker_url: &str) -> bool {
    let url = format!("{}/health", worker_url.trim_end_matches('/'));
    let http = reqwest::Client::new();
    match http.get(&url).send().await {
        Ok(res) => res.status().is_success(),
        Err(_) => false,
    }
}

pub async fn admin_auth_ok(worker_url: &str, admin_token: &str) -> bool {
    if admin_token.trim().is_empty() {
        return false;
    }
    let url = format!("{}/console/connect", worker_url.trim_end_matches('/'));
    let http = reqwest::Client::new();
    match http
        .get(&url)
        .header("Authorization", format!("Bearer {admin_token}"))
        .send()
        .await
    {
        Ok(res) => res.status().is_success(),
        Err(_) => false,
    }
}

/// Upload a Worker script (module format) with KV + R2 bindings metadata.
pub async fn upload_worker_script(
    client: &CfClient,
    script_name: &str,
    js_source: &str,
    app_kv_id: &str,
    r2_bucket: &str,
) -> Result<(), String> {
    let url = format!(
        "{CF_API}/accounts/{}/workers/scripts/{script_name}",
        client.account_id
    );
    let metadata = json!({
        "main_module": "index.js",
        "bindings": [
            { "type": "kv_namespace", "name": "RELAYBASE_APP", "namespace_id": app_kv_id },
            { "type": "r2_bucket", "name": "INBOUND", "bucket_name": r2_bucket },
            { "type": "plain_text", "name": "WORKER_SCRIPT_NAME", "text": script_name },
            { "type": "plain_text", "name": "INBOUND_BUCKET_NAME", "text": r2_bucket }
        ],
        "compatibility_date": "2025-06-01"
    });

    let form = reqwest::multipart::Form::new()
        .text("metadata", metadata.to_string())
        .part(
            "index.js",
            reqwest::multipart::Part::bytes(js_source.as_bytes().to_vec())
                .file_name("index.js")
                .mime_str("application/javascript+module")
                .map_err(|e| e.to_string())?,
        );

    let http = reqwest::Client::new();
    let res = http
        .put(&url)
        .header("Authorization", format!("Bearer {}", client.api_token))
        .multipart(form)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    let status = res.status();
    let value: Value = res.json().await.map_err(|e| e.to_string())?;
    if !status.is_success() || value.get("success") == Some(&Value::Bool(false)) {
        return Err(format!("Worker upload failed ({status}): {value}"));
    }
    Ok(())
}

pub async fn enable_workers_dev(
    client: &CfClient,
    script_name: &str,
) -> Result<String, String> {
    let path = format!(
        "/accounts/{}/workers/scripts/{script_name}/subdomain",
        client.account_id
    );
    let _ = cf_request(
        client,
        reqwest::Method::POST,
        &path,
        Some(json!({ "enabled": true })),
    )
    .await;

    // Resolve workers.dev subdomain for the account
    let sub_path = format!("/accounts/{}/workers/subdomain", client.account_id);
    let sub = cf_request(client, reqwest::Method::GET, &sub_path, None).await?;
    let subdomain = sub
        .pointer("/result/subdomain")
        .and_then(|v| v.as_str())
        .unwrap_or("workers");
    Ok(format!("https://{script_name}.{subdomain}.workers.dev"))
}

pub async fn put_worker_secret(
    client: &CfClient,
    script_name: &str,
    name: &str,
    text: &str,
) -> Result<(), String> {
    let path = format!(
        "/accounts/{}/workers/scripts/{script_name}/secrets",
        client.account_id
    );
    let _ = cf_request(
        client,
        reqwest::Method::PUT,
        &path,
        Some(json!({
            "name": name,
            "text": text,
            "type": "secret_text"
        })),
    )
    .await?;
    Ok(())
}

pub async fn bootstrap_worker(
    client: &CfClient,
    script_name: &str,
    _account_id: &str,
    _api_token: &str,
    admin_token: &str,
) -> Result<(), String> {
    // The worker no longer exposes /admin/bootstrap or /admin/cloudflare.
    // CF runtime credentials (CF_ACCOUNT_ID / CF_API_TOKEN) are delivered as
    // wrangler secrets by the install / Settings push flow — never written to
    // KV (srv:config:cloudflare was removed: storing the server token in KV
    // is risky and the Worker now reads env secrets only). Only the admin
    // token bootstrap remains in KV as a legacy fallback for requireAdmin.
    let namespace_id = resolve_worker_kv_namespace_id(client, script_name).await?;
    put_kv_value(
        client,
        &namespace_id,
        "srv:config:admin",
        &json!({ "token": admin_token }).to_string(),
    )
    .await?;
    Ok(())
}

/// Resolve the KV namespace ID bound as RELAYBASE_APP on a Worker script.
pub async fn resolve_worker_kv_namespace_id(
    client: &CfClient,
    script_name: &str,
) -> Result<String, String> {
    // Try the script settings/bindings endpoint first.
    let settings_path = format!(
        "/accounts/{}/workers/scripts/{}/settings",
        client.account_id, script_name
    );
    let settings_url = format!("{CF_API}{settings_path}");
    let http = reqwest::Client::new();
    if let Ok(res) = http
        .get(&settings_url)
        .header("Authorization", format!("Bearer {}", client.api_token))
        .send()
        .await
    {
        if res.status().is_success() {
            if let Ok(value) = res.json::<Value>().await {
                if let Some(bindings) = value.pointer("/result/bindings").and_then(|v| v.as_array())
                {
                    for b in bindings {
                        if b.get("type").and_then(|v| v.as_str()) == Some("kv_namespace")
                            && b.get("name").and_then(|v| v.as_str()) == Some("RELAYBASE_APP")
                        {
                            if let Some(id) = b.get("namespace_id").and_then(|v| v.as_str()) {
                                if !id.is_empty() {
                                    return Ok(id.to_string());
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // Fall back to looking up the namespace by title (relaybase-app).
    if let Some(id) = find_kv_namespace(client, "relaybase-app").await? {
        return Ok(id);
    }
    Err(format!(
        "Could not resolve RELAYBASE_APP KV namespace for worker `{script_name}`"
    ))
}

/// Write a string value into a KV namespace key.
pub async fn put_kv_value(
    client: &CfClient,
    namespace_id: &str,
    key: &str,
    value: &str,
) -> Result<(), String> {
    let path = format!(
        "/accounts/{}/storage/kv/namespaces/{}/values/{}",
        client.account_id,
        namespace_id,
        urlencode(key)
    );
    let url = format!("{CF_API}{path}");
    let http = reqwest::Client::new();
    let res = http
        .put(&url)
        .header("Authorization", format!("Bearer {}", client.api_token))
        .header("Content-Type", "text/plain")
        .body(value.to_string())
        .send()
        .await
        .map_err(|e| e.to_string())?;
    let status = res.status();
    let value: Value = res.json().await.map_err(|e| e.to_string())?;
    if !status.is_success() || value.get("success") == Some(&Value::Bool(false)) {
        return Err(format!("KV write failed ({status}): {value}"));
    }
    Ok(())
}

fn urlencode(s: &str) -> String {
    s.chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '-' || c == '_' || c == '.' || c == '~' {
                c.to_string()
            } else {
                format!("%{:02X}", c as u32)
            }
        })
        .collect()
}
