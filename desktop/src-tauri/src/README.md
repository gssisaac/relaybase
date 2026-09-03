# Relaybase Desktop Rust Backend (`src-tauri/src`)

## 1. Architecture Overview

Relaybase Desktop is built on Tauri 2.x and Rust. The backend is structured into 5 production domain modules and 1 dev/testing module with strict boundaries, decoupled IPC command registration, and clear security invariants.

```
desktop/src-tauri/src/
├── main.rs                      # Tauri binary entry point
├── lib.rs                       # Lightweight app builder, plugin registration & IPC dispatcher (~120 lines)
├── README.md                    # Root architecture index & agent navigation guide
│
├── auth/                        # [Module 1] Authentication, OS Keyring, Biometrics & Session Machine
├── cloudflare/                  # [Module 2] Cloudflare REST API, OAuth PKCE & Loopback Server
├── auto_install/                # [Module 3] Routing Worker Automated Deploy, DB Schema & Rollback
├── storage/                     # [Module 4] Local ~/.relaybase Persistence, Mail Store & Key Vault
├── shell/                       # [Module 5] Native Window Chrome, System Tray, Notifications & Files
└── dev/                         # [Module 6] Debug-only test fixtures and local file caches (debug builds only)
```

---

## 2. Subsystem Directory Index

| Module | Core Responsibility | Agent Guide |
|---|---|---|
| [`auth/`](auth/README.md) | Owner passtoken (`owner-passtoken`, Touch ID gated), owner session (`owner-session`), team session, OS keyring abstraction | [`auth/README.md`](auth/README.md) |
| [`cloudflare/`](cloudflare/README.md) | Cloudflare REST client, OAuth PKCE flow, loopback TCP server (port 32831), manual Worker probe/deploy | [`cloudflare/README.md`](cloudflare/README.md) |
| [`auto_install/`](auto_install/README.md) | Automated Worker deployment, D1 database provisioning (`init-db`/`migrate-db`), R2 bucket setup, rollback | [`auto_install/README.md`](auto_install/README.md) |
| [`storage/`](storage/README.md) | `~/.relaybase` directory layout, `workspace.json`, mail JSON/EML atoms, API key vault, WebKit data cleanup | [`storage/README.md`](storage/README.md) |
| [`shell/`](shell/README.md) | Main window builder with iframe navigation security guards, system tray with dynamic unread badge, notifications | [`shell/README.md`](shell/README.md) |
| [`dev/`](dev/README.md) | `tauri dev` temporary filesystem cache for OAuth and mocked keyring | [`dev/README.md`](dev/README.md) |

---

## 3. Tauri IPC Command Map (67 Commands)

All IPC commands are invoked by the frontend through TypeScript bridges in `app/src/lib/desktop/bridge/*`.

### Storage & Persistence (`storage::commands`)
| Command | Bridge Function | Purpose |
|---|---|---|
| `get_credentials` | `getCredentials()` | Reads current workspace credentials |
| `save_cf_credentials` | `saveCfCredentials()` | Saves CF credentials to disk |
| `clear_stored_credentials` | `clearStoredCredentials()` | Clears workspace credentials |
| `clear_webkit_data_cmd` | `clearWebkitData()` | Purges WebKit caches and IndexedDB |
| `factory_reset_cmd` | `factoryReset()` | Full wipe of `~/.relaybase` and WebKit state |
| `get_email_prefs` | `getEmailPrefs()` | Reads email UI preferences |
| `save_email_prefs` | `saveEmailPrefs()` | Saves email UI preferences |
| `get_api_key_vault` | `getApiKeyVault()` | Reads API keys from vault |
| `save_api_key_vault_entry` | `saveApiKeyVaultEntry()` | Upserts API key into vault |
| `remove_api_key_vault_entry_cmd` | `removeApiKeyVaultEntry()` | Deletes API key from vault |
| `migrate_mail_user_folder` | `migrateMailUserFolder()` | Migrates legacy user mail folder |
| `get_account_scope_id` | `getAccountScopeId()` | Resolves multi-account folder scope |
| `migrate_storage_layout` | `migrateStorageLayout()` | Runs storage schema migration |
| `get_mail_json` | `getMailJson()` | Reads mail atom JSON |
| `save_mail_json` | `saveMailJson()` | Writes mail atom JSON |
| `get_mail_binary` | `getMailBinary()` | Reads raw EML or attachment bytes |
| `save_mail_binary` | `saveMailBinary()` | Writes raw EML or attachment bytes |
| `delete_mail_binary` | `deleteMailBinary()` | Deletes binary mail file |
| `delete_mail_binary_dir` | `deleteMailBinaryDir()` | Deletes binary mail directory |
| `get_cache_json` | `getCacheJson()` | Reads local JSON cache |
| `save_cache_json` | `saveCacheJson()` | Writes local JSON cache |
| `save_relaybase_account` | `saveRelaybaseAccount()` | Saves account metadata |
| `clear_relaybase_account` | `clearRelaybaseAccount()` | Clears account metadata |
| `get_team_login` | `getTeamLogin()` | Loads saved team member login |
| `save_team_login_cmd` | `saveTeamLogin()` | Persists team member login |
| `clear_team_login_cmd` | `clearTeamLogin()` | Clears team member login |

### Cloudflare API & OAuth (`cloudflare::commands`)
| Command | Bridge Function | Purpose |
|---|---|---|
| `verify_cf_token` | `verifyCfToken()` | Verifies Cloudflare API token permissions |
| `probe_routing_worker` | `probeRoutingWorker()` | Probes Worker script status |
| `adopt_routing_worker` | `adoptRoutingWorker()` | Adopts existing Worker into workspace |
| `install_routing_worker` | `installRoutingWorker()` | Manually uploads and binds Worker |
| `update_routing_worker` | `updateRoutingWorker()` | Manually updates Worker script |
| `start_cf_oauth` | `startCfOauth()` | Starts Cloudflare OAuth PKCE flow |
| `complete_cf_oauth` | `completeCfOauth()` | Completes OAuth token exchange |
| `refresh_install_token` | `refreshInstallToken()` | Refreshes OAuth install access token |
| `verify_worker_connection` | `verifyWorkerConnection()` | Verifies `/console/connect` endpoint |
| `save_worker_connection` | `saveWorkerConnection()` | Persists verified Worker connection |

### Auto Install & Updates (`auto_install::commands`)
| Command | Bridge Function | Purpose |
|---|---|---|
| `probe_auto_install` | `probeAutoInstall()` | Inspects Cloudflare resources before install |
| `auto_install_routing_worker` | `autoInstallRoutingWorker()` | Automated Worker + D1 + R2 provisioning |
| `cancel_auto_install` | `cancelAutoInstall()` | Cancels in-flight installation |
| `rollback_auto_install` | `rollbackAutoInstall()` | Tears down provisioned Cloudflare resources |
| `init_worker_db_cmd` | `initWorkerDb()` | Initializes schema on empty D1 databases |
| `migrate_worker_db_cmd` | `migrateWorkerDb()` | Migrates schema on existing D1 databases |
| `push_server_token` | `pushServerToken()` | Sets `CF_API_TOKEN` secret on Worker |
| `check_worker_update_cmd` | `checkWorkerUpdate()` | Checks for new Worker release |
| `preview_worker_update_target_cmd` | `previewWorkerUpdateTarget()` | Inspects Worker update destination URL |
| `update_installed_worker_cmd` | `updateInstalledWorker()` | Deploys update over existing Worker |

### Shell, System & Files (`shell::commands`)
| Command | Bridge Function | Purpose |
|---|---|---|
| `get_desktop_info` | `getDesktopInfo()` | Desktop version, OS platform, and architecture |
| `open_external_url` | `openExternalUrl()` | Opens URL in system default browser |
| `open_local_file_with_default_app` | `openLocalFileWithDefaultApp()` | Opens base64 attachment in native app |
| `save_download_file` | `saveDownloadFile()` | Saves file to OS Downloads folder |
| `open_file_path` | `openFilePath()` | Opens file path in default application |
| `reveal_file_in_folder` | `revealFileInFolder()` | Reveals file in Finder / Explorer |
| `show_notification` | `showNotification()` | Triggers desktop notification with action |
| `take_pending_open_mail` | `takePendingOpenMail()` | Consumes notification click payload |
| `set_tray_unread` | `setTrayUnread()` | Toggles tray unread badge |

### Auth & Session Machine (`auth::commands`)
| Command | Bridge Function | Purpose |
|---|---|---|
| `owner_session_status_cmd` | `ownerSessionStatus()` | Returns current owner session status |
| `owner_login_cmd` | `ownerLogin()` | Authenticates owner with passtoken |
| `owner_boot_mail_cmd` | `ownerBootMail()` | Silent boot for mail session |
| `owner_unlock_console_cmd` | `ownerUnlockConsole()` | Unlocks console session |
| `owner_logout_cmd` | `ownerLogout()` | Clears owner session from memory |
| `owner_login_from_keyring_cmd` | `ownerLoginFromKeyring()` | Authenticates owner using stored keyring token |
| `owner_touch_id_cmd` | `ownerTouchId()` | Biometric authentication for console unlock |
| `owner_setup_admin_cmd` | `ownerSetupAdmin()` | First-time owner registration |
| `owner_reset_admin_cmd` | `ownerResetAdmin()` | Resets owner credentials via recovery token |
| `worker_request_cmd` | `workerRequest()` | Authenticated proxy request to Worker |
| `team_session_status_cmd` | `teamSessionStatus()` | Returns team session state |
| `team_login_cmd` | `teamLogin()` | Authenticates team member with password |
| `team_unlock_cmd` | `teamUnlock()` | Unlocks team session |
| `team_logout_cmd` | `teamLogout()` | Logs out team member |
| `team_forget_session_cmd` | `teamForgetSession()` | Deletes team credentials from keyring |
| `team_worker_request_cmd` | `teamWorkerRequest()` | Authenticated team proxy request to Worker |

---

## 4. Security & Isolation Invariants

1. **Owner Passtoken Gate**: Owner passtoken is stored exclusively in OS Keyring under `owner-passtoken` and requires Touch ID/biometric verification on read.
2. **Access Tokens in Memory**: Access tokens (Cloudflare OAuth, Owner console/mail HMAC) reside strictly in process memory and are NEVER written to disk or local storage.
3. **Webview Sandboxing**: External URLs and email links (`<a target="_blank">`) are intercepted and routed to the native system browser via `shell::open_url_in_os_browser`.
4. **Local Data Scope**: All local files are restricted to `~/.relaybase/{scopeId}/` with file permissions `0o600` and directory permissions `0o700`.

---

## 5. Build & Test Commands

```bash
# Check compilation across all modules
cargo check --manifest-path desktop/src-tauri/Cargo.toml

# Run all backend unit tests (22+ unit tests)
cargo test --manifest-path desktop/src-tauri/Cargo.toml
```
