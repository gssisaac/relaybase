//! Background auto-install of the Relaybase routing Worker into the user's
//! Cloudflare account using a pre-built install ZIP + the Cloudflare HTTP API.
//!
//! Flow (each step streams `install-log` events to the frontend):
//!   0. `probe_install_resources` lists Worker / R2 / D1 and their occupancy.
//!   1. Fetch worker-install-manifest.json and download the versioned ZIP.
//!   2. Ensure R2 bucket `relaybase-mailbox`.
//!   3. Create D1 databases (empty D1s only — schema via POST /console/init-db).
//!   4. Generate an admin token; PUT Worker secrets.
//!   5. PUT `worker.js` with bindings; enable workers.dev.
//!   6. Empty D1s: POST /console/init-db. Reused or Worker-update: POST /console/migrate-db.
//!
//! Auth is the in-memory CF OAuth access token (or a legacy disk install
//! token). It is never sent to the Relaybase console or product Worker.

mod cancel;
mod constants;
mod credentials;
mod errors;
mod health;
mod install;
mod log;
mod manifest;
mod probe;
mod rollback;
mod schema;
mod types;
mod url;
mod wipe;

#[allow(unused_imports)]
pub use cancel::{request_install_cancel, INSTALL_CANCELLED};
#[allow(unused_imports)]
pub use constants::WIPE_PHRASE_DELETE_ME;
#[allow(unused_imports)]
pub use credentials::{merge_into_credentials, now_iso, push_cf_api_token_secret};
pub use install::{auto_install_worker, update_installed_worker};
#[allow(unused_imports)]
pub use manifest::{check_worker_update, fetch_install_manifest};
pub use probe::probe_install_resources;
pub use rollback::rollback_all_install;
pub use schema::{init_worker_db, migrate_worker_db};
#[allow(unused_imports)]
pub use types::{
    AutoInstallResult, InitDbResult, InstallDecision, InstallProbeResult, InstallResourceProbe,
    WorkerInstallManifest, WorkerUpdateCheck, WorkerUpdateTarget,
};
#[allow(unused_imports)]
pub use url::{
    assert_worker_update_target_matches, preview_worker_update_target, worker_url_host,
    worker_urls_match, WORKER_URL_ACCOUNT_MISMATCH,
};
#[allow(unused_imports)]
pub use wipe::wipe_confirmation_allows;
