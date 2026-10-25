/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {graphqlBaseUrl} from "./utils";


type GraphQLResponse<T> = {
    data?: T | null;
    errors?: { message: string }[];
};

/**
 * POSTs a query or mutation to the backend and returns its `data`.
 * `T` is the shape the operation's selection set asks for: it is stated, not checked at runtime.
 * Throws the GraphQL error messages (one per line) when there are any, otherwise the HTTP
 * status when the response isn't a usable GraphQL result.
 */
export async function graphqlRequest<T = unknown> (
    query: string,
    variables: object,
    headers?: Record<string, string>
): Promise<T> {
    const response = await fetch(graphqlBaseUrl, {
        method: "POST",
        headers: {"Content-Type": "application/json", ...headers},
        body: JSON.stringify({query, variables}),
    });
    // Parsed before the status check: an error status can still carry GraphQL errors worth
    // showing, while a body that isn't JSON (a proxy's error page) falls through to the status.
    const body = await response.json().catch(() => null) as GraphQLResponse<T> | null;

    if (body?.errors?.length) {
        throw new Error(body.errors.map(e => e.message).join("\n"));
    }

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    if (!body?.data) {
        throw new Error("Malformed GraphQL response: no data");
    }

    return body.data;
}
