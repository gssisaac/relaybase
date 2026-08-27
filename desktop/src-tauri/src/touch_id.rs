//! Touch ID / device-password prompt on the AppKit main thread.
//!
//! `tauri-plugin-biometry` evaluates `LAContext` on a worker thread, which
//! macOS interrupts with `systemCancel`. Start the policy on the main thread
//! and complete via the reply callback (do not block the run loop).

#[cfg(target_os = "macos")]
mod macos {
    use block2::RcBlock;
    use objc2::runtime::Bool;
    use objc2_foundation::{NSError, NSString};
    use objc2_local_authentication::{LAContext, LAError, LAPolicy};
    use std::sync::Mutex;
    use tauri::{AppHandle, Manager};

    fn error_name(code: LAError) -> &'static str {
        match code {
            LAError::UserCancel => "userCancel",
            LAError::AppCancel => "appCancel",
            LAError::SystemCancel => "systemCancel",
            LAError::UserFallback => "userFallback",
            LAError::AuthenticationFailed => "authenticationFailed",
            LAError::PasscodeNotSet => "passcodeNotSet",
            LAError::BiometryNotAvailable => "biometryNotAvailable",
            LAError::BiometryNotEnrolled => "biometryNotEnrolled",
            LAError::BiometryLockout => "biometryLockout",
            _ => "unknown",
        }
    }

    fn start(
        reason: String,
        tx: tokio::sync::oneshot::Sender<Result<(), String>>,
    ) -> Result<(), String> {
        let context = unsafe { LAContext::new() };
        unsafe {
            context.setTouchIDAuthenticationAllowableReuseDuration(0.0);
            let cancel = NSString::from_str("Cancel");
            context.setLocalizedCancelTitle(Some(&cancel));
            let fallback = NSString::from_str("Use device password");
            context.setLocalizedFallbackTitle(Some(&fallback));
        }
        let reason_str = NSString::from_str(&reason);
        let tx = Mutex::new(Some(tx));
        let block = RcBlock::new(move |success: Bool, error_ptr: *mut NSError| {
            let result = if success.as_bool() {
                Ok(())
            } else if !error_ptr.is_null() {
                let error = unsafe { &*error_ptr };
                let description = error.localizedDescription().to_string();
                let code = LAError(error.code());
                Err(format!("[{}] - {description}", error_name(code)))
            } else {
                Err("Authentication failed.".into())
            };
            if let Ok(mut slot) = tx.lock() {
                if let Some(tx) = slot.take() {
                    let _ = tx.send(result);
                }
            }
        });
        unsafe {
            context.evaluatePolicy_localizedReason_reply(
                LAPolicy::DeviceOwnerAuthentication,
                &reason_str,
                &block,
            );
        }
        // Reply is async; keep the context alive until macOS drops it.
        std::mem::forget(context);
        Ok(())
    }

    pub async fn authenticate(app: AppHandle, reason: String) -> Result<(), String> {
        // LAContext replies systemCancel unless this window is key.
        if let Some(window) = app.get_webview_window("main") {
            let _ = window.set_focus();
        }
        tokio::time::sleep(std::time::Duration::from_millis(80)).await;

        let (tx, rx) = tokio::sync::oneshot::channel();
        app.run_on_main_thread(move || {
            if let Err(err) = start(reason, tx) {
                // oneshot already moved into start; nothing to send
                let _ = err;
            }
        })
        .map_err(|e| e.to_string())?;
        rx.await
            .unwrap_or_else(|_| Err("[systemCancel] - Authentication canceled.".into()))
    }
}

#[cfg(not(target_os = "macos"))]
mod other {
    use tauri::AppHandle;

    pub async fn authenticate(_app: AppHandle, reason: String) -> Result<(), String> {
        #[cfg(target_os = "windows")]
        {
            use tauri_plugin_biometry::{AuthOptions, BiometryExt};
            let app = _app;
            let opts = AuthOptions {
                allow_device_credential: Some(true),
                cancel_title: Some("Cancel".into()),
                fallback_title: Some("Use device password".into()),
                title: Some("Unlock Relaybase".into()),
                subtitle: Some(reason.clone()),
                confirmation_required: Some(false),
            };
            return tauri::async_runtime::spawn_blocking(move || {
                app.biometry()
                    .authenticate(reason, opts)
                    .map_err(|e| e.to_string())
            })
            .await
            .map_err(|e| e.to_string())?;
        }
        #[cfg(not(target_os = "windows"))]
        {
            let _ = reason;
            Err("Biometry is not available on this platform.".into())
        }
    }
}

#[cfg(target_os = "macos")]
pub use macos::authenticate;
#[cfg(not(target_os = "macos"))]
pub use other::authenticate;
