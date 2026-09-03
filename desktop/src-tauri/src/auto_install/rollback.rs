use tauri::AppHandle;

use crate::cloudflare::{
    delete_d1_database, delete_r2_bucket, delete_worker_script, empty_r2_bucket, find_d1_id,
    find_r2_bucket, worker_script_exists, CfClient,
};
use crate::cloudflare::worker::DEFAULT_SCRIPT;

use super::constants::{D1_DATABASES, R2_BUCKET};
use super::log::emit_log;
use super::probe::probe_install_resources;
use super::types::InstallResourceProbe;
use super::wipe::{assert_occupied_wipe_allowed, wipe_confirmation_allows};

/// Delete every Relaybase install resource in the account (Worker, D1, R2).
/// Streams the same `install-log` events as auto-install.
/// Occupied R2 / D1 require `wipe_confirmation` (`DELETE ME` or a resource name).
/// Returns an error if any resource is still present after delete attempts.
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

    let mut failures: Vec<String> = Vec::new();

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
        Err(e) => {
            let msg = format!("Worker delete: {e}");
            emit_log(&app, "rollback", "stderr", msg.clone());
            failures.push(msg);
        }
    }

    for (_, name) in D1_DATABASES {
        emit_log(
            &app,
            "rollback",
            "info",
            format!("Looking up D1 {name}…"),
        );
        match find_d1_id(&client, name).await {
            Ok(Some(id)) => {
                emit_log(
                    &app,
                    "rollback",
                    "info",
                    format!("Deleting D1 {name} ({id})…"),
                );
                match delete_d1_database(&client, &id).await {
                    Ok(()) => emit_log(
                        &app,
                        "rollback",
                        "info",
                        format!("Deleted D1 {name}"),
                    ),
                    Err(e) => {
                        let msg = format!("D1 {name} delete: {e}");
                        emit_log(&app, "rollback", "stderr", msg.clone());
                        failures.push(msg);
                    }
                }
            }
            Ok(None) => emit_log(
                &app,
                "rollback",
                "info",
                format!("D1 {name} not found — skipping"),
            ),
            Err(e) => {
                let msg = format!("D1 {name} lookup: {e}");
                emit_log(&app, "rollback", "stderr", msg.clone());
                failures.push(msg);
            }
        }
    }

    let mut r2_deleted = false;
    match find_r2_bucket(&client, R2_BUCKET).await {
        Ok(true) => {
            if let Err(e) = empty_and_delete_r2(&app, &client).await {
                emit_log(&app, "rollback", "stderr", e.clone());
                emit_log(
                    &app,
                    "rollback",
                    "info",
                    "Retrying R2 empty and delete once…",
                );
                if let Err(retry) = empty_and_delete_r2(&app, &client).await {
                    emit_log(&app, "rollback", "stderr", retry.clone());
                    failures.push(retry);
                } else {
                    r2_deleted = true;
                }
            } else {
                r2_deleted = true;
            }
        }
        Ok(false) => {
            emit_log(
                &app,
                "rollback",
                "info",
                format!("R2 bucket {R2_BUCKET} not found — skipping"),
            );
            r2_deleted = true;
        }
        Err(e) => {
            let msg = format!("R2 lookup: {e}");
            emit_log(&app, "rollback", "stderr", msg.clone());
            failures.push(msg);
        }
    }

    let mut remaining: Vec<String> = Vec::new();

    match worker_script_exists(&client, DEFAULT_SCRIPT).await {
        Ok(true) => remaining.push(format!("Worker `{DEFAULT_SCRIPT}`")),
        Ok(false) => {}
        Err(e) => remaining.push(format!("Worker `{DEFAULT_SCRIPT}` (could not verify: {e})")),
    }

    for (_, name) in D1_DATABASES {
        match find_d1_id(&client, name).await {
            Ok(Some(_)) => remaining.push(format!("D1 `{name}`")),
            Ok(None) => {}
            Err(e) => remaining.push(format!("D1 `{name}` (could not verify: {e})")),
        }
    }

    if !r2_deleted {
        remaining.push(format!("R2 `{R2_BUCKET}`"));
    } else {
        match find_r2_bucket(&client, R2_BUCKET).await {
            Ok(true) => remaining.push(format!("R2 `{R2_BUCKET}`")),
            Ok(false) => {}
            Err(e) => remaining.push(format!("R2 `{R2_BUCKET}` (could not verify: {e})")),
        }
    }

    if !failures.is_empty() || !remaining.is_empty() {
        let mut parts = Vec::new();
        if !remaining.is_empty() {
            parts.push(format!(
                "Rollback incomplete — still present: {}",
                remaining.join(", ")
            ));
        }
        if !failures.is_empty() {
            parts.push(failures.join("; "));
        }
        emit_log(
            &app,
            "rollback",
            "stderr",
            "Rollback did not remove every Relaybase resource.",
        );
        return Err(parts.join(". "));
    }

    emit_log(&app, "rollback", "info", "Rollback finished — account is clear.");
    Ok(())
}

async fn empty_and_delete_r2(app: &AppHandle, client: &CfClient) -> Result<(), String> {
    emit_log(
        app,
        "rollback",
        "info",
        format!("Emptying R2 bucket {R2_BUCKET}…"),
    );
    match empty_r2_bucket(client, R2_BUCKET).await {
        Ok(n) => emit_log(
            app,
            "rollback",
            "info",
            format!("Removed {n} object(s) from {R2_BUCKET}"),
        ),
        Err(e) => return Err(format!("R2 empty: {e}")),
    }
    emit_log(
        app,
        "rollback",
        "info",
        format!("Deleting R2 bucket {R2_BUCKET}…"),
    );
    delete_r2_bucket(client, R2_BUCKET)
        .await
        .map_err(|e| format!("R2 delete: {e}"))?;
    emit_log(
        app,
        "rollback",
        "info",
        format!("Deleted R2 bucket {R2_BUCKET}"),
    );
    Ok(())
}
