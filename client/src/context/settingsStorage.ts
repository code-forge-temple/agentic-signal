/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import type {Settings} from "./SettingsContextBase";


// Each setting is a localStorage entry of its own, under the setting's name, outside the global store's prefix. Typed
// as a record so a new setting can't be left out of clearSettings.
const SAVED: Record<keyof Settings, true> = {ollamaHost: true, browserPath: true, workflowsFolder: true, checkForUpdates: true};

/** The settings as saved; one never saved has its default (the update check is on). */
export function readSettings (): Settings {
    return {
        ollamaHost: localStorage.getItem("ollamaHost") || "",
        browserPath: localStorage.getItem("browserPath") || "",
        workflowsFolder: localStorage.getItem("workflowsFolder") || "",
        checkForUpdates: localStorage.getItem("checkForUpdates") !== "false",
    };
}

export function saveSetting<K extends keyof Settings> (key: K, value: Settings[K]): void {
    localStorage.setItem(key, String(value));
}

/** Clear App Data: every setting back to its default. */
export function clearSettings (): void {
    for (const key of Object.keys(SAVED)) localStorage.removeItem(key);
}

/** The Ollama host as saved, for code outside React's tree (the Ollama client, a node's handler). */
export const savedOllamaHost = (): string => readSettings().ollamaHost;
