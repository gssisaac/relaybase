use super::owner_session::{
    owner_boot_mail as owner_boot_mail_inner,
    owner_login as owner_login_inner,
    owner_login_from_keyring as owner_login_from_keyring_inner,
    owner_logout as owner_logout_inner,
    owner_reset_admin as owner_reset_admin_inner,
    owner_session_status,
    owner_setup_admin as owner_setup_admin_inner,
    owner_unlock_console as owner_unlock_console_inner,
    worker_request as worker_request_inner,
    OwnerSessionStatus, OwnerSetupResult, WorkerRequestInput, WorkerRequestOutput,
};
use super::team_session::{
    team_forget_session as team_forget_session_inner,
    team_login as team_login_inner,
    team_logout as team_logout_inner,
    team_session_status,
    team_unlock as team_unlock_inner,
    team_worker_request as team_worker_request_inner,
    TeamSessionStatus, TeamWorkerRequestInput, TeamWorkerRequestOutput,
};
use super::touch_id;
use crate::cloudflare::require_cf_oauth_access_token;

#[tauri::command]
pub fn owner_session_status_cmd() -> Result<OwnerSessionStatus, String> {
    owner_session_status()
}

#[tauri::command]
pub async fn owner_login_cmd(
    worker_url: String,
    passtoken: String,
) -> Result<OwnerSessionStatus, String> {
    owner_login_inner(worker_url, passtoken).await
}

#[tauri::command]
pub async fn owner_boot_mail_cmd() -> Result<OwnerSessionStatus, String> {
    owner_boot_mail_inner().await
}

#[tauri::command]
pub async fn owner_unlock_console_cmd() -> Result<OwnerSessionStatus, String> {
    owner_unlock_console_inner().await
}

#[tauri::command]
pub async fn owner_logout_cmd() -> Result<(), String> {
    owner_logout_inner().await
}

#[tauri::command]
pub async fn owner_login_from_keyring_cmd(
    app: tauri::AppHandle,
    reason: String,
    worker_url: Option<String>,
) -> Result<OwnerSessionStatus, String> {
    owner_login_from_keyring_inner(app, reason, worker_url).await
}

#[tauri::command]
pub async fn owner_touch_id_cmd(app: tauri::AppHandle, reason: String) -> Result<(), String> {
    touch_id::authenticate(app, reason).await
}

#[tauri::command]
pub async fn owner_setup_admin_cmd(
    worker_url: String,
    pepper: String,
) -> Result<OwnerSetupResult, String> {
    owner_setup_admin_inner(worker_url, pepper).await
}

#[tauri::command]
pub async fn owner_reset_admin_cmd(
    worker_url: String,
    cf_access_token: String,
) -> Result<OwnerSetupResult, String> {
    let _ = cf_access_token;
    let access_token = require_cf_oauth_access_token().await?;
    owner_reset_admin_inner(worker_url, access_token).await
}

#[tauri::command]
pub async fn worker_request_cmd(input: WorkerRequestInput) -> Result<WorkerRequestOutput, String> {
    worker_request_inner(input).await
}

#[tauri::command]
pub fn team_session_status_cmd() -> Result<TeamSessionStatus, String> {
    team_session_status()
}

#[tauri::command]
pub async fn team_login_cmd(
    worker_url: String,
    account_email: String,
    mobile_password: String,
) -> Result<TeamSessionStatus, String> {
    team_login_inner(worker_url, account_email, mobile_password).await
}

#[tauri::command]
pub async fn team_unlock_cmd() -> Result<TeamSessionStatus, String> {
    team_unlock_inner().await
}

#[tauri::command]
pub async fn team_logout_cmd() -> Result<(), String> {
    team_logout_inner().await
}

#[tauri::command]
pub async fn team_forget_session_cmd() -> Result<TeamSessionStatus, String> {
    team_forget_session_inner().await
}

#[tauri::command]
pub async fn team_worker_request_cmd(
    input: TeamWorkerRequestInput,
) -> Result<TeamWorkerRequestOutput, String> {
    team_worker_request_inner(input).await
}
