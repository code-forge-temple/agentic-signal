/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import React, {useState, useCallback, useEffect} from "react";
import {Settings, SettingsContext} from "./SettingsContextBase";
import {readSettings, saveSetting} from "./settingsStorage";
import {detectBrowserPath} from "../services/browserService";

// The desktop app starts the backend along with the window, so the first requests can come too early.
const DETECT_ATTEMPTS = 10;
const DETECT_RETRY_MS = 1500;

export const SettingsProvider = ({children}: { children: React.ReactNode }) => {
    const [settings, setSettings] = useState<Settings>(readSettings);

    const setSetting = useCallback(<K extends keyof Settings>(key: K, value: Settings[K]) => {
        saveSetting(key, value);
        setSettings(prev => ({...prev, [key]: value}));
    }, []);

    // An empty browser path takes Chrome's, found where the backend runs (it's the backend that starts it).
    useEffect(() => {
        if (settings.browserPath) return;

        let cancelled = false;

        void (async () => {
            for (let attempt = 0; attempt < DETECT_ATTEMPTS && !cancelled; attempt++) {
                try {
                    const path = await detectBrowserPath();

                    if (path && !cancelled) {
                        // Unless one was chosen in the meantime.
                        setSettings((prev) => {
                            if (prev.browserPath) return prev;

                            saveSetting("browserPath", path);

                            return {...prev, browserPath: path};
                        });
                    }

                    return;
                } catch {
                    await new Promise(resolve => setTimeout(resolve, DETECT_RETRY_MS));
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [settings.browserPath]);

    return (
        <SettingsContext.Provider value={{settings, setSetting}}>
            {children}
        </SettingsContext.Provider>
    );
};