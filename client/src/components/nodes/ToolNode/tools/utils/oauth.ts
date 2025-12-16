import {isTauri} from "../../../../../utils";


export const ACCESS_TOKEN_TYPE_OAUTH = "oauth";

export const googleOauthHandler = async ({
    clientId,
    scope,
    onConfigChange,
}: {
    clientId: string;
    scope: string;
    onConfigChange: (key: string, value: string) => void;
}) => {
    if (!clientId) {
        alert("Please provide your Google Client ID first in the configuration above.");

        return;
    }

    if (isTauri()) {
        try {
            const {invoke} = await import("@tauri-apps/api/core");
            const result = await invoke<{ accessToken: string }>("start_google_oauth_flow", {
                clientId,
                scope,
            });

            if (result && result.accessToken) {
                onConfigChange("accessToken", result.accessToken);
            } else {
                alert("OAuth failed: No access token received");
            }
        } catch (error) {
            alert(
                `OAuth failed: ${
                    error instanceof Error ? error.message : "Unknown error"
                }`
            );
        }
    } else {
        if (!window.google) {
            alert("Google Identity Services not loaded. Please refresh the page.");

            return;
        }

        const tokenClient = window.google.accounts.oauth2.initTokenClient({
            client_id: clientId,
            scope,
            callback: (response: { access_token: string; error?: string }) => {
                if (response.access_token) {
                    onConfigChange("accessToken", response.access_token);
                } else {
                    alert(
                        `OAuth authentication failed: ${
                            response.error || "Unknown error"
                        }`
                    );
                }
            },
        });

        tokenClient.requestAccessToken();
    }
};