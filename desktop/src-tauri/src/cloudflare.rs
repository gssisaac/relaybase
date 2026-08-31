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
    let method_label = method.as_str().to_string();
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
        return Err(format!(
            "Cloudflare API error ({status}) {method_label} {path}: {errors}"
        ));
    }
    Ok(value)
}

async fn cf_get_status(client: &CfClient, path: &str) -> Result<reqwest::StatusCode, String> {
    let url = format!("{CF_API}{path}");
    let http = reqwest::Client::new();
    let res = http
        .get(&url)
        .header("Authorization", format!("Bearer {}", client.api_token))
        .send()
        .await
        .map_err(|e| e.to_string())?;
    Ok(res.status())
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

/// Cloudflare dashboard R2 overview for this account — not checkout.
/// From there the user can re-add the $0 R2 subscription if CF dropped it.
pub fn r2_dashboard_url(account_id: &str) -> String {
    format!("https://dash.cloudflare.com/{account_id}/r2")
}

pub fn r2_subscription_required_error(account_id: &str) -> String {
    format!(
        "R2_SUBSCRIPTION_REQUIRED: Cloudflare R2 is not active on this account \
         (never enabled, or the $0 subscription was removed after a few days). \
         Open {} and add R2 back, then return here and Try again.",
        r2_dashboard_url(account_id)
    )
}

pub fn is_r2_subscription_required(err: &str) -> bool {
    let lower = err.to_lowercase();
    lower.contains("r2_subscription_required")
        || lower.contains("10042")
        || lower.contains("enable r2")
        || lower.contains("r2 through the cloudflare dashboard")
        || (lower.contains("r2") && lower.contains("subscription") && lower.contains("removed"))
}

/// Fail before create/delete when this account has no R2 product.
///
/// GET `/r2/buckets` returns code **10042** when R2 was never enabled or
/// Cloudflare dropped the unused $0 subscription. A generic OAuth 403
/// (cannot list buckets) is not this — those tokens can still bind by name.
pub async fn assert_r2_subscription(client: &CfClient) -> Result<(), String> {
    let path = format!("/accounts/{}/r2/buckets", client.account_id);
    match cf_request(client, reqwest::Method::GET, &path, None).await {
        Ok(_) => Ok(()),
        Err(e) if is_r2_subscription_required(&e) => {
            Err(r2_subscription_required_error(&client.account_id))
        }
        Err(_) => Ok(()),
    }
}

pub async fn find_r2_bucket(client: &CfClient, name: &str) -> Result<bool, String> {
    // GET the named bucket — listing every bucket often 403s on OAuth install tokens.
    let path = format!("/accounts/{}/r2/buckets/{name}", client.account_id);
    match named_resource_status(client, &path).await? {
        Some(present) => return Ok(present),
        None => {}
    }
    // Last resort list. Generic 403 means the token cannot enumerate buckets;
    // treat as absent so install can still create/reuse by name. 10042 means
    // R2 itself is off — do not swallow that.
    match cf_request(
        client,
        reqwest::Method::GET,
        &format!("/accounts/{}/r2/buckets", client.account_id),
        None,
    )
    .await
    {
        Ok(list) => {
            if let Some(arr) = list.pointer("/result/buckets").and_then(|v| v.as_array()) {
                for b in arr {
                    if b.get("name").and_then(|v| v.as_str()) == Some(name) {
                        return Ok(true);
                    }
                }
            }
            Ok(false)
        }
        Err(e) if is_r2_subscription_required(&e) => {
            Err(r2_subscription_required_error(&client.account_id))
        }
        Err(e) if is_forbidden_status(&e) => Ok(false),
        Err(e) => Err(e),
    }
}

pub async fn ensure_r2_bucket(client: &CfClient, name: &str) -> Result<(), String> {
    if find_r2_bucket(client, name).await? {
        return Ok(());
    }
    let path = format!("/accounts/{}/r2/buckets", client.account_id);
    match cf_request(
        client,
        reqwest::Method::POST,
        &path,
        Some(json!({ "name": name })),
    )
    .await
    {
        Ok(_) => Ok(()),
        Err(e) if is_already_exists(&e) => Ok(()),
        Err(e) if is_r2_subscription_required(&e) => {
            Err(r2_subscription_required_error(&client.account_id))
        }
        Err(e) => Err(e),
    }
}

/// Returns true when a Worker script with this exact name already exists.
///
/// Do not GET `/workers/scripts` (account-wide list) or GET
/// `/workers/scripts/{name}` (downloads source). Cloudflare OAuth install
/// tokens (`workers-scripts.write`) return 403 on both. Settings / deployments
/// are metadata-only and 404 when the script is missing.
pub async fn worker_script_exists(client: &CfClient, script_name: &str) -> Result<bool, String> {
    for suffix in ["settings", "deployments"] {
        let path = format!(
            "/accounts/{}/workers/scripts/{script_name}/{suffix}",
            client.account_id
        );
        match named_resource_status(client, &path).await? {
            Some(present) => return Ok(present),
            None => continue,
        }
    }
    Ok(false)
}

/// 200 → Some(true), 404 → Some(false), 403/other → None (caller decides).
async fn named_resource_status(
    client: &CfClient,
    path: &str,
) -> Result<Option<bool>, String> {
    match cf_get_status(client, path).await {
        Ok(status) if status.as_u16() == 404 => Ok(Some(false)),
        Ok(status) if status.is_success() => Ok(Some(true)),
        Ok(status) if status.as_u16() == 403 => Ok(None),
        Ok(_) => Ok(None),
        Err(e) => Err(e),
    }
}

fn is_forbidden_status(err: &str) -> bool {
    let lower = err.to_lowercase();
    lower.contains("403") || lower.contains("forbidden")
}

pub async fn worker_health_ok(worker_url: &str) -> bool {
    let url = format!("{}/health", worker_url.trim_end_matches('/'));
    let http = reqwest::Client::new();
    match http.get(&url).send().await {
        Ok(res) => res.status().is_success(),
        Err(_) => false,
    }
}

/// Upload a Worker module with R2, optional D1, send_email, and plain-text vars.
/// `d1_bindings` is `(binding_name, database_uuid)`.
pub async fn upload_worker_script(
    client: &CfClient,
    script_name: &str,
    js_source: &str,
    r2_bucket: &str,
    d1_bindings: &[(&str, &str)],
    worker_version: &str,
) -> Result<(), String> {
    let url = format!(
        "{CF_API}/accounts/{}/workers/scripts/{script_name}",
        client.account_id
    );
    let mut bindings = vec![
        json!({ "type": "r2_bucket", "name": "INBOUND", "bucket_name": r2_bucket }),
        json!({ "type": "plain_text", "name": "WORKER_SCRIPT_NAME", "text": script_name }),
        json!({ "type": "plain_text", "name": "INBOUND_BUCKET_NAME", "text": r2_bucket }),
    ];
    let version = if worker_version.trim().is_empty() {
        "unknown"
    } else {
        worker_version.trim()
    };
    bindings.push(json!({
        "type": "plain_text",
        "name": "WORKER_VERSION",
        "text": version
    }));
    bindings.push(json!({ "type": "send_email", "name": "EMAIL" }));
    for (binding, id) in d1_bindings {
        if binding.is_empty() || id.is_empty() {
            continue;
        }
        bindings.push(json!({
            "type": "d1",
            "name": binding,
            "id": id,
            "database_id": id
        }));
    }
    let metadata = json!({
        "main_module": "worker.js",
        "bindings": bindings,
        "keep_bindings": ["secret_text"],
        "compatibility_date": "2025-06-01",
        "triggers": { "crons": [DEFAULT_WORKER_CRON] }
    });

    let form = reqwest::multipart::Form::new()
        .text("metadata", metadata.to_string())
        .part(
            "worker.js",
            reqwest::multipart::Part::bytes(js_source.as_bytes().to_vec())
                .file_name("worker.js")
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

/// Binding type:name pairs from script settings (OAuth-safe metadata).
pub async fn list_worker_bindings(
    client: &CfClient,
    script_name: &str,
) -> Result<Vec<(String, String)>, String> {
    let path = format!(
        "/accounts/{}/workers/scripts/{script_name}/settings",
        client.account_id
    );
    let value = cf_request(client, reqwest::Method::GET, &path, None).await?;
    let mut out = Vec::new();
    if let Some(arr) = value
        .pointer("/result/bindings")
        .or_else(|| value.get("result").and_then(|v| v.get("bindings")))
        .and_then(|v| v.as_array())
    {
        for b in arr {
            let kind = b.get("type").and_then(|v| v.as_str()).unwrap_or("?");
            let name = b.get("name").and_then(|v| v.as_str()).unwrap_or("?");
            out.push((kind.to_string(), name.to_string()));
        }
    }
    Ok(out)
}

/// Secret binding names on the script (`AUTH_PEPPER`, `CF_ACCOUNT_ID`, …).
pub async fn list_worker_secrets(
    client: &CfClient,
    script_name: &str,
) -> Result<Vec<String>, String> {
    let path = format!(
        "/accounts/{}/workers/scripts/{script_name}/secrets",
        client.account_id
    );
    let value = cf_request(client, reqwest::Method::GET, &path, None).await?;
    let mut out = Vec::new();
    if let Some(arr) = value.get("result").and_then(|v| v.as_array()) {
        for b in arr {
            if let Some(name) = b.get("name").and_then(|v| v.as_str()) {
                if !name.is_empty() {
                    out.push(name.to_string());
                }
            }
        }
    }
    Ok(out)
}

/// Audience / inbound-index cron from customer-install wrangler.toml.
pub const DEFAULT_WORKER_CRON: &str = "*/15 * * * *";

pub async fn put_worker_schedules(
    client: &CfClient,
    script_name: &str,
    cron: &str,
) -> Result<(), String> {
    let path = format!(
        "/accounts/{}/workers/scripts/{script_name}/schedules",
        client.account_id
    );
    let _ = cf_request(
        client,
        reqwest::Method::PUT,
        &path,
        Some(json!([{ "cron": cron }])),
    )
    .await?;
    Ok(())
}

/// Create a D1 database. If the name already exists, return its uuid.
pub async fn create_d1_database(client: &CfClient, name: &str) -> Result<String, String> {
    if let Some(id) = find_d1_id(client, name).await? {
        return Ok(id);
    }
    let path = format!("/accounts/{}/d1/database", client.account_id);
    match cf_request(
        client,
        reqwest::Method::POST,
        &path,
        Some(json!({ "name": name })),
    )
    .await
    {
        Ok(value) => parse_d1_uuid(&value).ok_or_else(|| {
            format!("Cloudflare created D1 {name} but the response had no uuid")
        }),
        Err(e) if is_already_exists(&e) => find_d1_id(client, name)
            .await?
            .ok_or_else(|| format!("D1 {name} already exists but could not be listed")),
        Err(e) => Err(e),
    }
}

async fn find_d1_id(client: &CfClient, name: &str) -> Result<Option<String>, String> {
    let list = list_d1_databases(client).await?;
    Ok(list
        .into_iter()
        .find(|(n, _)| n == name)
        .map(|(_, id)| id))
}

fn parse_d1_uuid(value: &Value) -> Option<String> {
    value
        .pointer("/result/uuid")
        .or_else(|| value.pointer("/result/id"))
        .and_then(|v| v.as_str())
        .filter(|s| s.len() >= 16)
        .map(|s| s.to_string())
}

/// Resolve `https://{script}.{subdomain}.workers.dev` for this account.
/// GET only — does not enable workers.dev or upload a script.
pub async fn account_workers_dev_url(
    client: &CfClient,
    script_name: &str,
) -> Result<String, String> {
    let sub_path = format!("/accounts/{}/workers/subdomain", client.account_id);
    let sub = cf_request(client, reqwest::Method::GET, &sub_path, None).await?;
    let subdomain = sub
        .pointer("/result/subdomain")
        .and_then(|v| v.as_str())
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .ok_or_else(|| {
            "This Cloudflare account has no workers.dev subdomain. \
             Authorize the account that already owns your Relaybase Worker."
                .to_string()
        })?;
    Ok(format!("https://{script_name}.{subdomain}.workers.dev"))
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

    account_workers_dev_url(client, script_name).await
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

/// Best-effort deletes used by install rollback. 404 / already-gone is success.
pub async fn delete_worker_script(client: &CfClient, script_name: &str) -> Result<(), String> {
    let path = format!(
        "/accounts/{}/workers/scripts/{script_name}",
        client.account_id
    );
    match cf_request(client, reqwest::Method::DELETE, &path, None).await {
        Ok(_) => Ok(()),
        Err(e) if is_not_found(&e) => Ok(()),
        Err(e) => Err(e),
    }
}

pub async fn delete_r2_bucket(client: &CfClient, name: &str) -> Result<(), String> {
    let path = format!("/accounts/{}/r2/buckets/{name}", client.account_id);
    match cf_request(client, reqwest::Method::DELETE, &path, None).await {
        Ok(_) => Ok(()),
        Err(e) if is_not_found(&e) => Ok(()),
        Err(e) => Err(e),
    }
}

pub async fn delete_d1_database(client: &CfClient, database_id: &str) -> Result<(), String> {
    let path = format!(
        "/accounts/{}/d1/database/{database_id}",
        client.account_id
    );
    match cf_request(client, reqwest::Method::DELETE, &path, None).await {
        Ok(_) => Ok(()),
        Err(e) if is_not_found(&e) => Ok(()),
        Err(e) => Err(e),
    }
}

/// Returns `(name, uuid)` for every D1 database in the account.
pub async fn list_d1_databases(client: &CfClient) -> Result<Vec<(String, String)>, String> {
    let path = format!("/accounts/{}/d1/database", client.account_id);
    let value = cf_request(client, reqwest::Method::GET, &path, None).await?;
    let mut out = Vec::new();
    if let Some(rows) = value.get("result").and_then(|v| v.as_array()) {
        for row in rows {
            let name = row.get("name").and_then(|v| v.as_str()).unwrap_or("");
            let id = row
                .get("uuid")
                .or_else(|| row.get("id"))
                .and_then(|v| v.as_str())
                .unwrap_or("");
            if !name.is_empty() && !id.is_empty() {
                out.push((name.to_string(), id.to_string()));
            }
        }
    }
    Ok(out)
}

/// How many objects / rows a resource holds. Used to refuse accidental wipes.
#[derive(Debug, Clone, Copy)]
pub struct ResourceOccupancy {
    pub count: u64,
    pub truncated: bool,
    pub occupied: bool,
    /// Listing/query failed — treat as occupied (fail closed).
    pub unknown: bool,
}

impl ResourceOccupancy {
    pub fn empty() -> Self {
        Self {
            count: 0,
            truncated: false,
            occupied: false,
            unknown: false,
        }
    }

    pub fn unknown_occupied() -> Self {
        Self {
            count: 0,
            truncated: false,
            occupied: true,
            unknown: true,
        }
    }
}

/// Stop counting after this many R2 objects so install probe stays fast.
const R2_COUNT_CAP: u64 = 5_000;

fn r2_list_objects(value: &Value) -> Vec<Value> {
    value
        .pointer("/result/objects")
        .and_then(|v| v.as_array())
        .cloned()
        .or_else(|| value.get("result").and_then(|v| v.as_array()).cloned())
        .unwrap_or_default()
}

fn r2_list_cursor(value: &Value) -> Option<String> {
    value
        .pointer("/result/cursor")
        .and_then(|v| v.as_str())
        .or_else(|| value.pointer("/result_info/cursor").and_then(|v| v.as_str()))
        .map(|s| s.to_string())
}

fn r2_list_truncated(value: &Value) -> bool {
    value
        .pointer("/result/truncated")
        .and_then(|v| v.as_bool())
        .unwrap_or(false)
}

/// Count objects in an R2 bucket (capped). Fail closed when the list API errors.
pub async fn count_r2_objects(client: &CfClient, name: &str) -> ResourceOccupancy {
    let mut count = 0u64;
    let mut cursor: Option<String> = None;
    loop {
        let mut path = format!(
            "/accounts/{}/r2/buckets/{name}/objects?per_page=1000",
            client.account_id
        );
        if let Some(c) = cursor.as_ref() {
            path.push_str("&cursor=");
            path.push_str(c);
        }
        let value = match cf_request(client, reqwest::Method::GET, &path, None).await {
            Ok(v) => v,
            Err(e) if is_not_found(&e) => return ResourceOccupancy::empty(),
            Err(_) => return ResourceOccupancy::unknown_occupied(),
        };
        let objects = r2_list_objects(&value);
        count += objects.len() as u64;
        if count >= R2_COUNT_CAP {
            return ResourceOccupancy {
                count: R2_COUNT_CAP,
                truncated: true,
                occupied: true,
                unknown: false,
            };
        }
        let next = r2_list_cursor(&value);
        let truncated = r2_list_truncated(&value);
        if objects.is_empty() || !truncated || next.is_none() || next == cursor {
            break;
        }
        cursor = next;
    }
    ResourceOccupancy {
        count,
        truncated: false,
        occupied: count > 0,
        unknown: false,
    }
}

/// Run a single SQL statement against a D1 database.
pub async fn query_d1(
    client: &CfClient,
    database_id: &str,
    sql: &str,
) -> Result<Vec<Value>, String> {
    let path = format!(
        "/accounts/{}/d1/database/{database_id}/query",
        client.account_id
    );
    let value = cf_request(
        client,
        reqwest::Method::POST,
        &path,
        Some(json!({ "sql": sql })),
    )
    .await?;
    let rows = value
        .get("result")
        .and_then(|v| v.as_array())
        .and_then(|a| a.first())
        .and_then(|stmt| stmt.get("results"))
        .and_then(|r| r.as_array())
        .cloned()
        .unwrap_or_default();
    Ok(rows)
}

fn json_count(row: &Value) -> u64 {
    row.get("n")
        .or_else(|| row.get("COUNT(*)"))
        .or_else(|| row.get("count(*)"))
        .and_then(|v| {
            v.as_u64()
                .or_else(|| v.as_i64().and_then(|i| u64::try_from(i).ok()))
                .or_else(|| v.as_f64().and_then(|f| u64::try_from(f as i64).ok()))
                .or_else(|| v.as_str()?.parse::<u64>().ok())
        })
        .unwrap_or(0)
}

fn d1_table_ident_ok(name: &str) -> bool {
    !name.is_empty()
        && name
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '_')
}

/// Count rows in user tables. `d1_migrations` / sqlite internals are ignored.
/// Query failure is occupied (fail closed).
pub async fn count_d1_user_rows(client: &CfClient, database_id: &str) -> ResourceOccupancy {
    let tables = match query_d1(
        client,
        database_id,
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'",
    )
    .await
    {
        Ok(rows) => rows,
        Err(_) => return ResourceOccupancy::unknown_occupied(),
    };
    let mut total = 0u64;
    for row in tables {
        let name = row.get("name").and_then(|v| v.as_str()).unwrap_or("");
        if name.is_empty() || name == "d1_migrations" || !d1_table_ident_ok(name) {
            continue;
        }
        match query_d1(client, database_id, &format!("SELECT COUNT(*) AS n FROM \"{name}\"")).await
        {
            Ok(rows) => {
                if let Some(first) = rows.first() {
                    total += json_count(first);
                }
            }
            Err(_) => return ResourceOccupancy::unknown_occupied(),
        }
    }
    ResourceOccupancy {
        count: total,
        truncated: false,
        occupied: total > 0,
        unknown: false,
    }
}

/// Delete every object in an R2 bucket so the bucket itself can be removed.
pub async fn empty_r2_bucket(client: &CfClient, name: &str) -> Result<u32, String> {
    let mut deleted = 0u32;
    let mut cursor: Option<String> = None;
    loop {
        let mut path = format!(
            "/accounts/{}/r2/buckets/{name}/objects?per_page=1000",
            client.account_id
        );
        if let Some(c) = cursor.as_ref() {
            path.push_str("&cursor=");
            path.push_str(c);
        }
        let value = match cf_request(client, reqwest::Method::GET, &path, None).await {
            Ok(v) => v,
            Err(e) if is_not_found(&e) => return Ok(deleted),
            Err(e) => return Err(e),
        };
        let objects = r2_list_objects(&value);
        if objects.is_empty() {
            break;
        }
        for obj in &objects {
            let key = obj
                .get("key")
                .or_else(|| obj.get("name"))
                .and_then(|v| v.as_str())
                .unwrap_or("");
            if key.is_empty() {
                continue;
            }
            let encoded: String = key
                .bytes()
                .map(|b| {
                    if b.is_ascii_alphanumeric() || b == b'-' || b == b'_' || b == b'.' || b == b'~' || b == b'/' {
                        (b as char).to_string()
                    } else {
                        format!("%{:02X}", b)
                    }
                })
                .collect();
            let del_path = format!(
                "/accounts/{}/r2/buckets/{name}/objects/{encoded}",
                client.account_id
            );
            match cf_request(client, reqwest::Method::DELETE, &del_path, None).await {
                Ok(_) => deleted += 1,
                Err(e) if is_not_found(&e) => {}
                Err(e) => return Err(e),
            }
        }
        let next = r2_list_cursor(&value);
        let truncated = r2_list_truncated(&value);
        if !truncated || next.is_none() || next == cursor {
            break;
        }
        cursor = next;
    }
    Ok(deleted)
}

fn is_not_found(err: &str) -> bool {
    let lower = err.to_lowercase();
    lower.contains("404") || lower.contains("not found") || lower.contains("does not exist")
}

fn is_already_exists(err: &str) -> bool {
    let lower = err.to_lowercase();
    lower.contains("already exists")
        || lower.contains("already exist")
        || lower.contains("duplicate")
        || lower.contains("409")
        || lower.contains("code: 10004")
}
