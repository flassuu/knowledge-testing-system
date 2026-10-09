// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // WebKitGTK's DMA-BUF renderer flickers and leaves artifacts on several Linux
    // GPU drivers - NVIDIA most of all - because it asks the driver for buffer
    // formats it does not provide. Every repaint then shows a torn frame, which
    // in this app reads as the whole window blinking when a menu opens. This is
    // the documented Tauri workaround; it must be set before the webview is
    // created. A value already in the environment wins, so a working setup that
    // wants the fast path can keep it.
    #[cfg(target_os = "linux")]
    if std::env::var_os("WEBKIT_DISABLE_DMABUF_RENDERER").is_none() {
        std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1")
    }

    lantern_teacher_lib::run()
}
