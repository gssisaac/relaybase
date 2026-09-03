use tauri::{App, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

use super::files::open_url_in_os_browser;

/// Build the main window programmatically (rather than via the
/// tauri.conf.json `app.windows` array) so we can attach an
/// `on_new_window` handler. Email HTML is rendered in a sandboxed
/// `<iframe sandbox="allow-same-origin allow-popups">`; links use
/// `target="_blank"`, which the webview turns into a new-window
/// request. Route those to the system browser and deny the in-app
/// window so external links never open inside Relaybase.
pub fn build_main_window(app: &App) -> Result<WebviewWindow, Box<dyn std::error::Error>> {
    let builder = WebviewWindowBuilder::new(
        app,
        "main",
        WebviewUrl::App("index.html".into()),
    )
    .title("Relaybase")
    .inner_size(1280.0, 840.0)
    .min_inner_size(960.0, 640.0)
    .resizable(true)
    .fullscreen(false)
    .decorations(true)
    .accept_first_mouse(true)
    .disable_drag_drop_handler()
    .zoom_hotkeys_enabled(false);

    // macOS-only window chrome options. These Tauri 2.x builder
    // methods are gated to macOS; calling them unconditionally breaks
    // `cargo check` on Linux/Windows.
    #[cfg(target_os = "macos")]
    let builder = builder
        .title_bar_style(tauri::TitleBarStyle::Overlay)
        .hidden_title(true)
        .traffic_light_position(tauri::LogicalPosition::new(14.0, 21.0));

    let window = builder
        .on_new_window(move |url, _features| {
            let s = url.as_str().to_string();
            if s.starts_with("http://") || s.starts_with("https://") {
                if let Err(e) = open_url_in_os_browser(&s) {
                    log::warn!("open_external_url failed: {e}");
                }
            }
            tauri::webview::NewWindowResponse::Deny
        })
        // Safety net: if a link ever navigates the main webview itself
        // (e.g. a top-level <a> without target, or an iframe whose
        // in-place navigation bubbles up), deny the in-app load and
        // route the URL to the system browser. App-internal navigations
        // (dev server / static export) are still allowed.
        .on_navigation(move |url| {
            let s = url.as_str().to_string();
            if s.starts_with("http://") || s.starts_with("https://") {
                // Only intercept external hosts — never block the app's
                // own dev URL (http://127.0.0.1:32830 / localhost) or the
                // tauri.localhost / asset:// app origin, otherwise the
                // shell would stop loading routes.
                let is_app_origin = s.starts_with("http://127.0.0.1")
                    || s.starts_with("http://localhost")
                    || s.starts_with("https://127.0.0.1")
                    || s.starts_with("https://localhost");
                if !is_app_origin {
                    if let Err(e) = open_url_in_os_browser(&s) {
                        log::warn!("on_navigation open_external_url failed: {e}");
                    }
                    return false;
                }
            }
            true
        })
        .build()?;

    Ok(window)
}
