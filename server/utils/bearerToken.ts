/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

const BEARER = "Bearer ";

/**
 * The credential a request carries as `Authorization: Bearer <token>`: how the client hands a tool's access token or
 * API key to its resolver. Throws when the request has none.
 */
export function bearerToken (request: Request | undefined): string {
    const header = request?.headers?.get("authorization");

    if (!header?.startsWith(BEARER)) throw new Error("Missing or invalid Authorization header");

    return header.substring(BEARER.length);
}
