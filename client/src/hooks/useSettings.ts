/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {useContext} from "react";
import {SettingsContext} from "../context/SettingsContextBase";


export function useSettings () {
    const ctx = useContext(SettingsContext);

    if (!ctx) throw new Error("useSettings must be used within SettingsProvider");

    return ctx;
}