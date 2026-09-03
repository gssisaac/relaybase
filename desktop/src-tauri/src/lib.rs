pub mod auth;
pub mod auto_install;
pub mod cloudflare;
pub mod shell;
pub mod storage;

#[cfg(debug_assertions)]
pub mod dev;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build());

    // Touch ID (macOS) / Windows Hello. Linux has no plugin backend — JS
    // checkStatus fails closed and the unlock UI falls back to passtoken.
    #[cfg(any(target_os = "macos", target_os = "windows"))]
    {
        builder = builder.plugin(tauri_plugin_biometry::init());
    }

    builder
        .setup(|app| {
            #[cfg(debug_assertions)]
            {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
                // DEV-MODE TESTING ONLY: restore CF OAuth from ~/.relaybase/tmp/
                storage::hydrate_cf_oauth_session_dev_cache();
            }
            #[cfg(not(debug_assertions))]
            {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Warn)
                        .build(),
                )?;
            }

            // Storage migrations
            if let Err(e) = storage::migrate_storage_layout_v2() {
                log::warn!("storage layout migration failed: {e}");
            }
            if let Err(e) = storage::migrate_mail_to_desktop_user() {
                log::warn!("mail user migration failed: {e}");
            }

            // Seed ~/.relaybase/icon.png for notification identity image.
            if let Err(e) = shell::ensure_notification_icon() {
                log::warn!("notification icon seed failed: {e}");
            }

            // Deep-link registration & OAuth loopback server
            if let Err(e) = shell::setup_deep_link(app) {
                log::warn!("deep link setup failed: {e}");
            }

            // Programmatic main window builder
            let main_window = shell::build_main_window(app)?;
            shell::attach_close_to_hide(&main_window);

            if let Err(e) = shell::setup_tray(app) {
                log::warn!("tray setup failed: {e}");
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // storage commands
            storage::save_cf_credentials,
            storage::get_credentials,
            storage::clear_stored_credentials,
            storage::clear_webkit_data_cmd,
            storage::factory_reset_cmd,
            storage::get_email_prefs,
            storage::save_email_prefs,
            storage::get_api_key_vault,
            storage::save_api_key_vault_entry,
            storage::remove_api_key_vault_entry_cmd,
            storage::migrate_mail_user_folder,
            storage::get_account_scope_id,
            storage::migrate_storage_layout,
            storage::get_mail_json,
            storage::save_mail_json,
            storage::get_mail_binary,
            storage::save_mail_binary,
            storage::delete_mail_binary,
            storage::delete_mail_binary_dir,
            storage::get_cache_json,
            storage::save_cache_json,
            storage::save_relaybase_account,
            storage::clear_relaybase_account,
            storage::get_team_login,
            storage::save_team_login_cmd,
            storage::clear_team_login_cmd,
            // cloudflare commands
            cloudflare::verify_cf_token,
            cloudflare::probe_routing_worker,
            cloudflare::adopt_routing_worker,
            cloudflare::install_routing_worker,
            cloudflare::update_routing_worker,
            cloudflare::start_cf_oauth,
            cloudflare::complete_cf_oauth,
            cloudflare::refresh_install_token,
            cloudflare::verify_worker_connection,
            cloudflare::save_worker_connection,
            // auto_install commands
            auto_install::probe_auto_install,
            auto_install::auto_install_routing_worker,
            auto_install::cancel_auto_install,
            auto_install::rollback_auto_install,
            auto_install::init_worker_db_cmd,
            auto_install::migrate_worker_db_cmd,
            auto_install::push_server_token,
            auto_install::check_worker_update_cmd,
            auto_install::preview_worker_update_target_cmd,
            auto_install::update_installed_worker_cmd,
            // shell commands
            shell::get_desktop_info,
            shell::open_external_url,
            shell::open_local_file_with_default_app,
            shell::save_download_file,
            shell::open_file_path,
            shell::reveal_file_in_folder,
            shell::show_notification,
            shell::take_pending_open_mail,
            shell::set_tray_unread,
            // auth commands
            auth::owner_session_status_cmd,
            auth::owner_login_cmd,
            auth::owner_boot_mail_cmd,
            auth::owner_unlock_console_cmd,
            auth::owner_logout_cmd,
            auth::owner_login_from_keyring_cmd,
            auth::owner_touch_id_cmd,
            auth::owner_setup_admin_cmd,
            auth::owner_reset_admin_cmd,
            auth::worker_request_cmd,
            auth::team_session_status_cmd,
            auth::team_login_cmd,
            auth::team_unlock_cmd,
            auth::team_logout_cmd,
            auth::team_forget_session_cmd,
            auth::team_worker_request_cmd,
        ])
        .build(tauri::generate_context!())
        .expect("error while building Relaybase desktop")
        .run(|app, event| {
            // macOS: dock icon click while running (window often hidden after close).
            if let tauri::RunEvent::Reopen { .. } = event {
                shell::show_main_window(app);
            }
        });
}
