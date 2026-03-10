
use tauri::State;
use std::process::Child;
use std::sync::{Arc, Mutex};

pub struct BackendProcess(pub Arc<Mutex<Option<Child>>>);

#[tauri::command]
pub fn kill_backend_process(state: State<BackendProcess>) -> Result<(), String> {
    let mut lock = state.0.lock().unwrap();

    if let Some(child) = lock.as_mut() {
        child.kill().map_err(|e| e.to_string())?;

        lock.take();
        
        Ok(())
    } else {
        Err("No backend process found".to_string())
    }
}