/* eslint-disable no-restricted-exports */
declare module "*.svg" {
    import React from "react";
    const content: React.FunctionComponent<React.SVGProps<SVGSVGElement>>;
    export default content;
}

declare global {
    interface Window {
        google?: any;
        __TAURI_INTERNALS__?: any;
    }
}

export {};