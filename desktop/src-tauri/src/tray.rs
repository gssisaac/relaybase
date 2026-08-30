//! System tray: left-click shows the main window; right-click Quit.
//! Closing the window hides to tray instead of quitting.
//! Unread badge is composited at runtime (mac-purity overlay + black ring/N).

use std::sync::atomic::{AtomicBool, Ordering};

use tauri::image::Image;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{App, AppHandle, Manager, WindowEvent};

pub const TRAY_ID: &str = "relaybase-tray";

const RED_RGBA: [u8; 4] = [255, 59, 48, 255];
const BLACK_RGBA: [u8; 4] = [0, 0, 0, 255];

static TRAY_HAS_UNREAD: AtomicBool = AtomicBool::new(false);

fn base_icon() -> Image<'static> {
    tauri::include_image!("icons/tray-mail.png")
}

pub fn show_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

pub fn apply_tray_unread(app: &AppHandle, has_unread: bool) {
    let Some(tray) = app.tray_by_id(TRAY_ID) else {
        TRAY_HAS_UNREAD.store(has_unread, Ordering::Relaxed);
        return;
    };
    if TRAY_HAS_UNREAD.swap(has_unread, Ordering::Relaxed) == has_unread {
        return;
    }
    set_tray_icon(&tray, has_unread);
}

fn set_tray_icon(tray: &tauri::tray::TrayIcon, has_unread: bool) {
    let base = base_icon();
    let icon = if has_unread {
        overlay_unread_badge(&base)
    } else {
        base
    };
    let _ = tray.set_icon_with_as_template(Some(icon), false);
}

/// Hide main window on close instead of quitting (process stays alive via tray).
pub fn attach_close_to_hide(window: &tauri::WebviewWindow) {
    let hide_target = window.clone();
    window.on_window_event(move |event| {
        if let WindowEvent::CloseRequested { api, .. } = event {
            api.prevent_close();
            let _ = hide_target.hide();
        }
    });
}

pub fn setup_tray(app: &App) -> Result<(), Box<dyn std::error::Error>> {
    let quit_item = MenuItem::with_id(app, "quit", "Quit Relaybase", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&quit_item])?;

    TrayIconBuilder::with_id(TRAY_ID)
        .icon(base_icon())
        .icon_as_template(false)
        .tooltip("Relaybase")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| {
            if event.id.as_ref() == "quit" {
                app.exit(0);
            }
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_main_window(tray.app_handle());
            }
        })
        .build(app)?;

    if TRAY_HAS_UNREAD.load(Ordering::Relaxed) {
        if let Some(tray) = app.tray_by_id(TRAY_ID) {
            set_tray_icon(&tray, true);
        }
    }

    Ok(())
}

#[tauri::command]
pub fn set_tray_unread(app: AppHandle, has_unread: bool) -> Result<(), String> {
    apply_tray_unread(&app, has_unread);
    Ok(())
}

/// mac-purity `overlay_status_dot` geometry, plus black ring + black N.
fn overlay_unread_badge(base: &Image<'_>) -> Image<'static> {
    let width = base.width();
    let height = base.height();
    let mut rgba = base.rgba().to_vec();
    let min_side = width.min(height) as f32;
    let radius = (min_side * 0.30).max(2.5);
    let cx = width as f32 - radius;
    let cy = height as f32 - radius;
    // ~1px ring when the 128px icon is shown at ~22px menu-bar size.
    let border = (min_side / 22.0).max(1.0);
    let inner_r = (radius - border).max(1.0);

    for y in 0..height {
        for x in 0..width {
            let dx = x as f32 + 0.5 - cx;
            let dy = y as f32 + 0.5 - cy;
            let dist = (dx * dx + dy * dy).sqrt();
            let outer_a = coverage(dist, radius);
            if outer_a <= 0.0 {
                continue;
            }
            let i = ((y * width + x) * 4) as usize;
            blend_pixel(&mut rgba[i..i + 4], BLACK_RGBA, outer_a);
            let inner_a = coverage(dist, inner_r);
            if inner_a > 0.0 {
                blend_pixel(&mut rgba[i..i + 4], RED_RGBA, inner_a);
            }
        }
    }

    paint_letter_n(&mut rgba, width, height, cx, cy, inner_r);
    Image::new_owned(rgba, width, height)
}

fn paint_letter_n(rgba: &mut [u8], width: u32, height: u32, cx: f32, cy: f32, inner_r: f32) {
    let half_h = inner_r * 0.42;
    let half_w = inner_r * 0.32;
    let stroke = (inner_r * 0.18).max(1.4);
    let left_x = cx - half_w;
    let right_x = cx + half_w;
    let top_y = cy - half_h;
    let bot_y = cy + half_h;
    let segments = [
        (left_x, top_y, left_x, bot_y),
        (right_x, top_y, right_x, bot_y),
        (left_x, top_y, right_x, bot_y),
    ];

    for y in 0..height {
        for x in 0..width {
            let px = x as f32 + 0.5;
            let py = y as f32 + 0.5;
            let mut best = f32::MAX;
            for &(x0, y0, x1, y1) in &segments {
                best = best.min(dist_to_segment(px, py, x0, y0, x1, y1));
            }
            let a = coverage(best, stroke * 0.5);
            if a <= 0.0 {
                continue;
            }
            let i = ((y * width + x) * 4) as usize;
            blend_pixel(&mut rgba[i..i + 4], BLACK_RGBA, a);
        }
    }
}

fn dist_to_segment(px: f32, py: f32, x0: f32, y0: f32, x1: f32, y1: f32) -> f32 {
    let vx = x1 - x0;
    let vy = y1 - y0;
    let wx = px - x0;
    let wy = py - y0;
    let len2 = vx * vx + vy * vy;
    let t = if len2 <= 0.0 {
        0.0
    } else {
        ((wx * vx + wy * vy) / len2).clamp(0.0, 1.0)
    };
    let dx = px - (x0 + t * vx);
    let dy = py - (y0 + t * vy);
    (dx * dx + dy * dy).sqrt()
}

fn coverage(dist: f32, radius: f32) -> f32 {
    let edge = 0.7;
    if dist <= radius - edge {
        1.0
    } else if dist >= radius + edge {
        0.0
    } else {
        (radius + edge - dist) / (2.0 * edge)
    }
}

fn blend_pixel(dest: &mut [u8], src: [u8; 4], alpha: f32) {
    let src_a = (src[3] as f32 / 255.0) * alpha.clamp(0.0, 1.0);
    if src_a <= 0.0 {
        return;
    }
    let inv = 1.0 - src_a;
    dest[0] = (src[0] as f32 * src_a + dest[0] as f32 * inv).round() as u8;
    dest[1] = (src[1] as f32 * src_a + dest[1] as f32 * inv).round() as u8;
    dest[2] = (src[2] as f32 * src_a + dest[2] as f32 * inv).round() as u8;
    dest[3] = ((src_a * 255.0) + dest[3] as f32 * inv)
        .round()
        .clamp(0.0, 255.0) as u8;
}
