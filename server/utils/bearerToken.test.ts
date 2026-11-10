/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {bearerToken} from "./bearerToken.ts";

// Hand-rolled, like keyedLock.test.ts: the server has no test dependencies.
function assertEquals<T> (actual: T, expected: T): void {
    const a = JSON.stringify(actual);
    const b = JSON.stringify(expected);

    if (a !== b) throw new Error(`Expected ${b}, got ${a}`);
}

const withAuthorization = (value: string) => new Request("http://localhost/graphql", {headers: {Authorization: value}});

Deno.test("gives the token after Bearer", () => {
    assertEquals(bearerToken(withAuthorization("Bearer ya29.token")), "ya29.token");
});

Deno.test("throws without a bearer token: no request, no header, another scheme", () => {
    for (const request of [undefined, new Request("http://localhost/graphql"), withAuthorization("Basic dXNlcjpwYXNz")]) {
        let message = "";

        try {
            bearerToken(request);
        } catch (error) {
            message = (error as Error).message;
        }

        assertEquals(message, "Missing or invalid Authorization header");
    }
});
