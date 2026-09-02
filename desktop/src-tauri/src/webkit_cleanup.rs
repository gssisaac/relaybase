//! Clear WebKit / OS-level data that the Tauri WebView leaves outside
//! `~/.relaybase` (LocalStorage, IndexedDB, network cache, cookies).
//!
//! On macOS the WKWebView stores website data under:
//! - `~/Library/WebKit/{productName}/WebsiteData/` (LocalStorage, IndexedDB)
//! - `~/Library/Caches/{identifier}/` (WebKit network cache, HSTS, etc.)
//! - `~/Library/Caches/{productName}/` (legacy cache path)
//! - `~/Library/HTTPStorages/{productName}.binarycookies`
//!
//! These are **not** part of `~/.relaybase` and survive `~/.relaybase` deletion.
//! This module provides a command to wipe them so the app can return to the
//! initial install screen after a factory reset.

use std::fs;
use std::path::PathBuf;

const PRODUCT_NAME: &str = "Relaybase";
const IDENTIFIER: &str = "com.relaybase.desktop";
/// Legacy binary name from older builds — clean it up too.
const LEGACY_BINARY_NAME: &str = "relaybase_desktop";

fn home_dir() -> Result<PathBuf, String> {
    dirs::home_dir().ok_or_else(|| "Could not resolve home directory".to_string())
}

/// Recursively delete a directory if it exists. Best-effort: logs failures
/// but does not error so a partial cleanup still succeeds.
fn remove_dir_if_exists(path: &PathBuf, label: &str) {
    if !path.exists() {
        return;
    }
    if let Err(e) = fs::remove_dir_all(path) {
        log::warn!("webkit_cleanup: failed to remove {} ({}): {e}", label, path.display());
    }
}

/// Delete a single file if it exists.
fn remove_file_if_exists(path: &PathBuf, label: &str) {
    if !path.exists() {
        return;
    }
    if let Err(e) = fs::remove_file(path) {
        log::warn!("webkit_cleanup: failed to remove {} ({}): {e}", label, path.display());
    }
}

/// Clear WebKit WebsiteData (LocalStorage, IndexedDB, CacheStorage, etc.)
/// and OS-level caches/cookies that live outside `~/.relaybase`.
///
/// Returns a summary of what was cleared. Best-effort: missing paths are
/// not errors; only unrecoverable filesystem failures are.
pub fn clear_webkit_data() -> Result<String, String> {
    let home = home_dir()?;
    let mut cleared: Vec<&str> = Vec::new();

    // 1. WebKit WebsiteData (LocalStorage, IndexedDB, CacheStorage, ServiceWorkers)
    let webkit_data = home.join("Library/WebKit").join(PRODUCT_NAME).join("WebsiteData");
    remove_dir_if_exists(&webkit_data, "WebKit WebsiteData");
    cleared.push("WebKit WebsiteData (LocalStorage, IndexedDB)");

    // 2. WebKit profile root (may hold older session data)
    let webkit_root = home.join("Library/WebKit").join(PRODUCT_NAME);
    // Only remove children, not the root itself (WKWebView recreates it)
    if webkit_root.exists() {
        if let Ok(entries) = fs::read_dir(&webkit_root) {
            for entry in entries.flatten() {
                let path = entry.path();
                if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                    // Keep the parent dir; remove contents.
                    let _ = fs::remove_dir_all(&path);
                    let _ = &name; // suppress unused warning
                }
            }
        }
    }

    // 3. Caches keyed by identifier
    let cache_id = home.join("Library/Caches").join(IDENTIFIER);
    remove_dir_if_exists(&cache_id, "Caches by identifier");
    cleared.push("Caches (com.relaybase.desktop)");

    // 4. Caches keyed by product name (older Tauri builds)
    let cache_product = home.join("Library/Caches").join(PRODUCT_NAME);
    remove_dir_if_exists(&cache_product, "Caches by product name");
    cleared.push("Caches (Relaybase)");

    // 5. Legacy binary name caches
    let cache_legacy = home.join("Library/Caches").join(LEGACY_BINARY_NAME);
    remove_dir_if_exists(&cache_legacy, "Legacy caches");
    cleared.push("Caches (relaybase_desktop legacy)");

    // 6. HTTPStorages cookies
    let cookies_product = home
        .join("Library/HTTPStorages")
        .join(format!("{PRODUCT_NAME}.binarycookies"));
    remove_file_if_exists(&cookies_product, "HTTPStorages cookies (product)");
    let cookies_legacy = home
        .join("Library/HTTPStorages")
        .join(format!("{LEGACY_BINARY_NAME}.binarycookies"));
    remove_file_if_exists(&cookies_legacy, "HTTPStorages cookies (legacy)");
    cleared.push("HTTPStorages cookies");

    // 7. Preferences plist (window frame etc. — not auth, but stale state)
    let prefs = home
        .join("Library/Preferences")
        .join(format!("{LEGACY_BINARY_NAME}.plist"));
    remove_file_if_exists(&prefs, "Preferences plist");

    Ok(cleared.join(", "))
}
