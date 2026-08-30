use crate::cloudflare::{
    account_workers_dev_url, assert_r2_subscription, count_d1_user_rows, count_r2_objects,
    find_r2_bucket, list_d1_databases, worker_script_exists, CfClient,
};
use crate::worker::DEFAULT_SCRIPT;

use super::constants::{D1_DATABASES, R2_BUCKET};
use super::types::{InstallProbeResult, InstallResourceProbe};

pub async fn probe_install_resources(
    api_token: String,
    account_id: Option<String>,
) -> Result<InstallProbeResult, String> {
    let api_token = api_token.trim().to_string();
    if api_token.is_empty() {
        return Err("Authorize with Cloudflare again".into());
    }
    let account_id = account_id
        .map(|a| a.trim().to_string())
        .filter(|a| !a.is_empty())
        .ok_or_else(|| "Authorize with Cloudflare again".to_string())?;
    let client = CfClient {
        account_id: account_id.clone(),
        api_token: api_token.clone(),
    };
    assert_r2_subscription(&client).await?;

    let mut resources = Vec::new();
    // OAuth write tokens often 403 on account-wide lists. Existence helpers
    // already treat that as "not present" so first-time install can proceed.
    let worker_present = worker_script_exists(&client, DEFAULT_SCRIPT).await?;
    resources.push(InstallResourceProbe::base(
        "worker",
        DEFAULT_SCRIPT,
        worker_present,
        "",
    ));
    let r2_present = find_r2_bucket(&client, R2_BUCKET).await?;
    let mut r2 = InstallResourceProbe::base("r2", R2_BUCKET, r2_present, "");
    if r2_present {
        let occ = count_r2_objects(&client, R2_BUCKET).await;
        r2.object_count = if occ.unknown { None } else { Some(occ.count) };
        r2.truncated = occ.truncated;
        r2.occupied = occ.occupied;
    }
    resources.push(r2);
    let d1_list = match list_d1_databases(&client).await {
        Ok(v) => v,
        Err(_) => Vec::new(),
    };
    for (_binding, name) in D1_DATABASES {
        let id = d1_list
            .iter()
            .find(|(n, _)| n == name)
            .map(|(_, id)| id.clone())
            .unwrap_or_default();
        let mut d1 = InstallResourceProbe::base("d1", *name, !id.is_empty(), id.clone());
        if !id.is_empty() {
            let occ = count_d1_user_rows(&client, &id).await;
            d1.row_count = if occ.unknown { None } else { Some(occ.count) };
            d1.truncated = occ.truncated;
            d1.occupied = occ.occupied;
        }
        resources.push(d1);
    }
    let workers_dev_url = if worker_present {
        account_workers_dev_url(&client, DEFAULT_SCRIPT)
            .await
            .ok()
            .filter(|u| !u.trim().is_empty())
    } else {
        None
    };

    Ok(InstallProbeResult {
        account_id,
        workers_dev_url,
        resources,
    })
}
