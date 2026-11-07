/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {detectBrowserPath} from "./service.ts";


export const resolver = {
    Query: {
        detectBrowserPath: (): Promise<string | null> => detectBrowserPath(),
    },
};
