//! Desktop notifications with an explicit Relaybase icon.
//!
//! Tauri's notification plugin attributes macOS `tauri dev` banners to
//! Terminal and cannot set a custom icon. We send via mac-notification-sys
//! with `_identityImage` pointed at ~/.relaybase/app-icon.png (seeded from
//! the bundled icon.png).

use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
#[cfg(target_os = "macos")]
use std::sync::atomic::{AtomicUsize, Ordering};

use serde::Serialize;
use tauri::AppHandle;
#[cfg(target_os = "macos")]
use tauri::Emitter;

#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;

/// Embedded at compile time so notifications always match the built icon set.
const APP_ICON_PNG: &[u8] = include_bytes!("../icons/icon.png");

#[cfg(target_os = "macos")]
const MAX_CLICK_WAITERS: usize = 8;
#[cfg(target_os = "macos")]
static CLICK_WAITERS: AtomicUsize = AtomicUsize::new(0);
static PENDING_OPEN_MAIL: Mutex<Option<OpenMailPayload>> = Mutex::new(None);

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenMailPayload {
    pub message_id: String,
    pub account: Option<String>,
}

fn home_dir() -> Result<PathBuf, String> {
    dirs::home_dir().ok_or_else(|| "Could not resolve home directory".into())
}

fn icon_path() -> Result<PathBuf, String> {
    Ok(home_dir()?.join(".relaybase").join("app-icon.png"))
}

fn nonempty(value: Option<String>) -> Option<String> {
    value.and_then(|raw| {
        let trimmed = raw.trim().to_string();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed)
        }
    })
}

#[cfg(target_os = "macos")]
fn store_and_emit_open_mail(app: &AppHandle, payload: OpenMailPayload) {
    if let Ok(mut guard) = PENDING_OPEN_MAIL.lock() {
        *guard = Some(payload.clone());
    }
    let _ = app.emit("notification-open-mail", &payload);
    crate::tray::show_main_window(app);
}

#[cfg(target_os = "macos")]
fn try_acquire_click_waiter() -> bool {
    CLICK_WAITERS
        .fetch_update(Ordering::SeqCst, Ordering::SeqCst, |n| {
            if n >= MAX_CLICK_WAITERS {
                None
            } else {
                Some(n + 1)
            }
        })
        .is_ok()
}

#[cfg(target_os = "macos")]
fn release_click_waiter() {
    CLICK_WAITERS.fetch_sub(1, Ordering::SeqCst);
}

/// Write/update `~/.relaybase/app-icon.png` from the embedded icon bytes.
pub fn ensure_notification_icon() -> Result<PathBuf, String> {
    let path = icon_path()?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| {
            format!("Failed to create {}: {e}", parent.display())
        })?;
        #[cfg(unix)]
        {
            let _ = fs::set_permissions(parent, fs::Permissions::from_mode(0o700));
        }
    }

    let needs_write = match fs::read(&path) {
        Ok(existing) => existing != APP_ICON_PNG,
        Err(_) => true,
    };
    if needs_write {
        fs::write(&path, APP_ICON_PNG).map_err(|e| {
            format!("Failed to write notification icon {}: {e}", path.display())
        })?;
        #[cfg(unix)]
        {
            let _ = fs::set_permissions(&path, fs::Permissions::from_mode(0o600));
        }
    }
    Ok(path)
}

/// Consume a notification-click payload that raced the first frontend listener.
#[tauri::command]
pub fn take_pending_open_mail() -> Option<OpenMailPayload> {
    PENDING_OPEN_MAIL.lock().ok().and_then(|mut guard| guard.take())
}

#[tauri::command]
pub async fn show_notification(
    app: AppHandle,
    title: String,
    body: String,
    message_id: Option<String>,
    account: Option<String>,
) -> Result<(), String> {
    let title = title.trim().to_string();
    let body = body.trim().to_string();
    if title.is_empty() && body.is_empty() {
        return Ok(());
    }

    let message_id = nonempty(message_id);
    let account = nonempty(account);

    #[cfg(target_os = "macos")]
    {
        let icon = ensure_notification_icon()?;
        let icon_str = icon.to_string_lossy().to_string();
        let summary = if title.is_empty() {
            "Relaybase".to_string()
        } else {
            title
        };
        let wait_for_click = message_id.is_some() && try_acquire_click_waiter();
        // Do not await: wait_for_click blocks until the user acts, and the
        // mailbox store must ack events immediately after showing the banner.
        tauri::async_runtime::spawn_blocking(move || {
            use mac_notification_sys::{Notification, NotificationResponse};
            let _ = notify_rust::set_application("com.relaybase.desktop");
            let result = Notification::new()
                .title(&summary)
                .message(&body)
                .app_icon(&icon_str)
                .wait_for_click(wait_for_click)
                .send();
            if wait_for_click {
                release_click_waiter();
            }
            match result {
                Ok(NotificationResponse::Click)
                | Ok(NotificationResponse::ActionButton(_)) => {
                    if let Some(id) = message_id {
                        store_and_emit_open_mail(
                            &app,
                            OpenMailPayload {
                                message_id: id,
                                account,
                            },
                        );
                    }
                }
                Ok(_) => {}
                Err(e) => log::warn!("show_notification failed: {e}"),
            }
        });
        return Ok(());
    }

    #[cfg(not(target_os = "macos"))]
    {
        let _ = (app, title, body, message_id, account);
        Err("Custom notifications are only implemented on macOS".into())
    }
}
