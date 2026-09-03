# Shell & Native OS Integration Module (`desktop/src-tauri/src/shell`)

## 1. Module Overview & Boundaries
The `shell` module encapsulates all operating system integration and native UI shell capabilities. It manages desktop window creation with strict webview security navigation guards, system tray behavior with dynamically composited unread badges, native desktop notifications with embedded icon seeding, deep-link protocol URL routing (`relaybase://`), and file system opening / downloads.

- **Primary Responsibility**: Native window management, menu bar tray, notifications, system browser routing, file operations.
- **Boundaries**:
  - Does NOT handle secret persistence or local cache reading (delegated to `storage`).
  - Does NOT initiate OAuth PKCE exchange logic directly (delegated to `cloudflare::loopback`).
  - Enforces OS security boundaries (sandboxed iframes, external link routing).

---

## 2. File Map

| File | Purpose |
|---|---|
| `mod.rs` | Module root & public API re-exports |
| `README.md` | AI agent documentation and architectural guide |
| `window.rs` | Main `WebviewWindow` programmatic builder and `on_new_window` / `on_navigation` security guards |
| `tray.rs` | Menu bar tray icon builder, dynamic unread dot compositing, close-to-hide window behavior |
| `notify.rs` | OS desktop notifications with custom app icon seeding and click-to-open-email action routing |
| `deep_link.rs` | `relaybase://` protocol handler registration and routing to OAuth loopback |
| `files.rs` | OS browser opening, attachment temp-file opener, downloads directory path allocator, file reveal |
| `commands.rs` | Tauri IPC command handlers for shell, file, tray, and notification operations |

---

## 3. Public Rust API (`mod.rs`)

```rust
// Window & Tray Setup
pub fn build_main_window(app: &tauri::App) -> Result<tauri::WebviewWindow, Box<dyn std::error::Error>>;
pub fn setup_tray(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>>;
pub fn attach_close_to_hide(window: &tauri::WebviewWindow);
pub fn show_main_window(app: &tauri::AppHandle);
pub fn apply_tray_unread(app: &tauri::AppHandle, has_unread: bool);

// Notifications & Deep Links
pub fn ensure_notification_icon() -> Result<std::path::PathBuf, String>;
pub fn setup_deep_link(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>>;

// File & OS Helpers
pub fn open_url_in_os_browser(url: &str) -> Result<(), String>;
pub fn downloads_dir() -> std::path::PathBuf;
pub fn unique_download_path(dir: &std::path::Path, name: &str) -> std::path::PathBuf;
```

---

## 4. Tauri IPC Commands

| Tauri Command (`commands.rs`) | Frontend Invocation (`app/src/lib/desktop/bridge/*`) | Description |
|---|---|---|
| `get_desktop_info` | `desktop/bridge/index.ts` -> `getDesktopInfo()` | Returns version, OS, and architecture |
| `open_external_url` | `desktop/bridge/index.ts` -> `openExternalUrl()` | Opens URL in system default web browser |
| `open_local_file_with_default_app` | `desktop/bridge/index.ts` -> `openLocalFileWithDefaultApp()` | Decodes base64 attachment and opens with default app |
| `save_download_file` | `desktop/bridge/index.ts` -> `saveDownloadFile()` | Saves base64 attachment to Downloads folder |
| `open_file_path` | `desktop/bridge/index.ts` -> `openFilePath()` | Opens specific file path with default application |
| `reveal_file_in_folder` | `desktop/bridge/index.ts` -> `revealFileInFolder()` | Reveals file in macOS Finder / Windows Explorer |
| `show_notification` | `desktop/bridge/index.ts` -> `showNotification()` | Triggers OS notification with optional email deep-link payload |
| `take_pending_open_mail` | `desktop/bridge/index.ts` -> `takePendingOpenMail()` | Retrieves pending email payload clicked from notification |
| `set_tray_unread` | `desktop/bridge/index.ts` -> `setTrayUnread()` | Toggles red unread badge overlay on tray icon |

---

## 5. Security & Invariants

1. **Sandboxed HTML Navigation Guard**:
   - Inbound email HTML contains untrusted content rendered inside `<iframe sandbox="...">`.
   - Any `<a target="_blank">` triggers `on_new_window`, which MUST deny the in-app window and delegate to `open_url_in_os_browser`.
   - `on_navigation` intercepts top-level and bubbling navigations, denying non-local origins.
2. **Download Path Sanitization**:
   - `unique_download_path` replaces `/` and `\` path separators and strips null bytes to prevent directory traversal.
3. **Tray Close-to-Hide**:
   - Clicking window close prevents exit and hides the window (`attach_close_to_hide`), keeping background notifications and tray alive.
4. **App Icon Seeding**:
   - macOS notification identity images must be on disk; `ensure_notification_icon` seeds `~/.relaybase/app-icon.png` with permissions `0o600`.

---

## 6. Dependency Rules

- **Allowed Inbound**: `lib.rs` (app lifecycle), `auth/owner_session.rs` (window focus on notification).
- **Allowed Outbound**:
  - `cloudflare::loopback` (for deep link callback dispatch)
- **Forbidden**: `shell` MUST NOT import D1/R2 worker provisioning or secret key management modules directly.
