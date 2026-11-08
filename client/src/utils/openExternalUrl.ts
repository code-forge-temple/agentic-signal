/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {isTauri} from "./utils";


/** Opens `url` in the user's browser: through the system from the desktop app, in a new tab otherwise. */
export async function openExternalUrl (url: string): Promise<void> {
    if (isTauri()) {
        try {
            const shell = await import("@tauri-apps/plugin-shell");

            await shell.open(url);
        } catch (error) {
            console.error("Failed to open URL with Tauri:", error);
        }
    } else {
        window.open(url, "_blank", "noopener,noreferrer");
    }
}
