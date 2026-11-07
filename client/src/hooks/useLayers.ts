/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {useContext} from "react";
import {LayersContext} from "../context/LayersContextBase";


export function useLayers () {
    const ctx = useContext(LayersContext);

    if (!ctx) throw new Error("useLayers must be used within LayersProvider");

    return ctx;
}
