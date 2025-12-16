/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};
use crate::utils::shared_oauth_server::{
    start_shared_oauth_server, 
    register_oauth_provider, 
    unregister_oauth_provider, 
    is_shared_server_ready
};
use urlencoding;

const OAUTH_CALLBACK_HTML: &str = include_str!("../oauth-callback.html");
const AUTHENTICATION_CANCELLED: &str = "Authentication cancelled";

#[derive(Debug, Serialize, Deserialize)]
pub struct GoogleOAuthResult {
    #[serde(rename = "accessToken")]
    pub access_token: String,
}

#[derive(Debug, Clone)]
pub struct GoogleOAuthConfig {
    pub client_id: String,
    pub scope: String,
    pub auth_url: String,
}

#[tauri::command]
pub async fn start_google_oauth_flow(
    app: tauri::AppHandle,
    client_id: String,
    scope: String,
) -> Result<GoogleOAuthResult, String> {
    let config = GoogleOAuthConfig {
        client_id,
        scope,
        auth_url: "https://accounts.google.com/o/oauth2/v2/auth".to_string(),
    };

    start_oauth_flow_generic(app, config, "callback").await
}

async fn start_oauth_flow_generic(
    app: tauri::AppHandle,
    config: GoogleOAuthConfig,
    callback_path: &str,
) -> Result<GoogleOAuthResult, String> {
    let redirect_uri = format!("http://localhost:8080/{}", callback_path);

    let auth_url = format!(
        "{}?client_id={}&redirect_uri={}&response_type=token&scope={}",
        config.auth_url,
        urlencoding::encode(&config.client_id),
        urlencoding::encode(&redirect_uri),
        urlencoding::encode(&config.scope)
    );

    // Start shared OAuth server if not already running
    start_shared_oauth_server()?;

    // Wait for shared server to be ready
    let mut ready = false;
    for _ in 0..50 {
        tokio::time::sleep(Duration::from_millis(100)).await;
        if is_shared_server_ready() {
            ready = true;
            break;
        }
    }

    if !ready {
        return Err("Shared OAuth server failed to start. Please try again.".to_string());
    }

    tokio::time::sleep(Duration::from_millis(200)).await;

    // Create oneshot channel for token communication
    let (tx, rx) = tokio::sync::oneshot::channel();

    // Register this Google OAuth provider with the shared server
    let provider_id = "google".to_string();
    let callback_path_str = format!("/{}", callback_path);
    
    register_oauth_provider(
        provider_id.clone(),
        callback_path_str.clone(),
        tx,
        OAUTH_CALLBACK_HTML.to_string(),
    );

    // Close existing OAuth window if it exists
    if let Some(existing_window) = app.get_webview_window("oauth") {
        let _ = existing_window.close();
        tokio::time::sleep(Duration::from_millis(150)).await;
    }

    // Create OAuth window
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

    let window_closed = Arc::new(Mutex::new(false));
    let window_closed_clone = window_closed.clone();

    let window_for_listener = oauth_window.clone();
    window_for_listener.on_window_event(move |event| {
        if let tauri::WindowEvent::Destroyed = event {
            *window_closed_clone.lock().unwrap() = true;
        }
    });

    // Wait for token with timeout
    let result = match tokio::time::timeout(Duration::from_secs(120), rx).await {
        Ok(Ok(value)) => {
            // Unregister when done
            unregister_oauth_provider(&provider_id, &callback_path_str);
            value
        },
        Ok(Err(_)) => {
            let _ = oauth_window.close();
            unregister_oauth_provider(&provider_id, &callback_path_str);
            return Err(AUTHENTICATION_CANCELLED.to_string());
        }
        Err(_) => {
            let was_closed = *window_closed.lock().unwrap();
            if !was_closed {
                let _ = oauth_window.close();
            }
            unregister_oauth_provider(&provider_id, &callback_path_str);
            return Err(AUTHENTICATION_CANCELLED.to_string());
        }
    };

    // Close window after success
    let _ = oauth_window.close();

    Ok(GoogleOAuthResult {
        access_token: result,
    })
}