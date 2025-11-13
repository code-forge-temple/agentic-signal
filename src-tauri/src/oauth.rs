use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use tiny_http::{Response, Server};
use std::time::Duration;
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};

const OAUTH_CALLBACK_HTML: &str = include_str!("oauth_callback.html");
const AUTHENTICATION_CANCELLED: &str = "Authentication cancelled";

#[derive(Debug, Serialize, Deserialize)]
pub struct OAuthResult {
    #[serde(rename = "accessToken")]
    access_token: String,
}

// Global state to track if server is already running
lazy_static::lazy_static! {
    static ref SERVER_RUNNING: Arc<Mutex<bool>> = Arc::new(Mutex::new(false));
    static ref SERVER_READY: Arc<Mutex<bool>> = Arc::new(Mutex::new(false));
    static ref FLOW_COUNTER: Arc<Mutex<u32>> = Arc::new(Mutex::new(0));
}

#[tauri::command]
pub async fn start_oauth_flow(
    app: tauri::AppHandle,
    client_id: String,
    scope: String,
) -> Result<OAuthResult, String> {   
    let redirect_uri = "http://localhost:8080/callback";
    
    // Build OAuth URL
    let auth_url = format!(
        "https://accounts.google.com/o/oauth2/v2/auth?client_id={}&redirect_uri={}&response_type=token&scope={}",
        urlencoding::encode(&client_id),
        urlencoding::encode(redirect_uri),
        urlencoding::encode(&scope)
    );
    
    // Start server if not already running
    let should_start_server = {
        let mut server_running = SERVER_RUNNING.lock().unwrap();
        if !*server_running {
            *server_running = true;
            true
        } else {
            false
        }
    };
    
    if should_start_server {
        // Spawn persistent server in blocking task
        tokio::task::spawn_blocking(|| {
            if let Err(_e) = run_oauth_server_blocking() {
                *SERVER_RUNNING.lock().unwrap() = false;
                *SERVER_READY.lock().unwrap() = false;
            }
        });
        
        // Wait for server to be ready (up to 5 seconds)
        let mut ready = false;
        for _ in 0..50 {
            tokio::time::sleep(Duration::from_millis(100)).await;
            if *SERVER_READY.lock().unwrap() {
                ready = true;
                break;
            }
        }
        
        if !ready {
            return Err("OAuth server failed to start. Please try again.".to_string());
        }
        
        // Additional safety wait
        tokio::time::sleep(Duration::from_millis(200)).await;
    }
    
    // IMPORTANT: Close existing OAuth window if it exists
    if let Some(existing_window) = app.get_webview_window("oauth") {
        let _ = existing_window.close();
        // Wait a bit for window to close completely
        tokio::time::sleep(Duration::from_millis(150)).await;
    }
    
    // Create a oneshot channel for token communication BEFORE opening window
    let (tx, rx) = tokio::sync::oneshot::channel();
    
    // Store in global state for server to access
    {
        let mut pending = PENDING_AUTH.lock().unwrap();
        pending.push(tx);
    }
    
    // Always create a FRESH OAuth window
    let oauth_window = WebviewWindowBuilder::new(
        &app,
        "oauth",
        WebviewUrl::External(auth_url.parse().map_err(|e| format!("Invalid URL: {}", e))?)
    )
    .title("Sign in with Google")
    .inner_size(500.0, 600.0)
    .center()
    .resizable(true)
    .build()
    .map_err(|e| format!("Failed to create OAuth window: {}", e))?;
    
    // Track if window was closed by user
    let window_closed = Arc::new(Mutex::new(false));
    let window_closed_clone = window_closed.clone();
    
    // Listen for window close event
    let window_for_listener = oauth_window.clone();
    window_for_listener.on_window_event(move |event| {
        if let tauri::WindowEvent::Destroyed = event {
            *window_closed_clone.lock().unwrap() = true;
        }
    });
        
    // Wait for token with timeout
    let result = match tokio::time::timeout(Duration::from_secs(120), rx).await {
        Ok(Ok(token)) => {
            token
        }
        Ok(Err(_)) => {
            // Channel closed - window was closed or flow cancelled
            let _ = *window_closed.lock().unwrap();
            let _ = oauth_window.close();
            
            // Return generic error - user already saw the details in the window
            return Err(AUTHENTICATION_CANCELLED.to_string());
        }
        Err(_) => {
            // Timeout occurred
            let was_closed = *window_closed.lock().unwrap();
            
            if was_closed {
                // User closed window - they already saw error, don't show another one
                return Err(AUTHENTICATION_CANCELLED.to_string());
            } else {
                // Window still open but no response - close it silently
                let _ = oauth_window.close();
                return Err(AUTHENTICATION_CANCELLED.to_string());
            }
        }
    };
    
    // Close window after success
    let _ = oauth_window.close();
        
    Ok(OAuthResult { 
        access_token: result 
    })
}

// Global state for pending auth requests - simplified to just use the sender
lazy_static::lazy_static! {
    static ref PENDING_AUTH: Arc<Mutex<Vec<tokio::sync::oneshot::Sender<String>>>> = 
        Arc::new(Mutex::new(Vec::new()));
}

fn run_oauth_server_blocking() -> Result<(), String> {
    let server = Server::http("localhost:8080")
        .map_err(|e| format!("Failed to start server: {}", e))?;
    
    println!("OAuth server bound to port 8080");
    
    // Mark server as ready
    *SERVER_READY.lock().unwrap() = true;
    
    for request in server.incoming_requests() {
        let url = request.url();
        
        if url.starts_with("/callback") {
            let response = Response::from_string(OAUTH_CALLBACK_HTML)
                .with_header(
                    tiny_http::Header::from_bytes(&b"Content-Type"[..], &b"text/html; charset=utf-8"[..]).unwrap()
                );
            let _ = request.respond(response);
        } else if url.starts_with("/token") {
            // Extract token from query parameter
            if let Some(query) = url.split('?').nth(1) {
                for param in query.split('&') {
                    if let Some((key, value)) = param.split_once('=') {
                        if key == "token" {                            
                            // Send token to waiting auth flow
                            let sender = {
                                let mut pending = PENDING_AUTH.lock().unwrap();
                                pending.pop()
                            };
                            
                            if let Some(tx) = sender {
                                match tx.send(value.to_string()) {
                                    Ok(_) => (),
                                    Err(_) => (),
                                }
                            }
                            
                            let response = Response::from_string("OK")
                                .with_header(
                                    tiny_http::Header::from_bytes(&b"Content-Type"[..], &b"text/plain"[..]).unwrap()
                                );
                            let _ = request.respond(response);
                            break;
                        }
                    }
                }
            }
        } else if url.starts_with("/favicon.ico") {
            let _ = request.respond(Response::from_string("").with_status_code(404));
        } else {
            let _ = request.respond(Response::from_string("Not found").with_status_code(404));
        }
    }

    Ok(())
}