/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {createContext} from "react";

export type Settings = {
    ollamaHost: string;
};

export type SettingsContextType = {
    settings: Settings;
    setSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
};

export const SettingsContext = createContext<SettingsContextType | undefined>(undefined);