use tauri::AppHandle;

use crate::cloudflare::{
    delete_d1_database, delete_r2_bucket, delete_worker_script, empty_r2_bucket,
    list_d1_databases, CfClient,
};
use crate::worker::DEFAULT_SCRIPT;

use super::constants::{D1_DATABASES, R2_BUCKET};
use super::log::emit_log;
use super::probe::probe_install_resources;
use super::types::InstallResourceProbe;
use super::wipe::{assert_occupied_wipe_allowed, wipe_confirmation_allows};

/// Delete every Relaybase install resource in the account (Worker, D1, R2).
/// Streams the same `install-log` events as auto-install.
/// Occupied R2 / D1 require `wipe_confirmation` (`DELETE ME` or a resource name).
pub async fn rollback_all_install(
    app: AppHandle,
    api_token: String,
    account_id: Option<String>,
    wipe_confirmation: Option<String>,
) -> Result<(), String> {
    let api_token = api_token.trim().to_string();
    if api_token.is_empty() {
        return Err("Authorize with Cloudflare again".into());
    }
    emit_log(
        &app,
        "rollback",
        "info",
        "Starting rollback — removing Worker, D1, and R2…",
    );
    let account_id = account_id
        .map(|a| a.trim().to_string())
        .filter(|a| !a.is_empty())
        .ok_or_else(|| "Authorize with Cloudflare again".to_string())?;
    let client = CfClient {
        account_id: account_id.clone(),
        api_token: api_token.clone(),
    };

    emit_log(
        &app,
        "rollback",
        "info",
        "Checking for existing mail and database data before deleting…",
    );
    match probe_install_resources(api_token.clone(), Some(account_id.clone())).await {
        Ok(probe) => {
            let occupied: Vec<&InstallResourceProbe> =
                probe.resources.iter().filter(|r| r.occupied).collect();
            assert_occupied_wipe_allowed(&occupied, wipe_confirmation.as_deref())?;
            for r in &occupied {
                emit_log(
                    &app,
                    "rollback",
                    "info",
                    format!(
                        "Occupied {} `{}` — wipe confirmation accepted",
                        r.kind, r.name
                    ),
                );
            }
        }
        Err(e) => {
            if !wipe_confirmation_allows(
                wipe_confirmation.as_deref(),
                &[DEFAULT_SCRIPT, R2_BUCKET],
            ) {
                return Err(format!(
                    "Could not check existing data before rollback: {e}. Type DELETE ME or {DEFAULT_SCRIPT} to force wipe."
                ));
            }
            emit_log(
                &app,
                "rollback",
                "stderr",
                format!("Occupancy probe failed ({e}); proceeding after typed confirmation"),
            );
        }
    }

    emit_log(
        &app,
        "rollback",
        "info",
        format!("Deleting Worker `{DEFAULT_SCRIPT}`…"),
    );
    match delete_worker_script(&client, DEFAULT_SCRIPT).await {
        Ok(()) => emit_log(
            &app,
            "rollback",
            "info",
            format!("Deleted Worker `{DEFAULT_SCRIPT}`"),
        ),
        Err(e) => emit_log(&app, "rollback", "stderr", format!("Worker delete: {e}")),
    }

    emit_log(&app, "rollback", "info", "Looking up D1 databases…");
    let d1_wanted: Vec<&str> = D1_DATABASES.iter().map(|(_, name)| *name).collect();
    match list_d1_databases(&client).await {
        Ok(all) => {
            let mut found = 0u32;
            for (name, id) in all {
                if !d1_wanted.contains(&name.as_str()) {
                    continue;
                }
                found += 1;
                emit_log(
                    &app,
                    "rollback",
                    "info",
                    format!("Deleting D1 {name} ({id})…"),
                );
                match delete_d1_database(&client, &id).await {
                    Ok(()) => emit_log(&app, "rollback", "info", format!("Deleted D1 {name}")),
                    Err(e) => {
                        emit_log(&app, "rollback", "stderr", format!("D1 {name} delete: {e}"))
                    }
                }
            }
            if found == 0 {
                emit_log(&app, "rollback", "info", "No Relaybase D1 databases found");
            }
        }
        Err(e) => emit_log(&app, "rollback", "stderr", format!("D1 list failed: {e}")),
    }

    emit_log(
        &app,
        "rollback",
        "info",
        format!("Emptying R2 bucket {R2_BUCKET}…"),
    );
    match empty_r2_bucket(&client, R2_BUCKET).await {
        Ok(n) => emit_log(
            &app,
            "rollback",
            "info",
            format!("Removed {n} object(s) from {R2_BUCKET}"),
        ),
        Err(e) => emit_log(&app, "rollback", "stderr", format!("R2 empty: {e}")),
    }
    emit_log(
        &app,
        "rollback",
        "info",
        format!("Deleting R2 bucket {R2_BUCKET}…"),
    );
    match delete_r2_bucket(&client, R2_BUCKET).await {
        Ok(()) => emit_log(
            &app,
            "rollback",
            "info",
            format!("Deleted R2 bucket {R2_BUCKET}"),
        ),
        Err(e) => emit_log(&app, "rollback", "stderr", format!("R2 delete: {e}")),
    }

    emit_log(&app, "rollback", "info", "Rollback finished.");
    Ok(())
}
