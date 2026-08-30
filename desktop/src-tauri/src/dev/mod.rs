//! DEV-MODE TESTING ONLY — local tmp persistence for `tauri dev`.
//!
//! Compiled only in debug builds (`#[cfg(debug_assertions)]`). Release builds
//! omit this module entirely. Do not use for production.

mod cf_oauth_cache;
mod keyring_store;
mod tmp_fs;

pub use cf_oauth_cache::{clear as clear_cf_oauth_cache, hydrate, load as load_cf_oauth_cache, save as save_cf_oauth_cache};
pub use keyring_store::{delete_password, get_password, set_password};
