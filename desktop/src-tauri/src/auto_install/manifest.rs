use std::env;
use std::path::{Path, PathBuf};

use sha2::{Digest, Sha256};
use tauri::AppHandle;

use super::cancel::check_cancelled;
use super::constants::DEFAULT_MANIFEST_URL;
use super::log::emit_log;
use super::types::{WorkerInstallManifest, WorkerUpdateCheck};

fn manifest_url() -> String {
    env::var("RELAYBASE_INSTALL_MANIFEST_URL")
        .ok()
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| DEFAULT_MANIFEST_URL.to_string())
}

/// Fetch the hosted worker-install manifest (version + zip URL + sha256).
pub async fn fetch_install_manifest() -> Result<WorkerInstallManifest, String> {
    let url = manifest_url();
    let client = reqwest::Client::new();
    let res = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Could not fetch install manifest ({url}): {e}"))?;
    if !res.status().is_success() {
        return Err(format!(
            "Install manifest request failed (HTTP {}): {url}",
            res.status().as_u16()
        ));
    }
    res.json::<WorkerInstallManifest>()
        .await
        .map_err(|e| format!("Install manifest JSON invalid: {e}"))
}

fn versions_differ(current: Option<&str>, latest: &str) -> bool {
    let cur = current.unwrap_or("").trim();
    let lat = latest.trim();
    if lat.is_empty() {
        return false;
    }
    cur.is_empty() || cur != lat
}

/// Compare stored worker_version against the hosted manifest.
pub async fn check_worker_update(
    current_version: Option<String>,
) -> Result<WorkerUpdateCheck, String> {
    let manifest = fetch_install_manifest().await?;
    let update_available = versions_differ(current_version.as_deref(), &manifest.version);
    Ok(WorkerUpdateCheck {
        update_available,
        latest_version: manifest.version.clone(),
        current_version: current_version.filter(|v| !v.trim().is_empty()),
        zip_url: if update_available {
            Some(manifest.zip_url.clone())
        } else {
            None
        },
        zip_sha256: if update_available {
            Some(manifest.zip_sha256.clone())
        } else {
            None
        },
    })
}

fn sha256_hex(bytes: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    format!("{:x}", hasher.finalize())
}

async fn download_bytes(url: &str) -> Result<Vec<u8>, String> {
    check_cancelled()?;
    let client = reqwest::Client::new();
    let res = client
        .get(url)
        .send()
        .await
        .map_err(|e| format!("Could not download install package ({url}): {e}"))?;
    if !res.status().is_success() {
        return Err(format!(
            "Install package download failed (HTTP {}): {url}",
            res.status().as_u16()
        ));
    }
    res.bytes()
        .await
        .map(|b| b.to_vec())
        .map_err(|e| format!("Could not read install package bytes: {e}"))
}

fn unzip_bytes(zip_bytes: &[u8], dest: &Path) -> Result<(), String> {
    std::fs::create_dir_all(dest).map_err(|e| format!("mkdir {dest:?}: {e}"))?;
    let zip_path = dest
        .parent()
        .ok_or("Invalid unzip destination")?
        .join(format!("relaybase-install-{}.zip", uuid::Uuid::new_v4()));
    std::fs::write(&zip_path, zip_bytes).map_err(|e| format!("write temp zip: {e}"))?;
    let status = std::process::Command::new("unzip")
        .args(["-o", "-q"])
        .arg(&zip_path)
        .arg("-d")
        .arg(dest)
        .status()
        .map_err(|e| format!("Could not run unzip (is it installed?): {e}"))?;
    let _ = std::fs::remove_file(&zip_path);
    if !status.success() {
        return Err(format!("unzip exited with status {status}"));
    }
    Ok(())
}

/// Current Worker `/health` exposes `d1Bound` and `schemaMigrate: reconcile-v1`.
pub(crate) fn worker_js_is_current(source: &str) -> bool {
    source.contains("d1Bound") && source.contains("reconcile-v1")
}

/// Download the versioned install ZIP, verify SHA-256, and stage wrangler.toml + worker.js.
pub(crate) async fn stage_install_package(
    app: &AppHandle,
    manifest: &WorkerInstallManifest,
) -> Result<PathBuf, String> {
    emit_log(
        app,
        "prepare",
        "info",
        format!(
            "Downloading Worker install v{}…",
            manifest.version.trim()
        ),
    );
    let bytes = download_bytes(&manifest.zip_url).await?;
    let hash = sha256_hex(&bytes);
    if !manifest.zip_sha256.is_empty()
        && hash.to_lowercase() != manifest.zip_sha256.trim().to_lowercase()
    {
        return Err(format!(
            "Install package SHA-256 mismatch (expected {}, got {hash})",
            manifest.zip_sha256.trim()
        ));
    }
    let tmp = std::env::temp_dir().join(format!("relaybase-install-{}", uuid::Uuid::new_v4()));
    unzip_bytes(&bytes, &tmp)?;
    let nested = tmp.join("relaybase-worker-install");
    let work_dir = if nested.join("wrangler.toml").is_file() {
        nested
    } else if tmp.join("wrangler.toml").is_file() {
        tmp.clone()
    } else {
        return Err(
            "Install ZIP is missing wrangler.toml. Re-pack with pnpm pack:worker-install.".into(),
        );
    };
    if !work_dir.join("worker.js").is_file() {
        return Err(
            "Install ZIP is missing worker.js. Re-pack with pnpm pack:worker-install.".into(),
        );
    }
    let staged_js = std::fs::read_to_string(work_dir.join("worker.js"))
        .map_err(|e| format!("Could not read staged worker.js: {e}"))?;
    if !worker_js_is_current(&staged_js) {
        return Err(
            "The hosted install ZIP is too old to initialize an empty database (no d1Bound in worker.js). \
             Re-pack with `pnpm pack:worker-install`, deploy the website, then Try again."
                .into(),
        );
    }
    let staged = read_staged_version(&work_dir)
        .unwrap_or_else(|| manifest.version.trim().to_string());
    emit_log(
        app,
        "prepare",
        "info",
        format!("Staged Worker install v{staged} at {}", work_dir.display()),
    );
    Ok(work_dir)
}

/// Read version from staged VERSION file or wrangler.toml WORKER_VERSION var.
pub(crate) fn read_staged_version(work_dir: &Path) -> Option<String> {
    let version_file = work_dir.join("VERSION");
    if version_file.is_file() {
        if let Ok(raw) = std::fs::read_to_string(&version_file) {
            let v = raw.trim();
            if !v.is_empty() {
                return Some(v.to_string());
            }
        }
    }
    let wrangler = work_dir.join("wrangler.toml");
    if wrangler.is_file() {
        if let Ok(raw) = std::fs::read_to_string(&wrangler) {
            for line in raw.lines() {
                let trimmed = line.trim();
                if trimmed.starts_with("WORKER_VERSION") {
                    if let Some(rest) = trimmed.split('=').nth(1) {
                        let v = rest.trim().trim_matches('"');
                        if !v.is_empty() {
                            return Some(v.to_string());
                        }
                    }
                }
            }
        }
    }
    None
}

#[cfg(test)]
mod worker_js_tests {
    use super::worker_js_is_current;

    #[test]
    fn current_js_has_d1_bound() {
        assert!(worker_js_is_current(
            r#"return { d1Bound: { app: true }, schemaMigrate: "reconcile-v1" }"#
        ));
        assert!(!worker_js_is_current(r#"return { d1Bound: { app: true } }"#));
        assert!(!worker_js_is_current(r#"export default { fetch() {} }"#));
    }
}
