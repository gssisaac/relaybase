use tauri::{AppHandle, Emitter};

use super::types::LogEvent;

pub(crate) fn emit_log(app: &AppHandle, step: &str, level: &str, line: impl Into<String>) {
    let _ = app.emit(
        "install-log",
        LogEvent {
            step: step.into(),
            level: level.into(),
            line: line.into(),
        },
    );
}
