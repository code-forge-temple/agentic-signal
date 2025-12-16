/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

use std::sync::{Arc, Mutex};
use std::sync::atomic::{AtomicBool, Ordering};
use tokio::task::JoinHandle;
use std::collections::HashMap;
use tiny_http::{Response, Server};

// Callback handler type
type CallbackHandler = Box<dyn Fn(&str) -> Response<std::io::Cursor<Vec<u8>>> + Send + Sync>;

// Global server state shared across all OAuth modules
lazy_static::lazy_static! {
    pub static ref GLOBAL_SERVER_HANDLE: Arc<Mutex<Option<JoinHandle<()>>>> = 
        Arc::new(Mutex::new(None));
    pub static ref GLOBAL_SERVER_SHUTDOWN: Arc<AtomicBool> = 
        Arc::new(AtomicBool::new(false));
    pub static ref GLOBAL_SERVER_READY: Arc<Mutex<bool>> = 
        Arc::new(Mutex::new(false));
    // Store registered callback handlers for different OAuth providers
    pub static ref CALLBACK_HANDLERS: Arc<Mutex<HashMap<String, CallbackHandler>>> = 
        Arc::new(Mutex::new(HashMap::new()));
    // Store pending auth channels for different providers
    pub static ref PENDING_AUTH_CHANNELS: Arc<Mutex<HashMap<String, tokio::sync::oneshot::Sender<String>>>> = 
        Arc::new(Mutex::new(HashMap::new()));
}

pub fn start_shared_oauth_server() -> Result<(), String> {
    // Check if server is already running
    {
        let handle = GLOBAL_SERVER_HANDLE.lock().unwrap();
        if handle.is_some() && *GLOBAL_SERVER_READY.lock().unwrap() {
            return Ok(());
        }
    }

    // Start the shared server
    let handle = tokio::task::spawn_blocking(|| {
        let _ = run_shared_oauth_server_blocking(); // Fix: consume the Result
    });

    // Store the handle globally
    {
        let mut server_handle = GLOBAL_SERVER_HANDLE.lock().unwrap();
        *server_handle = Some(handle); // Now the types match: JoinHandle<()>
    }

    Ok(())
}

pub fn register_oauth_provider(
    provider_id: String,
    callback_path: String,
    auth_channel: tokio::sync::oneshot::Sender<String>,
    callback_html: String,
) {    
    // Register the callback handler
    let handler: CallbackHandler = Box::new(move |_url: &str| {
        Response::from_string(callback_html.clone())
            .with_header(
                tiny_http::Header::from_bytes(&b"Content-Type"[..], &b"text/html; charset=utf-8"[..]).unwrap()
            )
    });
    
    {
        let mut handlers = CALLBACK_HANDLERS.lock().unwrap();
        handlers.insert(callback_path.clone(), handler);
    }
    
    // Store the auth channel
    {
        let mut channels = PENDING_AUTH_CHANNELS.lock().unwrap();
        channels.insert(provider_id, auth_channel);
    }
}

pub fn unregister_oauth_provider(provider_id: &str, callback_path: &str) {    
    {
        let mut handlers = CALLBACK_HANDLERS.lock().unwrap();
        handlers.remove(callback_path);
    }
    
    {
        let mut channels = PENDING_AUTH_CHANNELS.lock().unwrap();
        channels.remove(provider_id);
    }
}

pub fn is_shared_server_ready() -> bool {
    *GLOBAL_SERVER_READY.lock().unwrap()
}

fn run_shared_oauth_server_blocking() -> Result<(), String> {
    let server = Server::http("localhost:8080")
        .map_err(|e| format!("Failed to start shared OAuth server: {}", e))?;

    *GLOBAL_SERVER_READY.lock().unwrap() = true;

    loop {
        // Check for shutdown signal
        if GLOBAL_SERVER_SHUTDOWN.load(Ordering::Relaxed) {
            *GLOBAL_SERVER_READY.lock().unwrap() = false;
            break;
        }

        // Use try_recv with timeout to avoid blocking indefinitely
        match server.try_recv() {
            Ok(Some(request)) => {
                let url = request.url().to_string();

                // Check if this matches any registered callback path FIRST
                let callback_response = {
                    let handlers = CALLBACK_HANDLERS.lock().unwrap();
                    handlers.iter().find_map(|(callback_path, handler)| {
                        if url.starts_with(callback_path) {
                            Some(handler(&url))
                        } else {
                            None
                        }
                    })
                };

                if let Some(response) = callback_response {
                    // Handle callback response and consume the request here
                    let _ = request.respond(response);
                } else if url.starts_with("/token") || url.starts_with("/code") {
                    // Handle token/code endpoints
                    let mut token_value: Option<String> = None;
                    
                    if let Some(query) = url.split('?').nth(1) {
                        for param in query.split('&') {
                            if let Some((key, value)) = param.split_once('=') {
                                if key == "token" || key == "code" {
                                    token_value = Some(value.to_string());
                                    break; // Exit the param loop
                                }
                            }
                        }
                    }
                    
                    // Now handle the response outside the loop
                    if let Some(value) = token_value {
                        // Extract sender before responding
                        let sender = {
                            let mut channels = PENDING_AUTH_CHANNELS.lock().unwrap();
                            let first_key = channels.keys().next().cloned();
                            if let Some(key) = first_key {
                                channels.remove(&key)
                            } else {
                                None
                            }
                        };

                        if let Some(tx) = sender {
                            let _ = tx.send(value);
                        }

                        let response = Response::from_string("OK")
                            .with_header(
                                tiny_http::Header::from_bytes(&b"Content-Type"[..], &b"text/plain"[..]).unwrap()
                            );
                        let _ = request.respond(response);
                    } else {
                        // No token/code found in the query parameters
                        let _ = request.respond(Response::from_string("Not found").with_status_code(404));
                    }
                } else if url.starts_with("/favicon.ico") {
                    // Handle favicon requests
                    let _ = request.respond(Response::from_string("").with_status_code(404));
                } else {
                    // Handle unmatched requests
                    let _ = request.respond(Response::from_string("Not found").with_status_code(404));
                }
            }
            Ok(None) => {
                // No request available, sleep briefly to avoid busy waiting
                std::thread::sleep(std::time::Duration::from_millis(100));
            }
            Err(_) => {
                // Error receiving request, break the loop
                break;
            }
        }
    }

    Ok(())
}