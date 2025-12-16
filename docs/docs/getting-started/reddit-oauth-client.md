---
title: Reddit OAuth2 Client Setup
---

:::info PRO Feature
This feature is available in the <span className="pro-badge">PRO</span> subscription tier. [Learn more about PRO](https://pricing.agentic-signal.com/)
:::

# Reddit OAuth2 Client Setup

To use Reddit services (posting, reading) in `Agentic Signal`, you need to create an OAuth2 application in Reddit's developer portal.

## Step-by-Step Guide

1. **Read the API terms and sign up for usage**:
   - Go to [Reddit API Documentation](https://www.reddit.com/r/reddit.com/wiki/api/).
   - There, register in order to use the Reddit API.

2. **Go to** [Reddit Apps Management](https://www.reddit.com/prefs/apps).

3. **Create a new application**:
   - Click **"Create App"** or **"Create Another App"** button.
   - Choose **"script"** as the application type.

4. **Configure your application**:
   - **Name**: `agentic-signal`
   - **Description**: Enter a brief description (e.g., "Agentic Signal workflow automation")
   - **Redirect URI**: `http://localhost:8080/reddit-callback.html`
   - Click **"Create app"** to save.

5. **Copy your credentials**:
   - **Client ID**: The string under your app name (e.g., `abc123def456`)
   - **Client Secret**: Click "edit" to reveal the secret  
   > Use these in `Agentic Signal`'s Reddit Oauth configuration for nodes / tools.

## Security Best Practices

- **Keep your Client Secret private**: Never share it publicly or commit it to version control.
- **Use script type for personal use**: This is the recommended type for personal automation tools.
- **Test in safe subreddits**: Use r/test or similar subreddits for testing your posts.

---

## Troubleshooting

- **OAuth fails**: Verify your Client ID and Client Secret are correct.
- **Redirect URI mismatch**: Ensure the redirect URI matches exactly: `http://localhost:8080/reddit-callback.html`
- **Rate limiting**: Reddit has rate limits - avoid excessive API calls.
- **Insufficient permissions**: Make sure you have allowed the appropriate permissions for posting upon connecting.