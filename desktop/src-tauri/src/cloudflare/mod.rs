//! Cloudflare integration module.
//!
//! Handles:
//! - Cloudflare REST API client (`client`)
//! - OAuth PKCE flow and token refresh (`oauth`)
//! - Local TCP loopback server for OAuth callbacks (`loopback`)
//! - Worker probe, install, and update helpers (`worker`)
//! - Tauri IPC commands for Cloudflare and Worker verification (`commands`)

pub mod client;
pub mod commands;
pub mod loopback;
pub mod oauth;
pub mod worker;

pub use client::*;
pub use commands::*;
pub use loopback::{
    console_base_url, emit_oauth_result, parse_oauth_callback_url, run_oauth_loopback_server,
    OAuthStartResult, OAUTH_LOOPBACK_PORT,
};
pub use oauth::{
    cf_oauth_if_present, delete_keyring_oauth_refresh, load_keyring_oauth_refresh, new_iso_expires,
    require_cf_oauth, require_cf_oauth_access_token, save_keyring_oauth_refresh, CfOAuthCreds,
    KeyringCfOAuth, CLOUDFLARE_AUTH_EXPIRED, CF_OAUTH_KEYRING_SERVICE, CF_OAUTH_KEYRING_USER,
};
pub use worker::{
    adopt_worker, install_worker, probe_install, update_worker, InstallResult, ProbeResult,
    ResourceCheck, DEFAULT_SCRIPT, R2_BUCKET,
};
