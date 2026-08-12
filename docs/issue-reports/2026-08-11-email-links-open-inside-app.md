# Email body links opened inside the app webview instead of the system browser

**Date:** 2026-08-11  
**Status:** Fixed  
**Severity:** Medium (user could not complete external flows like Google Takeout download)  
**Components:** `app/src/email/components/EmailHtmlFrame.tsx`, `desktop/src-tauri/src/lib.rs` (`on_navigation` / `on_new_window`)

## Summary

Clicking a link inside an HTML email body (e.g. the "Manage Google Takeout request" button) loaded the external site **inside the app's webview** instead of launching the system browser. The user could not proceed because the in-app webview is not a full browser and the external flow (Google auth / download) does not work there.

## Symptoms

1. Open an HTML email with a call-to-action link (Google Takeout "Manage Google Takeout request").
2. Click the button → the external URL loaded inside the app window, replacing the mail UI.
3. No system browser launched.

## Root cause

Email HTML is rendered in a sandboxed `<iframe sandbox="allow-same-origin allow-popups">` (no `allow-scripts`) via `EmailHtmlFrame.tsx`. Two interception layers existed:

1. A capture-phase `click` listener attached from the parent onto the iframe document, calling `desktopOpenExternal(href)` → `invoke("open_external_url")`.
2. A Rust `on_new_window` handler on the main `WebviewWindowBuilder` that routes `http(s)` new-window requests to `open_url_in_os_browser` and denies the in-app window.

Both layers are unreliable on macOS WKWebView for sandboxed iframes without `allow-scripts`:

- The iframe JS click listener does **not** fire reliably in WKWebView when the iframe sandbox omits `allow-scripts`.
- `<base target="_blank">` was the only mechanism forcing anchors to become new-window requests, but it does not override anchors/forms that carry an explicit `target` (e.g. `target="_self"`) or `<form action>` without a target. Such links then navigated the iframe in-place, loading the external site inside the app.

There was no main-webview navigation guard, so an in-place iframe navigation to an external host was not intercepted.

## Fix

Two complementary changes:

### 1. Frontend — explicit `target="_blank` rewrite at setup (`EmailHtmlFrame.tsx`)

DOM mutation from the parent (same-origin) at iframe load, so it works without `allow-scripts`:

```ts
doc.querySelectorAll("a[href]").forEach((a) => {
  a.setAttribute("target", "_blank");
  a.setAttribute("rel", "noopener noreferrer");
});
doc.querySelectorAll("form").forEach((f) => {
  f.setAttribute("target", "_blank");
});
```

This forces every anchor and form to raise a new-window request that the Rust `on_new_window` handler can route to the OS browser. The existing click listener is kept as a secondary net and now also handles protocol-relative `//host` URLs.

### 2. Rust — `on_navigation` guard (`lib.rs`)

Added a navigation guard on the main `WebviewWindowBuilder` as a safety net for any external `http(s)` navigation that reaches the main webview:

```rust
.on_navigation(move |url| {
    let s = url.as_str().to_string();
    if s.starts_with("http://") || s.starts_with("https://") {
        let is_app_origin = s.starts_with("http://127.0.0.1")
            || s.starts_with("http://localhost")
            || s.starts_with("https://127.0.0.1")
            || s.starts_with("https://localhost");
        if !is_app_origin {
            let _ = open_url_in_os_browser(&s);
            return false; // deny in-app navigation
        }
    }
    true
})
```

App-internal origins (dev server `127.0.0.1:32830` / `localhost`) are still allowed so normal route loading is unaffected.

## Verification

- `cargo check` (Tauri 2.11.3): passed (`on_navigation` API available)
- Frontend lint: no errors
- `tauri dev` auto-recompiled on `lib.rs` change and reloaded the frontend via HMR.

## Notes

- The app does not use `@tauri-apps/plugin-shell`; external URLs are opened via native `open` (macOS) / `cmd /C start` (Windows) / `xdg-open` (Linux) in `open_url_in_os_browser`.
- `sandbox` intentionally omits `allow-scripts` so untrusted email HTML cannot execute scripts; the fix relies on parent-side DOM mutation and webview-level interception, not on scripts inside the iframe.
