/* eslint-disable no-restricted-exports */
declare module "*.svg" {
    import React from "react";

    const content: React.FunctionComponent<React.SVGProps<SVGSVGElement>>;

    export default content;
}

/** The part of Google Identity Services (the accounts.google.com/gsi/client script) that oauth.ts calls. */
type GoogleIdentityServices = {
    accounts: {
        oauth2: {
            initTokenClient: (config: {
                client_id: string;
                scope: string;
                callback: (response: { access_token: string; error?: string }) => void;
            }) => { requestAccessToken: () => void };
        };
    };
};

declare global {
    interface Window {
        google?: GoogleIdentityServices;
        __TAURI_INTERNALS__?: any;
    }
}

export {};