/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {PathKind} from "./types";


/** The system's own open-file or choose-folder dialog (desktop app only); null when cancelled. */
export async function pickPathNatively ({kind, title, defaultPath}: {kind: PathKind; title: string; defaultPath?: string}): Promise<string | null> {
    // Loaded on first use: the browser build never needs it.
    const {open} = await import("@tauri-apps/plugin-dialog");
    const picked = await open({directory: kind === "folder", multiple: false, title, defaultPath: defaultPath || undefined});

    return typeof picked === "string" ? picked : null;
}
