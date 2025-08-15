/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import React, {useState, useCallback} from "react";
import {Settings, SettingsContext} from "./SettingsContextBase";

const defaultSettings: Settings = {
    ollamaHost: localStorage.getItem("ollamaHost") || "",
};

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({children}) => {
    const [settings, setSettings] = useState<Settings>(defaultSettings);

    const setSetting = useCallback(<K extends keyof Settings>(key: K, value: Settings[K]) => {
        setSettings(prev => {
            const updated = {...prev, [key]: value};

            if (key === "ollamaHost") localStorage.setItem("ollamaHost", value as string);

            return updated;
        });
    }, []);

    return (
        <SettingsContext.Provider value={{settings, setSetting}}>
            {children}
        </SettingsContext.Provider>
    );
};