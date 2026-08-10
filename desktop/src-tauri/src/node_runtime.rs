use serde::Serialize;
use std::path::PathBuf;
use std::process::Command;
use tokio::process::Command as TokioCommand;

/// Resolved Node.js runtime used to spawn `npx wrangler`.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NodeInfo {
    /// Absolute path to the `node` binary.
    pub bin: String,
    /// `node --version` output, e.g. `v22.14.0`.
    pub version: String,
}

impl NodeInfo {
    /// Directory containing `node` (prepended to PATH for subprocesses so `npx` resolves).
    pub fn bin_dir(&self) -> PathBuf {
        std::path::Path::new(&self.bin)
            .parent()
            .map(PathBuf::from)
            .unwrap_or_else(|| PathBuf::from("/usr/local/bin"))
    }
}

/// Look for `node` in PATH and common install locations. Returns version on success.
pub fn detect_node() -> Option<NodeInfo> {
    let candidates: Vec<PathBuf> = {
        let mut v = vec![
            PathBuf::from("node"),
            PathBuf::from("/opt/homebrew/bin/node"),
            PathBuf::from("/usr/local/bin/node"),
            PathBuf::from("/usr/bin/node"),
        ];
        if let Some(home) = dirs::home_dir() {
            v.push(home.join(".nvm/current/bin/node"));
            v.push(home.join(".nvm/versions/node").join("current/bin/node"));
            v.push(home.join(".volta/bin/node"));
            v.push(home.join(".fnm/current/bin/node"));
        }
        v
    };

    for cand in candidates {
        let output = Command::new(&cand).arg("--version").output();
        if let Ok(out) = output {
            if out.status.success() {
                let ver = String::from_utf8_lossy(&out.stdout).trim().to_string();
                if ver.starts_with('v') {
                    // Resolve absolute path if we used a PATH lookup ("node").
                    let resolved = if cand.components().count() == 1 {
                        which_absolute("node")
                    } else {
                        Some(PathBuf::from(&cand))
                    };
                    if let Some(bin) = resolved {
                        return Some(NodeInfo {
                            bin: bin.to_string_lossy().to_string(),
                            version: ver,
                        });
                    }
                }
            }
        }
    }
    None
}

fn which_absolute(name: &str) -> Option<PathBuf> {
    let out = Command::new("which").arg(name).output().ok()?;
    if !out.status.success() {
        return None;
    }
    let s = String::from_utf8_lossy(&out.stdout).trim().to_string();
    if s.is_empty() {
        None
    } else {
        Some(PathBuf::from(s))
    }
}

/// Build a PATH string with node's bin dir prepended to the current PATH.
pub fn path_with_node_prepended(node: &NodeInfo) -> String {
    let node_dir = node.bin_dir();
    let existing = std::env::var("PATH").unwrap_or_default();
    let mut parts: Vec<String> = vec![node_dir.to_string_lossy().to_string()];
    parts.extend(existing.split(':').map(|s| s.to_string()).filter(|s| !s.is_empty()));
    parts.join(":")
}

/// Spawn `npx wrangler <args>` with the resolved Node on PATH and the given env.
/// Caller is responsible for streaming stdout/stderr.
pub fn build_wrangler_command(args: &[&str], node: &NodeInfo) -> TokioCommand {
    let npx_bin = node.bin_dir().join("npx");
    let mut cmd = TokioCommand::new(npx_bin);
    // --yes auto-confirms installing wrangler from the install folder's
    // package.json devDependency. The first positional arg is the `wrangler` bin.
    cmd.arg("--yes").arg("wrangler");
    for a in args {
        cmd.arg(a);
    }
    cmd
}
