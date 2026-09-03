pub mod commands;
pub mod deep_link;
pub mod files;
pub mod notify;
pub mod tray;
pub mod window;

pub use commands::*;
pub use deep_link::setup_deep_link;
pub use files::{downloads_dir, open_url_in_os_browser, unique_download_path};
pub use notify::{ensure_notification_icon, OpenMailPayload};
pub use tray::{apply_tray_unread, attach_close_to_hide, setup_tray, show_main_window};
pub use window::build_main_window;
