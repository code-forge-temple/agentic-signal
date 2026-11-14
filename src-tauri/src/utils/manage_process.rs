
use tauri::State;
use std::path::Path;
use std::process::{Child, Command};
use std::sync::{Arc, Mutex};

pub struct BackendProcess(pub Arc<Mutex<Option<Child>>>);

/// Starts the backend. A release build gives it no console window (Windows) and writes its output to `backend.log`
/// in the app's log folder, overwritten at each start. A debug build (`tauri dev`) leaves the output in the terminal
/// the app was started from.
pub fn start_backend(app: &tauri::App, backend_path: &Path) -> std::io::Result<Child> {
    let mut command = Command::new(backend_path);

    #[cfg(not(debug_assertions))]
    release_output(app, &mut command);
    #[cfg(debug_assertions)]
    let _ = app;

    command.spawn()
}

/// Real handles for all three streams, not none: Playwright can't start Chrome on Windows when they're missing
/// (EBADF). Without a log file the output is dropped.
#[cfg(not(debug_assertions))]
fn release_output(app: &tauri::App, command: &mut Command) {
    use std::process::Stdio;

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;

        // The app itself has no console in a release build (windows_subsystem), so Windows would open one for the
        // backend.
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;

        command.creation_flags(CREATE_NO_WINDOW);
    }

    command.stdin(Stdio::null());

    match open_log(app) {
        Ok((out, err)) => command.stdout(out).stderr(err),
        Err(_) => command.stdout(Stdio::null()).stderr(Stdio::null()),
    };
}

#[cfg(not(debug_assertions))]
fn open_log(app: &tauri::App) -> std::io::Result<(std::fs::File, std::fs::File)> {
    use tauri::Manager;

    let dir = app.path().app_log_dir().map_err(std::io::Error::other)?;

    std::fs::create_dir_all(&dir)?;

    // Created anew: one start's log, so it can't grow without end.
    let out = std::fs::File::create(dir.join("backend.log"))?;
    let err = out.try_clone()?;

    Ok((out, err))
}

/// Stops the backend, if it runs, and waits for it to end.
pub fn stop_backend(process: &BackendProcess) -> Result<(), String> {
    let mut lock = process.0.lock().map_err(|e| e.to_string())?;

    let Some(mut child) = lock.take() else {
        return Err("No backend process found".to_string());
    };

    child.kill().map_err(|e| e.to_string())?;
    let _ = child.wait();

    Ok(())
}

#[tauri::command]
pub fn kill_backend_process(state: State<BackendProcess>) -> Result<(), String> {
    stop_backend(&state)
}
