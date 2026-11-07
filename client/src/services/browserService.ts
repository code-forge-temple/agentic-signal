/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {graphqlRequest} from "../utils";


/** Chrome's path where the backend runs, if it's installed in its usual place. */
export async function detectBrowserPath (): Promise<string | null> {
    const data = await graphqlRequest<{detectBrowserPath: string | null}>(/* GraphQL */ `query { detectBrowserPath }`, {});

    return data.detectBrowserPath;
}
