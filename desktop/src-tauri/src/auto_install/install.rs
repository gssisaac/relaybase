use std::path::Path;

use tauri::{AppHandle, Emitter};

use crate::cloudflare::{
    assert_r2_subscription, count_d1_user_rows, count_r2_objects, create_d1_database,
    delete_d1_database, delete_r2_bucket, delete_worker_script, empty_r2_bucket,
    enable_workers_dev, ensure_r2_bucket, find_r2_bucket, list_d1_databases,
    list_worker_bindings, list_worker_secrets, put_worker_schedules, put_worker_secret,
    upload_worker_script, CfClient, DEFAULT_WORKER_CRON,
};
use crate::secrets::load_credentials;
use crate::worker::DEFAULT_SCRIPT;

use super::cancel::{cancelled_error, check_cancelled, install_is_cancelled, reset_install_cancel};
use super::constants::{D1_DATABASES, R2_BUCKET};
use super::credentials::generate_auth_pepper;
use super::errors::explain_init_db_failure;
use super::health::{
    fetch_owner_configured, fetch_worker_version, log_worker_health_shape, wait_for_worker_ready,
};
use super::log::emit_log;
use super::manifest::{fetch_install_manifest, read_staged_version, stage_install_package};
use super::schema::{init_worker_db_with_retry, migrate_worker_db_with_retry};
use super::types::{AutoInstallResult, InstallDecision, InstallRunOptions, LogEvent};
use super::url::{assert_worker_update_target_matches, preview_worker_update_target};
use super::wipe::{assert_wipe_phrase, InstallPlan};

pub async fn auto_install_worker(
    app: AppHandle,
    api_token: String,
    account_id: Option<String>,
    server_token: Option<String>,
    decisions: Vec<InstallDecision>,
    wipe_confirmation: Option<String>,
) -> Result<AutoInstallResult, String> {
    reset_install_cancel();
    let api_token = api_token.trim().to_string();
    if api_token.is_empty() {
        return Err("Authorize with Cloudflare again".into());
    }
    let server_token = server_token
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty());

    let account_id = account_id
        .map(|a| a.trim().to_string())
        .filter(|a| !a.is_empty())
        .ok_or_else(|| "Authorize with Cloudflare again".to_string())?;

    let manifest = fetch_install_manifest().await?;
    let _ = app.emit(
        "install-log",
        LogEvent {
            step: "prepare".into(),
            level: "info".into(),
            line: format!(
                "Using Worker install manifest v{}",
                manifest.version.trim()
            ),
        },
    );

    let work_dir = stage_install_package(&app, &manifest).await?;
    if install_is_cancelled() {
        let _ = std::fs::remove_dir_all(&work_dir);
        return Err(cancelled_error());
    }

    let result = auto_install_steps(
        &app,
        &work_dir,
        &api_token,
        &account_id,
        server_token.as_deref(),
        &InstallPlan::from_decisions(&decisions),
        &InstallRunOptions::default(),
        read_staged_version(&work_dir),
        wipe_confirmation.as_deref(),
    )
    .await;
    let _ = std::fs::remove_dir_all(&work_dir);
    result
}

/// Re-deploy the Worker from the latest hosted install ZIP (keeps AUTH_PEPPER + D1).
pub async fn update_installed_worker(
    app: AppHandle,
    api_token: String,
    account_id: Option<String>,
    server_token: Option<String>,
) -> Result<AutoInstallResult, String> {
    reset_install_cancel();
    let api_token = api_token.trim().to_string();
    if api_token.is_empty() {
        return Err("Authorize with Cloudflare again".into());
    }
    let server_token = server_token
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty());

    let account_id = account_id
        .map(|a| a.trim().to_string())
        .filter(|a| !a.is_empty())
        .ok_or_else(|| "Authorize with Cloudflare again".to_string())?;

    let saved = load_credentials()?.unwrap_or_default();
    let expected_url = saved.worker_url.clone();
    let script = if saved.worker_script_name.trim().is_empty() {
        DEFAULT_SCRIPT
    } else {
        saved.worker_script_name.trim()
    };
    let target = preview_worker_update_target(
        &api_token,
        &account_id,
        &expected_url,
        script,
    )
    .await?;
    assert_worker_update_target_matches(&target)?;

    let manifest = fetch_install_manifest().await?;
    let work_dir = stage_install_package(&app, &manifest).await?;
    if install_is_cancelled() {
        let _ = std::fs::remove_dir_all(&work_dir);
        return Err(cancelled_error());
    }

    let mut run_opts = InstallRunOptions::default();
    run_opts.skip_auth_pepper = true;
    run_opts.worker_only = true;

    let result = auto_install_steps(
        &app,
        &work_dir,
        &api_token,
        &account_id,
        server_token.as_deref(),
        &InstallPlan::default(),
        &run_opts,
        read_staged_version(&work_dir),
        None,
    )
    .await;
    let _ = std::fs::remove_dir_all(&work_dir);
    result
}

async fn auto_install_steps(
    app: &AppHandle,
    work_dir: &Path,
    api_token: &str,
    account_id: &str,
    server_token: Option<&str>,
    plan: &InstallPlan,
    run_opts: &InstallRunOptions,
    staged_version: Option<String>,
    wipe_confirmation: Option<&str>,
) -> Result<AutoInstallResult, String> {
    check_cancelled()?;

    let client = CfClient {
        account_id: account_id.to_string(),
        api_token: api_token.to_string(),
    };

    let existing_d1 = list_d1_databases(&client).await.unwrap_or_default();

    prepare_r2(app, &client, api_token, account_id, plan, run_opts, wipe_confirmation).await?;
    check_cancelled()?;

    let (d1_ids, any_d1_reused) = prepare_d1(
        app,
        &client,
        plan,
        run_opts,
        wipe_confirmation,
        &existing_d1,
    )
    .await?;

    check_cancelled()?;
    let worker_url =
        deploy_worker(app, &client, work_dir, &d1_ids, staged_version.clone()).await?;

    let auth_pepper = apply_secrets(
        app,
        &client,
        account_id,
        run_opts,
        server_token,
        any_d1_reused,
    )
    .await?;

    wait_for_worker_ready(app, &worker_url).await?;
    log_worker_health_shape(app, &worker_url).await;

    let console_access = crate::owner_session::current_console_access_token();
    let (db_already_initialized, db_applied) = finalize_schema(
        app,
        &worker_url,
        run_opts,
        any_d1_reused,
        &auth_pepper,
        console_access.as_deref(),
        Some(api_token),
    )
    .await?;

    let worker_version = fetch_worker_version(&worker_url)
        .await
        .or(staged_version)
        .unwrap_or_else(|| "unknown".to_string());

    Ok(AutoInstallResult {
        worker_url,
        worker_script_name: DEFAULT_SCRIPT.to_string(),
        auth_pepper,
        r2_bucket: R2_BUCKET.to_string(),
        account_id: account_id.to_string(),
        d1_logs_id: d1_ids.get(0).cloned().unwrap_or_default(),
        d1_mail_id: d1_ids.get(1).cloned().unwrap_or_default(),
        d1_db_id: d1_ids.get(2).cloned().unwrap_or_default(),
        db_already_initialized,
        db_applied,
        worker_version,
    })
}

async fn prepare_r2(
    app: &AppHandle,
    client: &CfClient,
    api_token: &str,
    account_id: &str,
    plan: &InstallPlan,
    run_opts: &InstallRunOptions,
    wipe_confirmation: Option<&str>,
) -> Result<(), String> {
    if run_opts.worker_only {
        let saved = load_credentials()?.unwrap_or_default();
        let script = if saved.worker_script_name.trim().is_empty() {
            DEFAULT_SCRIPT
        } else {
            saved.worker_script_name.trim()
        };
        let target =
            preview_worker_update_target(api_token, account_id, &saved.worker_url, script).await?;
        emit_log(
            app,
            "prepare",
            "info",
            format!("Saved Worker: {}", target.expected_worker_url),
        );
        emit_log(
            app,
            "prepare",
            "info",
            format!(
                "This Cloudflare account Worker: {}",
                target.oauth_worker_url
            ),
        );
        assert_worker_update_target_matches(&target)?;
        emit_log(
            app,
            "prepare",
            "info",
            "Worker-only update — looking up existing R2 and D1 (no create or wipe).",
        );
        if !find_r2_bucket(client, R2_BUCKET).await? {
            return Err(format!(
                "R2 bucket {R2_BUCKET} is missing. Complete Setup install first."
            ));
        }
        emit_log(
            app,
            "r2",
            "info",
            format!("R2 bucket {R2_BUCKET} found — reusing"),
        );
        return Ok(());
    }

    emit_log(
        app,
        "r2",
        "info",
        "Checking that R2 is enabled on this Cloudflare account…",
    );
    assert_r2_subscription(client).await?;

    if plan.reinstall_worker {
        emit_log(
            app,
            "prepare",
            "info",
            format!("Reinstall — deleting Worker `{DEFAULT_SCRIPT}`…"),
        );
        delete_worker_script(client, DEFAULT_SCRIPT).await?;
    }

    if plan.reinstall_r2 {
        let occ = count_r2_objects(client, R2_BUCKET).await;
        if occ.occupied {
            assert_wipe_phrase(wipe_confirmation, &[R2_BUCKET])?;
        }
        emit_log(
            app,
            "r2",
            "info",
            format!("Reinstall — emptying and deleting R2 {R2_BUCKET}…"),
        );
        let _ = empty_r2_bucket(client, R2_BUCKET).await;
        delete_r2_bucket(client, R2_BUCKET).await?;
    }

    emit_log(
        app,
        "r2",
        "info",
        format!("Ensuring R2 bucket {R2_BUCKET}…"),
    );
    ensure_r2_bucket(client, R2_BUCKET).await?;
    emit_log(
        app,
        "r2",
        "info",
        format!("R2 bucket {R2_BUCKET} ready"),
    );
    Ok(())
}

async fn prepare_d1(
    app: &AppHandle,
    client: &CfClient,
    plan: &InstallPlan,
    run_opts: &InstallRunOptions,
    wipe_confirmation: Option<&str>,
    existing_d1: &[(String, String)],
) -> Result<(Vec<String>, bool), String> {
    let mut d1_ids: Vec<String> = Vec::with_capacity(D1_DATABASES.len());
    let mut any_d1_reused = false;

    for (_binding, db_name) in D1_DATABASES {
        let (db_id, log_ready) = if run_opts.worker_only {
            match existing_d1.iter().find(|(n, _)| n == db_name) {
                Some((_, id)) => {
                    any_d1_reused = true;
                    emit_log(
                        app,
                        "d1",
                        "info",
                        format!("D1 {db_name} found — reusing (id {id})"),
                    );
                    (id.clone(), true)
                }
                None => {
                    return Err(format!(
                        "D1 {db_name} is missing. Complete Setup install first."
                    ));
                }
            }
        } else if plan.should_reinstall_d1(db_name) {
            if let Some((_, id)) = existing_d1.iter().find(|(n, _)| n == db_name) {
                let occ = count_d1_user_rows(client, id).await;
                if occ.occupied {
                    assert_wipe_phrase(wipe_confirmation, &[db_name])?;
                }
                emit_log(
                    app,
                    "d1",
                    "info",
                    format!("Reinstall — deleting D1 {db_name}…"),
                );
                delete_d1_database(client, id).await?;
            }
            emit_log(app, "d1", "info", format!("Creating D1 {db_name}…"));
            (create_d1_database(client, db_name).await?, true)
        } else if let Some((_, id)) = existing_d1.iter().find(|(n, _)| n == db_name) {
            // User chose Skip in Setup — reuse silently (no "skipping create" noise).
            any_d1_reused = true;
            (id.clone(), false)
        } else {
            emit_log(app, "d1", "info", format!("Creating D1 {db_name}…"));
            (create_d1_database(client, db_name).await?, true)
        };
        check_cancelled()?;
        if log_ready {
            emit_log(
                app,
                "d1",
                "info",
                format!("D1 {db_name} ready (id {db_id}) — schema via Worker init-db or migrate-db"),
            );
        }
        if db_id.trim().is_empty() {
            return Err(format!(
                "D1 {db_name} has no database id — cannot bind it to the Worker."
            ));
        }
        d1_ids.push(db_id);
    }

    Ok((d1_ids, any_d1_reused))
}

async fn deploy_worker(
    app: &AppHandle,
    client: &CfClient,
    work_dir: &Path,
    d1_ids: &[String],
    staged_version: Option<String>,
) -> Result<String, String> {
    let js_path = work_dir.join("worker.js");
    let js_source = std::fs::read_to_string(&js_path)
        .map_err(|e| format!("read staged worker.js: {e}"))?;
    let version = staged_version.unwrap_or_else(|| "unknown".into());
    let d1_for_upload: Vec<(&str, &str)> = D1_DATABASES
        .iter()
        .zip(d1_ids.iter())
        .map(|((binding, _), id)| (*binding, id.as_str()))
        .collect();
    emit_log(
        app,
        "deploy",
        "info",
        format!("Uploading Worker `{DEFAULT_SCRIPT}`…"),
    );
    upload_worker_script(
        client,
        DEFAULT_SCRIPT,
        &js_source,
        R2_BUCKET,
        &d1_for_upload,
        &version,
    )
    .await?;
    match list_worker_bindings(client, DEFAULT_SCRIPT).await {
        Ok(bindings) => {
            let summary = if bindings.is_empty() {
                "(none)".into()
            } else {
                bindings
                    .iter()
                    .map(|(kind, name)| format!("{kind}:{name}"))
                    .collect::<Vec<_>>()
                    .join(", ")
            };
            emit_log(app, "deploy", "info", format!("Worker bindings: {summary}"));
            let d1_bound = D1_DATABASES
                .iter()
                .filter(|(binding, _)| {
                    bindings
                        .iter()
                        .any(|(kind, name)| kind == "d1" && name == *binding)
                })
                .count();
            if d1_bound < D1_DATABASES.len() {
                return Err(format!(
                    "Worker uploaded but D1 bindings are missing ({d1_bound}/{}). \
                     Same-account D1 does not need extra Worker permissions — the \
                     script upload did not attach RELAYBASE_DB / LOGS / MAIL.",
                    D1_DATABASES.len()
                ));
            }
            let email_bound = bindings
                .iter()
                .any(|(kind, name)| kind == "send_email" && name == "EMAIL");
            if !email_bound {
                emit_log(
                    app,
                    "deploy",
                    "info",
                    "send_email:EMAIL binding was not reported after upload. \
                     Sending falls back to the CF_API_TOKEN REST API until the next deploy.",
                );
            }
        }
        Err(e) => emit_log(
            app,
            "deploy",
            "info",
            format!("Could not list Worker bindings after upload: {e}"),
        ),
    }
    if let Err(e) = put_worker_schedules(client, DEFAULT_SCRIPT, DEFAULT_WORKER_CRON).await {
        emit_log(
            app,
            "deploy",
            "stderr",
            format!("Could not set Worker cron ({DEFAULT_WORKER_CRON}): {e}"),
        );
    }
    let worker_url = enable_workers_dev(client, DEFAULT_SCRIPT).await?;
    emit_log(
        app,
        "deploy",
        "info",
        format!("Deployed at {worker_url}"),
    );
    Ok(worker_url)
}

async fn apply_secrets(
    app: &AppHandle,
    client: &CfClient,
    account_id: &str,
    run_opts: &InstallRunOptions,
    server_token: Option<&str>,
    any_d1_reused: bool,
) -> Result<String, String> {
    let existing_secrets = list_worker_secrets(client, DEFAULT_SCRIPT)
        .await
        .unwrap_or_default();
    let has_pepper = existing_secrets.iter().any(|n| n == "AUTH_PEPPER");
    // Reuse D1 / Worker update must not rotate a live pepper. If the secret
    // is missing, login HMAC is an empty key — always PUT in that case.
    let skip_pepper = (run_opts.skip_auth_pepper || any_d1_reused) && has_pepper;
    let auth_pepper = if skip_pepper {
        String::new()
    } else if let Some(existing) = run_opts.existing_auth_pepper.as_ref() {
        existing.clone()
    } else {
        generate_auth_pepper()
    };
    if !skip_pepper {
        put_worker_secret(client, DEFAULT_SCRIPT, "AUTH_PEPPER", &auth_pepper).await?;
        emit_log(app, "secret", "info", "AUTH_PEPPER secret set");
    } else {
        emit_log(
            app,
            "secret",
            "info",
            "AUTH_PEPPER unchanged — reusing existing secret",
        );
    }

    put_worker_secret(client, DEFAULT_SCRIPT, "CF_ACCOUNT_ID", account_id).await?;
    emit_log(app, "secret", "info", "CF_ACCOUNT_ID secret set");

    if let Some(server) = server_token {
        put_worker_secret(client, DEFAULT_SCRIPT, "CF_API_TOKEN", server).await?;
        emit_log(
            app,
            "secret",
            "info",
            "CF_API_TOKEN secret set (server token)",
        );
    } else {
        emit_log(
            app,
            "secret",
            "info",
            "CF_API_TOKEN skipped — set the server token (Email Sending Edit) in Settings to enable sending.",
        );
    }

    Ok(auth_pepper)
}

async fn finalize_schema(
    app: &AppHandle,
    worker_url: &str,
    run_opts: &InstallRunOptions,
    any_d1_reused: bool,
    auth_pepper: &str,
    access_token: Option<&str>,
    cf_access_token: Option<&str>,
) -> Result<(bool, Vec<String>), String> {
    let owner_configured = fetch_owner_configured(worker_url).await.unwrap_or(false);
    let console_access = access_token.filter(|t| !t.trim().is_empty());
    let cf_access = cf_access_token.filter(|t| !t.trim().is_empty());
    if owner_configured && console_access.is_none() && cf_access.is_none() {
        emit_log(
            app,
            "migrate-db",
            "stderr",
            "Owner already configured — migrate-db requires a signed-in console session or Cloudflare OAuth.",
        );
        return Err(
            "OWNER_ALREADY_CONFIGURED: Authorize with Cloudflare again so Setup can finish the upgrade."
                .into(),
        );
    }

    let use_migrate = run_opts.worker_only || any_d1_reused;
    let pepper = if auth_pepper.is_empty() {
        None
    } else {
        Some(auth_pepper)
    };
    let init = if use_migrate {
        migrate_worker_db_with_retry(app, worker_url, pepper, console_access, cf_access).await
    } else {
        init_worker_db_with_retry(app, worker_url, pepper, console_access, cf_access).await
    };
    let step = if use_migrate { "migrate-db" } else { "init-db" };
    match init {
        Ok(r) => {
            emit_log(
                app,
                step,
                "info",
                if use_migrate {
                    if r.applied.is_empty() {
                        "D1 schema up to date — existing data kept".to_string()
                    } else {
                        format!("D1 pending migrations applied ({})", r.applied.len())
                    }
                } else {
                    format!("D1 schema initialized ({} migrations applied)", r.applied.len())
                },
            );
            Ok((use_migrate || r.already_initialized, r.applied))
        }
        Err(e) => {
            if owner_configured && cf_access.is_some() && is_schema_auth_skip(&e) {
                emit_log(
                    app,
                    step,
                    "info",
                    "Owner already configured — Cloudflare OAuth deploy succeeded; \
                     this Worker build does not accept OAuth for migrate-db. \
                     Script is updated; sign in later to apply pending migrations.",
                );
                return Ok((true, Vec::new()));
            }
            emit_log(
                app,
                step,
                "stderr",
                format!("Worker {step} call failed: {e}"),
            );
            Err(explain_init_db_failure(&e))
        }
    }
}

fn is_schema_auth_skip(err: &str) -> bool {
    let lower = err.to_lowercase();
    lower.contains("401")
        || lower.contains("unauthorized")
        || lower.contains("owner already configured")
}
