# Google OAuth2 Client Setup

To use Google services (Gmail, Drive, Calendar) in `Agentic Signal`, you need to create an OAuth2 client in Google Cloud Console.

## Step-by-Step Guide

1. **Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials).**
2. **Create a new project** (or select an existing one).
3. **Enable APIs** for your project:
   - Gmail API
   - Google Drive API
   - Google Calendar API
4. **Configure the OAuth consent screen**:
   - Go to [OAuth consent screen setup](https://console.cloud.google.com/auth/overview/create).
   - Fill in required fields (app name, support email, etc.).
   - Add scopes for the APIs you want to use.
5. **Create OAuth2 Client ID**:
   - Go to [OAuth2 Client ID creation](https://console.cloud.google.com/auth/clients/create).
   - Choose **Web application** as the application type.
   - **Authorized JavaScript origins:**  
     - `http://localhost:3000`  
     - `http://localhost:8080`
   - **Authorized redirect URIs:**  
     - `http://localhost:3000`  
     - `http://localhost:8080`  
     - `http://localhost:8080/callback`
   - Click **Save** to create the client.
6. **Copy your Client ID** and use it in `Agentic Signal`’s configuration (`Google OAuth2 Client ID (from Google Cloud Console)` field).


> For more details, see [Google's official documentation](https://developers.google.com/identity/protocols/oauth2).

---

## Troubleshooting

- Make sure the APIs are enabled for your project.
- The OAuth consent screen must be published (for external users).
- Redirect URIs must match exactly.