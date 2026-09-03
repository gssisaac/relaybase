use serde::Serialize;
use tauri::AppHandle;

use super::files::{
    open_file_path_inner, open_local_file_with_default_app_inner, open_url_in_os_browser,
    reveal_file_in_folder_inner, save_download_file_inner,
};
use super::notify::{self, OpenMailPayload};
use super::tray;

#[derive(Serialize)]
pub struct DesktopInfo {
    pub version: String,
    pub os: String,
    pub arch: String,
}

#[tauri::command]
pub fn get_desktop_info() -> DesktopInfo {
    DesktopInfo {
        version: env!("CARGO_PKG_VERSION").into(),
        os: std::env::consts::OS.into(),
        arch: std::env::consts::ARCH.into(),
    }
}

#[tauri::command]
pub fn open_external_url(url: String) -> Result<(), String> {
    open_url_in_os_browser(&url)
}

#[tauri::command]
pub fn open_local_file_with_default_app(
    name: String,
    base64_data: String,
) -> Result<(), String> {
    open_local_file_with_default_app_inner(&name, &base64_data)
}

#[tauri::command]
pub fn save_download_file(name: String, base64_data: String) -> Result<String, String> {
    save_download_file_inner(&name, &base64_data)
}

#[tauri::command]
pub fn open_file_path(path: String) -> Result<(), String> {
    open_file_path_inner(&path)
}

#[tauri::command]
pub fn reveal_file_in_folder(path: String) -> Result<(), String> {
    reveal_file_in_folder_inner(&path)
}

#[tauri::command]
pub async fn show_notification(
    app: AppHandle,
    title: String,
    body: String,
    message_id: Option<String>,
    account: Option<String>,
) -> Result<(), String> {
    notify::show_notification(app, title, body, message_id, account).await
}

#[tauri::command]
pub fn take_pending_open_mail() -> Option<OpenMailPayload> {
    notify::take_pending_open_mail()
}

#[tauri::command]
pub fn set_tray_unread(app: AppHandle, has_unread: bool) -> Result<(), String> {
    tray::set_tray_unread(app, has_unread)
}
