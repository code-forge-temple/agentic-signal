use std::process::Command;
use std::env;
use std::path::PathBuf;

mod oauth;

fn main() {
    tauri::Builder::default()
        .setup(|_app| {
            // Get the path to the executable directory
            let exe_dir = env::current_exe()
                .ok()
                .and_then(|p| p.parent().map(|p| p.to_path_buf()))
                .unwrap_or_else(|| PathBuf::from("."));

            #[cfg(target_os = "windows")]
            let backend_path = exe_dir.join("bin").join("agentic-signal-backend.exe");
            #[cfg(target_os = "linux")]
            let backend_path = exe_dir.join("bin").join("agentic-signal-backend-linux");
            #[cfg(target_os = "macos")]
            let backend_path = exe_dir.join("bin").join("agentic-signal-backend-macos");

            Command::new(backend_path)
                .spawn()
                .expect("Failed to start backend");
            Ok(())
        })
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![oauth::start_oauth_flow])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}