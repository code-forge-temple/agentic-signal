---
title: Slack Bot Setup
---

:::info PRO Feature
This feature is available in the <span className="pro-badge">PRO</span> subscription tier. [Learn more about PRO](https://pricing.agentic-signal.com/)
:::

# Slack Bot Setup

To use the [**Slack Input**](/docs/nodes/input/slack-input) and [**Slack Output**](/docs/nodes/output/slack-output) nodes in `Agentic Signal`, you need to create a Slack app and install it to your Slack workspace.

## Step-by-Step Guide

1. **Go to the Slack API portal**:
   - Navigate to [https://api.slack.com/apps](https://api.slack.com/apps).
   - Sign in with your Slack account.

2. **Create a new app from a manifest**:
   - Click **"Create New App"**.
   - Select **"From a manifest"**.
   - Choose the workspace you want to install the app to, then click **"Next"**.

3. **Paste the manifest**:
   - Switch to the **YAML** tab and replace the content with the following manifest:

   ```yaml
   display_information:
     name: Agentic Signal
     description: Workflow automation triggered by Slack commands
     background_color: "#1a1a2e"
   features:
     app_home:
       home_tab_enabled: false
       messages_tab_enabled: true
       messages_tab_read_only_enabled: false
     bot_user:
       display_name: Agentic Signal
       always_online: true
     slash_commands:
       - command: /agentic-signal
         description: Trigger an Agentic Signal workflow
         usage_hint: "[routing-id] your message or instructions"
         should_escape: false
   oauth_config:
     scopes:
       bot:
         - commands
         - chat:write
         - chat:write.public
         - im:history
         - im:read
         - files:read
     pkce_enabled: false
   settings:
     event_subscriptions:
       bot_events:
         - message.im
     interactivity:
       is_enabled: true
     org_deploy_enabled: false
     socket_mode_enabled: true
     token_rotation_enabled: false
   ```

   - Click **"Next"**, review the summary, then click **"Create"**.

4. **Install the app to your workspace**:
   - In the app settings, go to **"Install App"** from the left sidebar.
   - Click **"Install to Workspace"** and authorize the requested permissions.

5. **Copy your Bot Token**:
   - After installation, go to **"OAuth & Permissions"** in the left sidebar.
   - Copy the **Bot User OAuth Token** (starts with `xoxb-`).
   - Use this token in the **Bot Token** field of the [Slack Input](/docs/nodes/input/slack-input) and [Slack Output](/docs/nodes/output/slack-output) nodes.

6. **Generate an App-Level Token (for Socket Mode)**:
   - Go to **"Basic Information"** in the left sidebar.
   - Scroll down to **"App-Level Tokens"** and click **"Generate Token and Scopes"**.
   - Give it a name (e.g., `agentic-signal-socket`), add the `connections:write` scope, and click **"Generate"**.
   - Copy the generated token (starts with `xapp-`).
   - Use this token in the **App Token (Socket Mode)** field of the [Slack Input node](/docs/nodes/input/slack-input).

---

## Security Best Practices

- **Keep tokens private**: Never share your Bot Token or App Token publicly or commit them to version control.
- **Limit workspace access**: Install the app only to workspaces where it is needed.
- **Use Routing IDs**: Configure a Routing ID in the [Slack Input node](/docs/nodes/input/slack-input) so only intended commands trigger your workflow.

---

## Troubleshooting

- **Bot not responding**: Ensure the app is installed to the workspace and Socket Mode is enabled.
- **Invalid token errors**: Verify you are using the correct `xoxb-` token for the Bot Token and `xapp-` token for the App Token.
- **Command not showing up**: Slack may take a few minutes to register new slash commands after installation.
- **Permission denied**: Re-install the app to the workspace after adding new OAuth scopes.
