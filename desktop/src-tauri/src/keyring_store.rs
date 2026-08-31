//! OS secret store used by owner and team sessions.
//!
//! On macOS the `keyring` crate talks to the **login** keychain via the
//! legacy `SecKeychain` API. That path shows the system dialog
//! “Relaybase wants to use your confidential information stored in
//! 'com.relaybase.desktop'” and “Always Allow” does not stick: the ACL is
//! bound to the binary’s code signature, which changes across `tauri dev`
//! rebuilds and often across signed updates. Boot also reads owner + team
//! in parallel, so the same dialog appears twice.
//!
//! Debug builds delegate to `crate::dev::keyring_store` (tmp files) instead —
//! see `src/dev/`.
//!
//! This module uses the modern `SecItem` API on the login keychain (no
//! `keychain-access-groups` entitlement — Developer ID builds cannot use
//! that on macOS 26 without a provisioning profile). Avoids the legacy
//! `SecKeychainFindGenericPassword` path that shows “Always Allow” and does
//! not persist across launches. One-shot read of old `keyring` crate items,
//! then rewrite via SecItem and delete the ACL-bound copy.
//!
//! Windows / Linux keep using the `keyring` crate. All platforms share an
//! in-process cache so status + unlock + refresh do not re-hit the OS
//! store (and cannot stack two ACL dialogs during migration).

use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};

#[cfg(all(not(debug_assertions), target_os = "macos"))]
const ERR_SEC_ITEM_NOT_FOUND: i32 = -25300;

static CACHE: OnceLock<Mutex<HashMap<(String, String), Option<String>>>> = OnceLock::new();

fn cache_lock() -> std::sync::MutexGuard<'static, HashMap<(String, String), Option<String>>> {
    CACHE
        .get_or_init(|| Mutex::new(HashMap::new()))
        .lock()
        .unwrap_or_else(|e| e.into_inner())
}

fn cache_key(service: &str, account: &str) -> (String, String) {
    (service.to_string(), account.to_string())
}

pub fn get_password(service: &str, account: &str) -> Result<Option<String>, String> {
    let key = cache_key(service, account);
    let mut cache = cache_lock();
    if let Some(hit) = cache.get(&key) {
        return Ok(hit.clone());
    }
    let value = {
        #[cfg(debug_assertions)]
        {
            crate::dev::get_password(service, account)?
        }
        #[cfg(not(debug_assertions))]
        {
            platform_get(service, account)?
        }
    };
    cache.insert(key, value.clone());
    Ok(value)
}

pub fn set_password(service: &str, account: &str, password: &str) -> Result<(), String> {
    let key = cache_key(service, account);
    let mut cache = cache_lock();
    {
        #[cfg(debug_assertions)]
        crate::dev::set_password(service, account, password)?;
        #[cfg(not(debug_assertions))]
        platform_set(service, account, password)?;
    }
    cache.insert(key, Some(password.to_string()));
    Ok(())
}

pub fn delete_password(service: &str, account: &str) {
    let key = cache_key(service, account);
    let mut cache = cache_lock();
    {
        #[cfg(debug_assertions)]
        crate::dev::delete_password(service, account);
        #[cfg(not(debug_assertions))]
        platform_delete(service, account);
    }
    cache.insert(key, None);
}

/// Existence check that does not cache the secret. Used for `owner-passtoken`.
pub fn has_password(service: &str, account: &str) -> Result<bool, String> {
    let key = cache_key(service, account);
    {
        let cache = cache_lock();
        if let Some(hit) = cache.get(&key) {
            return Ok(hit.as_ref().is_some_and(|s| !s.is_empty()));
        }
    }
    #[cfg(debug_assertions)]
    {
        return crate::dev::has_password(service, account);
    }
    #[cfg(not(debug_assertions))]
    {
        let value = platform_get(service, account)?;
        Ok(value.as_ref().is_some_and(|s| !s.is_empty()))
    }
}

/// Read without the in-process cache so a prior write cannot skip Touch ID.
pub fn get_password_uncached(service: &str, account: &str) -> Result<Option<String>, String> {
    #[cfg(debug_assertions)]
    {
        crate::dev::get_password(service, account)
    }
    #[cfg(not(debug_assertions))]
    {
        platform_get(service, account)
    }
}

pub fn forget_cached_password(service: &str, account: &str) {
    cache_lock().remove(&cache_key(service, account));
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
