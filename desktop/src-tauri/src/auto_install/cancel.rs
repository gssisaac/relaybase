use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::OnceLock;

use tokio::sync::Notify;

/// Returned to the UI when the user stops install. Keep this token stable.
pub const INSTALL_CANCELLED: &str = "INSTALL_CANCELLED";

static INSTALL_CANCEL_FLAG: AtomicBool = AtomicBool::new(false);
static INSTALL_CANCEL_NOTIFY: OnceLock<Notify> = OnceLock::new();

fn cancel_notify() -> &'static Notify {
    INSTALL_CANCEL_NOTIFY.get_or_init(Notify::new)
}

pub fn request_install_cancel() {
    INSTALL_CANCEL_FLAG.store(true, Ordering::SeqCst);
    cancel_notify().notify_waiters();
}

pub(crate) fn reset_install_cancel() {
    INSTALL_CANCEL_FLAG.store(false, Ordering::SeqCst);
}

pub(crate) fn install_is_cancelled() -> bool {
    INSTALL_CANCEL_FLAG.load(Ordering::SeqCst)
}

pub(crate) fn cancelled_error() -> String {
    INSTALL_CANCELLED.to_string()
}

pub(crate) fn check_cancelled() -> Result<(), String> {
    if install_is_cancelled() {
        Err(cancelled_error())
    } else {
        Ok(())
    }
}
