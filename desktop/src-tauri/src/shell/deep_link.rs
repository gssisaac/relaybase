use tauri_plugin_deep_link::DeepLinkExt;

use crate::cloudflare::loopback::{
    complete_cf_oauth_inner, emit_oauth_result, parse_oauth_callback_url,
    run_oauth_loopback_server,
};

/// Deep-link + loopback: production uses `relaybase://`; `tauri dev` on
/// macOS often does not register that scheme, so the console callback
/// also fetches http://127.0.0.1:32831.
pub fn setup_deep_link(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    #[cfg(any(windows, target_os = "linux"))]
    {
        if let Err(e) = app.deep_link().register("relaybase") {
            log::warn!("deep-link register failed: {e}");
        }
    }
    let handle = app.handle().clone();
    app.deep_link().on_open_url(move |event| {
        for url in event.urls() {
            let raw = url.to_string();
            let handle = handle.clone();
            tauri::async_runtime::spawn(async move {
                if let Some((state, code)) = parse_oauth_callback_url(&raw) {
                    let result = complete_cf_oauth_inner(state, code).await;
                    emit_oauth_result(&handle, result);
                }
            });
        }
    });
    let handle = app.handle().clone();
    tauri::async_runtime::spawn(async move {
        run_oauth_loopback_server(handle).await;
    });

    Ok(())
}
