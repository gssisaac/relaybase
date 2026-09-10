//! OS secret store used by owner and team sessions.
//!
//! All secrets this module is asked to hold — per-Worker owner passtoken +
//! session, team session, the CF OAuth install refresh token, the Worker-URL
//! index — live inside **one** OS item (`account = "vault"`) instead of one
//! item per secret. Each distinct `(service, account)` item can trigger its
//! own system access-control prompt the first time it is touched, so a
//! fresh install that used to write 4-5 separate items during first boot
//! could prompt that many times. Packing every secret into a single item's
//! JSON blob means the OS is only ever asked about one item, so there is at
//! most one prompt, ever. Callers are unaffected: `get_password` /
//! `set_password` / `delete_password` keep their existing `(service,
//! account)` signature — `account` now addresses a key inside the vault's
//! JSON map rather than a distinct OS item. `ensure_loaded` below does a
//! one-time, per-key migration that folds any pre-existing per-secret item
//! into the vault and deletes the old item.
//!
//! On macOS the `keyring` crate talks to the **login** keychain via the
//! legacy `SecKeychain` API. That path shows the system dialog
//! “Relaybase wants to use your confidential information stored in
//! 'com.relaybase.desktop'” and “Always Allow” does not stick: the ACL is
//! bound to the binary’s code signature, which changes across `tauri dev`
//! rebuilds and often across signed updates.
//!
//! Debug builds delegate to `crate::dev::keyring_store` (tmp files) instead —
//! see `src/dev/`.
//!
//! This module uses the modern `SecItem` API on the login keychain (no
//! `keychain-access-groups` entitlement — Developer ID builds cannot use
//! that on macOS 26 without a provisioning profile). Avoids the legacy
//! `SecKeychainFindGenericPassword` path that shows “Always Allow” and does
//! not persist across launches. One-shot read of old `keyring` crate items,
//! then rewrite via SecItem and delete the ACL-bound copy — this applies per
//! item, so it also transparently backs the vault migration below (each
//! legacy item is read through this same path before being folded in).
//!
//! Windows / Linux keep using the `keyring` crate — for a single vault item
//! that just means one Credential Manager / Secret Service entry instead of
//! several. All platforms share an in-process cache, and every operation
//! (including the migration fold-in) runs under one global lock so
//! concurrent boot reads (owner + team + CF OAuth) cannot race each other
//! into clobbering the vault or stacking OS prompts.

use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};

use serde::{Deserialize, Serialize};

#[cfg(all(not(debug_assertions), target_os = "macos"))]
const ERR_SEC_ITEM_NOT_FOUND: i32 = -25300;

/// Fixed OS-item account name. Every real secret is nested inside this
/// item's JSON blob, keyed by the caller's `account` argument, instead of
/// getting its own OS item.
const VAULT_ACCOUNT: &str = "vault";
const VAULT_VERSION: u32 = 1;

#[derive(Debug, Default, Clone, Serialize, Deserialize)]
struct VaultBlob {
    #[serde(default)]
    v: u32,
    #[serde(default)]
    entries: HashMap<String, String>,
}

fn decode_vault(raw: &str) -> HashMap<String, String> {
    serde_json::from_str::<VaultBlob>(raw)
        .map(|blob| blob.entries)
        .unwrap_or_default()
}

fn encode_vault(entries: &HashMap<String, String>) -> Result<String, String> {
    serde_json::to_string(&VaultBlob {
        v: VAULT_VERSION,
        entries: entries.clone(),
    })
    .map_err(|e| e.to_string())
}

/// One decoded vault map per `service`, cached for the life of the process.
static VAULT: OnceLock<Mutex<HashMap<String, HashMap<String, String>>>> = OnceLock::new();

fn vault_lock() -> std::sync::MutexGuard<'static, HashMap<String, HashMap<String, String>>> {
    VAULT
        .get_or_init(|| Mutex::new(HashMap::new()))
        .lock()
        .unwrap_or_else(|e| e.into_inner())
}

/// Single-OS-item read/write/delete — the same per-platform primitive used
/// everywhere below, called with `VAULT_ACCOUNT` for the vault itself and
/// with the caller's real `account` only while migrating a legacy item.
fn raw_item_get(service: &str, account: &str) -> Result<Option<String>, String> {
    #[cfg(debug_assertions)]
    {
        crate::dev::get_password(service, account)
    }
    #[cfg(not(debug_assertions))]
    {
        platform_get(service, account)
    }
}

fn raw_item_set(service: &str, account: &str, password: &str) -> Result<(), String> {
    #[cfg(debug_assertions)]
    {
        crate::dev::set_password(service, account, password)
    }
    #[cfg(not(debug_assertions))]
    {
        platform_set(service, account, password)
    }
}

fn raw_item_delete(service: &str, account: &str) {
    #[cfg(debug_assertions)]
    {
        crate::dev::delete_password(service, account);
    }
    #[cfg(not(debug_assertions))]
    {
        platform_delete(service, account);
    }
}

/// Must be called with the vault mutex already held (so a concurrent caller
/// can never observe or persist a half-migrated map). Reloads `service`'s
/// map from the OS if `force` or it has never been loaded this process, then
/// makes sure `account_hint` is present if a pre-vault, one-item-per-secret
/// OS entry for it still exists: folds that legacy value into the vault,
/// persists the vault, and deletes the old item so it doesn't linger as an
/// orphaned plaintext secret. Runs the legacy check at most once per key —
/// after that the key either lives in the vault or was never there.
fn ensure_loaded(
    vault: &mut HashMap<String, HashMap<String, String>>,
    service: &str,
    force: bool,
    account_hint: &str,
) -> Result<(), String> {
    if force || !vault.contains_key(service) {
        let entries = raw_item_get(service, VAULT_ACCOUNT)?
            .map(|raw| decode_vault(&raw))
            .unwrap_or_default();
        vault.insert(service.to_string(), entries);
    }
    if account_hint == VAULT_ACCOUNT {
        return Ok(());
    }
    let has_key = vault
        .get(service)
        .map(|entries| entries.contains_key(account_hint))
        .unwrap_or(false);
    if has_key {
        return Ok(());
    }
    if let Some(legacy_value) = raw_item_get(service, account_hint)? {
        let entries = vault.entry(service.to_string()).or_default();
        entries.insert(account_hint.to_string(), legacy_value);
        let json = encode_vault(entries)?;
        raw_item_set(service, VAULT_ACCOUNT, &json)?;
        raw_item_delete(service, account_hint);
    }
    Ok(())
}

pub fn get_password(service: &str, account: &str) -> Result<Option<String>, String> {
    let mut vault = vault_lock();
    ensure_loaded(&mut vault, service, false, account)?;
    Ok(vault
        .get(service)
        .and_then(|entries| entries.get(account))
        .cloned())
}

pub fn set_password(service: &str, account: &str, password: &str) -> Result<(), String> {
    let mut vault = vault_lock();
    ensure_loaded(&mut vault, service, false, account)?;
    let entries = vault.entry(service.to_string()).or_default();
    entries.insert(account.to_string(), password.to_string());
    let json = encode_vault(entries)?;
    raw_item_set(service, VAULT_ACCOUNT, &json)
}

pub fn delete_password(service: &str, account: &str) {
    let mut vault = vault_lock();
    let _ = ensure_loaded(&mut vault, service, false, account);
    let entries = vault.entry(service.to_string()).or_default();
    if entries.remove(account).is_some() {
        if let Ok(json) = encode_vault(entries) {
            let _ = raw_item_set(service, VAULT_ACCOUNT, &json);
        }
    }
    if account != VAULT_ACCOUNT {
        raw_item_delete(service, account);
    }
}

/// Force a fresh read of the vault item from the OS, discarding whatever
/// this process has cached, then return `account`'s value. Used right after
/// Touch ID so a copy cached by an earlier, non-biometric call can't stand
/// in for a value that's supposed to require re-authentication.
pub fn get_password_uncached(service: &str, account: &str) -> Result<Option<String>, String> {
    let mut vault = vault_lock();
    ensure_loaded(&mut vault, service, true, account)?;
    Ok(vault
        .get(service)
        .and_then(|entries| entries.get(account))
        .cloned())
}

/// The vault caches per-`service` (every secret shares one OS item), not
/// per-key, so forgetting evicts that whole service's cached map. The next
/// access reloads from the OS, which already reflects the latest write.
pub fn forget_cached_password(service: &str, _account: &str) {
    vault_lock().remove(service);
}

// Release-only OS keyring path. `tauri dev` (debug) uses
// `crate::dev::keyring_store` so these helpers are not compiled there.
#[cfg(not(debug_assertions))]
fn legacy_entry(service: &str, account: &str) -> Result<keyring::Entry, String> {
    keyring::Entry::new(service, account).map_err(|e| format!("Keyring unavailable: {e}"))
}

#[cfg(not(debug_assertions))]
fn legacy_get(service: &str, account: &str) -> Result<Option<String>, String> {
    match legacy_entry(service, account)?.get_password() {
        Ok(password) => Ok(Some(password)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(format!("Failed to read keyring: {e}")),
    }
}

#[cfg(all(not(debug_assertions), not(target_os = "macos")))]
fn legacy_set(service: &str, account: &str, password: &str) -> Result<(), String> {
    legacy_entry(service, account)?
        .set_password(password)
        .map_err(|e| format!("Failed to write keyring: {e}"))
}

#[cfg(not(debug_assertions))]
fn legacy_delete(service: &str, account: &str) {
    if let Ok(entry) = legacy_entry(service, account) {
        let _ = entry.delete_credential();
    }
}

#[cfg(all(not(debug_assertions), not(target_os = "macos")))]
fn platform_get(service: &str, account: &str) -> Result<Option<String>, String> {
    legacy_get(service, account)
}

#[cfg(all(not(debug_assertions), not(target_os = "macos")))]
fn platform_set(service: &str, account: &str, password: &str) -> Result<(), String> {
    legacy_set(service, account, password)
}

#[cfg(all(not(debug_assertions), not(target_os = "macos")))]
fn platform_delete(service: &str, account: &str) {
    legacy_delete(service, account);
}

#[cfg(all(not(debug_assertions), target_os = "macos"))]
fn macos_query_options(
    service: &str,
    account: &str,
    protected: bool,
) -> security_framework::passwords::PasswordOptions {
    use security_framework::passwords::PasswordOptions;
    let mut options = PasswordOptions::new_generic_password(service, account);
    if protected {
        options.use_protected_keychain();
    }
    options
}

#[cfg(all(not(debug_assertions), target_os = "macos"))]
fn macos_write_options(
    service: &str,
    account: &str,
    protected: bool,
) -> security_framework::passwords::PasswordOptions {
    let mut options = macos_query_options(service, account, protected);
    options.set_label("Relaybase");
    options
}

#[cfg(all(not(debug_assertions), target_os = "macos"))]
fn macos_secitem_get(
    service: &str,
    account: &str,
    protected: bool,
) -> Result<Option<String>, String> {
    use security_framework::passwords::generic_password;
    match generic_password(macos_query_options(service, account, protected)) {
        Ok(bytes) => String::from_utf8(bytes)
            .map(Some)
            .map_err(|e| format!("Corrupt keyring session: {e}")),
        Err(err) if err.code() == ERR_SEC_ITEM_NOT_FOUND => Ok(None),
        Err(err) => Err(format!("Keyring unavailable: {err}")),
    }
}

#[cfg(all(not(debug_assertions), target_os = "macos"))]
fn macos_secitem_set(
    service: &str,
    account: &str,
    password: &str,
    protected: bool,
) -> Result<(), String> {
    use security_framework::passwords::set_generic_password_options;
    set_generic_password_options(
        password.as_bytes(),
        macos_write_options(service, account, protected),
    )
    .map_err(|e| format!("Failed to write keyring: {e}"))
}

#[cfg(all(not(debug_assertions), target_os = "macos"))]
fn macos_secitem_delete(service: &str, account: &str, protected: bool) {
    use security_framework::passwords::delete_generic_password_options;
    let _ = delete_generic_password_options(macos_query_options(service, account, protected));
}

/// Write via login-keychain SecItem. Deletes first so we replace the old
/// ACL-bound `keyring` item instead of `SecItemUpdate`-ing it (which would
/// keep the “Always Allow” ACL). Do not call the `keyring` crate delete
/// here — it uses `find_generic_password` and prompts again.
#[cfg(all(not(debug_assertions), target_os = "macos"))]
fn macos_write_preferred(service: &str, account: &str, password: &str) -> Result<(), String> {
    macos_secitem_delete(service, account, false);
    macos_secitem_set(service, account, password, false)
}

#[cfg(all(not(debug_assertions), target_os = "macos"))]
fn platform_get(service: &str, account: &str) -> Result<Option<String>, String> {
    match macos_secitem_get(service, account, false) {
        Ok(Some(password)) => {
            if macos_write_preferred(service, account, &password).is_ok() {
                log::info!(
                    "Migrated keychain item {service}/{account} off the legacy login-keychain ACL"
                );
            }
            return Ok(Some(password));
        }
        Ok(None) => {}
        Err(err) => log::warn!("{err}; trying legacy keyring crate"),
    }
    match legacy_get(service, account)? {
        Some(password) => {
            if macos_write_preferred(service, account, &password).is_ok() {
                log::info!(
                    "Migrated keychain item {service}/{account} off the legacy login-keychain ACL"
                );
            }
            Ok(Some(password))
        }
        None => Ok(None),
    }
}

#[cfg(all(not(debug_assertions), target_os = "macos"))]
fn platform_set(service: &str, account: &str, password: &str) -> Result<(), String> {
    macos_write_preferred(service, account, password)
}

#[cfg(all(not(debug_assertions), target_os = "macos"))]
fn platform_delete(service: &str, account: &str) {
    macos_secitem_delete(service, account, true);
    macos_secitem_delete(service, account, false);
    legacy_delete(service, account);
}

/// Exercises the real macOS `SecItem` login-keychain path (only compiled for
/// `cargo test --release`, where `debug_assertions` is off). Uses a private
/// service name so it never touches the packaged app's real
/// `com.relaybase.desktop` secrets, and cleans up after itself.
#[cfg(all(test, not(debug_assertions), target_os = "macos"))]
mod vault_selftest {
    use super::*;

    const TEST_SERVICE: &str = "com.relaybase.desktop.keyring-selftest";

    fn cleanup() {
        platform_delete(TEST_SERVICE, VAULT_ACCOUNT);
        platform_delete(TEST_SERVICE, "legacy-a");
        platform_delete(TEST_SERVICE, "legacy-b");
        platform_delete(TEST_SERVICE, "fresh-c");
    }

    #[test]
    fn consolidates_legacy_items_into_one_vault_item() {
        cleanup();

        // Simulate the OLD one-item-per-secret layout by writing straight
        // through the raw per-item primitive, bypassing the vault.
        platform_set(TEST_SERVICE, "legacy-a", "value-a").expect("seed legacy-a");
        platform_set(TEST_SERVICE, "legacy-b", "value-b").expect("seed legacy-b");

        // Before migration: two separate OS items exist, no vault item yet.
        assert_eq!(
            macos_secitem_get(TEST_SERVICE, "legacy-a", false).unwrap(),
            Some("value-a".to_string()),
            "legacy-a should exist as its own OS item before migration"
        );
        assert_eq!(
            macos_secitem_get(TEST_SERVICE, VAULT_ACCOUNT, false).unwrap(),
            None,
            "vault item should not exist yet"
        );

        // Public API reads transparently migrate each legacy item.
        assert_eq!(
            get_password(TEST_SERVICE, "legacy-a").unwrap(),
            Some("value-a".to_string())
        );
        assert_eq!(
            get_password(TEST_SERVICE, "legacy-b").unwrap(),
            Some("value-b".to_string())
        );

        // A fresh write goes straight into the vault, no legacy item at all.
        set_password(TEST_SERVICE, "fresh-c", "value-c").expect("set fresh-c");

        // After migration: the legacy items are gone from the OS ...
        assert_eq!(
            macos_secitem_get(TEST_SERVICE, "legacy-a", false).unwrap(),
            None,
            "legacy-a item should have been deleted after migrating into the vault"
        );
        assert_eq!(
            macos_secitem_get(TEST_SERVICE, "legacy-b", false).unwrap(),
            None,
            "legacy-b item should have been deleted after migrating into the vault"
        );
        // ... and exactly one vault item holds all three keys.
        let raw = macos_secitem_get(TEST_SERVICE, VAULT_ACCOUNT, false)
            .unwrap()
            .expect("vault item should exist after migration");
        let entries = decode_vault(&raw);
        assert_eq!(entries.get("legacy-a").map(String::as_str), Some("value-a"));
        assert_eq!(entries.get("legacy-b").map(String::as_str), Some("value-b"));
        assert_eq!(entries.get("fresh-c").map(String::as_str), Some("value-c"));
        assert_eq!(entries.len(), 3, "vault should hold exactly the 3 keys written");

        // delete_password removes just one key and rewrites the same item.
        delete_password(TEST_SERVICE, "fresh-c");
        let raw = macos_secitem_get(TEST_SERVICE, VAULT_ACCOUNT, false)
            .unwrap()
            .expect("vault item should still exist");
        let entries = decode_vault(&raw);
        assert!(!entries.contains_key("fresh-c"));
        assert_eq!(entries.len(), 2);

        cleanup();

        // Fully torn down: no vault item and no stray legacy items remain.
        assert_eq!(
            macos_secitem_get(TEST_SERVICE, VAULT_ACCOUNT, false).unwrap(),
            None
        );
    }
}
