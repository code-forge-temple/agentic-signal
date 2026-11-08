/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {globalToolProp} from "../utils/utils";


export const TOOL_SUBTYPE = "brave-search";

/** The userConfig fields that hold the tool's secrets. */
export const LOCAL_SECRETS = {
    API_KEY: "apiKey",
} as const;

/** The global store keys for the same secrets, shared by every Brave Search tool; Settings → Credentials can save them. */
export const GLOBAL_SECRETS = {
    API_KEY: globalToolProp(TOOL_SUBTYPE, LOCAL_SECRETS.API_KEY),
} as const satisfies Record<keyof typeof LOCAL_SECRETS, string>;
