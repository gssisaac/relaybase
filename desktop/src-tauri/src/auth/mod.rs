//! Authentication and session management module.
//!
//! Manages:
//! - Owner session (mail + console refresh tokens in OS keyring `owner-session`, scoped access tokens in memory)
//! - Owner passtoken in OS keyring `owner-passtoken` (read-gated with Touch ID / biometry)
//! - Team session (mobile password in OS keyring `team-session`)
//! - OS keyring store abstraction (`keyring_store`)
//! - Biometric prompt (`touch_id`)
//! - Tauri IPC commands for auth and proxy worker requests

pub mod commands;
pub mod keyring_store;
pub mod owner_passtoken;
pub mod owner_session;
pub mod team_session;
pub mod touch_id;

pub use commands::*;
pub use keyring_store::{
    delete_password, forget_cached_password, get_password, get_password_uncached, set_password,
};
pub use owner_passtoken::{
    delete as delete_owner_passtoken, is_stored as is_owner_passtoken_stored,
    load_after_auth as load_owner_passtoken_after_auth, store as store_owner_passtoken,
    stored_prefix as owner_passtoken_stored_prefix, PasstokenRecord,
};
pub use owner_session::{
    current_access_token, current_console_access_token, owner_boot_mail, owner_login,
    owner_login_from_keyring, owner_logout, owner_reset_admin, owner_session_status,
    owner_setup_admin, owner_unlock_console, worker_request, OwnerSessionStatus, OwnerSetupResult,
    WorkerRequestInput, WorkerRequestOutput,
};
pub use team_session::{
    team_forget_session, team_login, team_logout, team_session_status, team_unlock,
    team_worker_request, TeamSessionStatus, TeamWorkerRequestInput, TeamWorkerRequestOutput,
};
pub use touch_id::authenticate as touch_id_authenticate;
