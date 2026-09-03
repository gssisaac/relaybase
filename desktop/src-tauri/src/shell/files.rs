use std::path::{Path, PathBuf};

/// Open an http(s) URL in the system browser. Used both by the
/// `open_external_url` IPC command and the webview `on_new_window` handler
/// (email `<a target="_blank">` links must not open an in-app window).
pub fn open_url_in_os_browser(url: &str) -> Result<(), String> {
    let url = url.trim();
    if !(url.starts_with("https://") || url.starts_with("http://")) {
        return Err("Only http(s) URLs can be opened".into());
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(url)
            .spawn()
            .map_err(|e| format!("Failed to open browser: {e}"))?;
        return Ok(());
    }
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/C", "start", "", url])
            .spawn()
            .map_err(|e| format!("Failed to open browser: {e}"))?;
        return Ok(());
    }
    #[cfg(all(unix, not(target_os = "macos")))]
    {
        std::process::Command::new("xdg-open")
            .arg(url)
            .spawn()
            .map_err(|e| format!("Failed to open browser: {e}"))?;
        return Ok(());
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows", unix)))]
    {
        let _ = url;
        Err("Opening external URLs is not supported on this platform".into())
    }
}

pub fn downloads_dir() -> PathBuf {
    dirs::download_dir().unwrap_or_else(std::env::temp_dir)
}

pub fn unique_download_path(dir: &Path, name: &str) -> PathBuf {
    let safe_name = name
        .trim()
        .replace(['/', '\\'], "_")
        .chars()
        .filter(|c| *c != '\0')
        .collect::<String>();
    let safe_name = if safe_name.is_empty() {
        "download".into()
    } else {
        safe_name
    };
    let mut candidate = dir.join(&safe_name);
    if !candidate.exists() {
        return candidate;
    }
    let path = Path::new(&safe_name);
    let stem = path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("download");
    let ext = path.extension().and_then(|s| s.to_str());
    for i in 1..100 {
        let next = match ext {
            Some(ext) if !ext.is_empty() => format!("{stem} ({i}).{ext}"),
            _ => format!("{stem} ({i})"),
        };
        candidate = dir.join(next);
        if !candidate.exists() {
            return candidate;
        }
    }
    dir.join(format!(
        "{stem}-{}.{ext}",
        uuid::Uuid::new_v4(),
        ext = ext.unwrap_or("bin")
    ))
}

pub fn open_local_file_with_default_app_inner(
    name: &str,
    base64_data: &str,
) -> Result<(), String> {
    use base64::Engine as _;
    let bytes = base64::prelude::BASE64_STANDARD
        .decode(base64_data.as_bytes())
        .map_err(|e| format!("Invalid attachment data: {e}"))?;
    let ext = name
        .rsplit('.')
        .next()
        .filter(|s| !s.is_empty())
        .unwrap_or("bin");
    let temp = std::env::temp_dir()
        .join(format!("relaybase-attach-{}.{ext}", uuid::Uuid::new_v4()));
    std::fs::write(&temp, &bytes)
        .map_err(|e| format!("Failed to write temp file: {e}"))?;
    open::that(&temp).map_err(|e| format!("Failed to open file: {e}"))?;
    Ok(())
}

pub fn save_download_file_inner(name: &str, base64_data: &str) -> Result<String, String> {
    use base64::Engine as _;
    let bytes = base64::prelude::BASE64_STANDARD
        .decode(base64_data.as_bytes())
        .map_err(|e| format!("Invalid attachment data: {e}"))?;
    let path = unique_download_path(&downloads_dir(), name);
    std::fs::write(&path, &bytes).map_err(|e| format!("Failed to save download: {e}"))?;
    Ok(path.to_string_lossy().into_owned())
}

pub fn open_file_path_inner(path: &str) -> Result<(), String> {
    let path = path.trim();
    if path.is_empty() {
        return Err("File path is empty".into());
    }
    open::that(path).map_err(|e| format!("Failed to open file: {e}"))
}

pub fn reveal_file_in_folder_inner(path: &str) -> Result<(), String> {
    let path = path.trim();
    if path.is_empty() {
        return Err("File path is empty".into());
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .args(["-R", path])
            .spawn()
            .map_err(|e| format!("Failed to reveal file: {e}"))?;
        return Ok(());
    }
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .args(["/select,", path])
            .spawn()
            .map_err(|e| format!("Failed to reveal file: {e}"))?;
        return Ok(());
    }
    #[cfg(all(unix, not(target_os = "macos")))]
    {
        let parent = Path::new(path)
            .parent()
            .ok_or_else(|| "File has no parent folder".to_string())?;
        open::that(parent).map_err(|e| format!("Failed to open folder: {e}"))?;
        return Ok(());
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows", unix)))]
    {
        let _ = path;
        Err("Reveal in folder is not supported on this platform".into())
    }
}
