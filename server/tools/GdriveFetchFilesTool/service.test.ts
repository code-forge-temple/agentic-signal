/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {fetchGdriveFiles} from "./service.ts";

// Hand-rolled, like keyedLock.test.ts: the server has no test dependencies.
function assertEquals<T> (actual: T, expected: T): void {
    const a = JSON.stringify(actual);
    const b = JSON.stringify(expected);

    if (a !== b) throw new Error(`Expected ${b}, got ${a}`);
}

type FakeResponse = {status?: number; statusText?: string; body: string};

/** Answers each URL with its response (a throw for an Error), and keeps the URLs asked, in order. */
async function withDrive (responses: Record<string, FakeResponse | Error>, run: () => Promise<void>): Promise<string[]> {
    const asked: string[] = [];
    const realFetch = globalThis.fetch;

    globalThis.fetch = ((input: string | URL | Request) => {
        const url = String(input);
        const response = responses[url];

        asked.push(url);

        if (response instanceof Error) return Promise.reject(response);

        if (!response) return Promise.reject(new Error(`unexpected ${url}`));

        return Promise.resolve(new Response(response.body, {status: response.status ?? 200, statusText: response.statusText ?? "OK"}));
    }) as typeof fetch;

    try {
        await run();
    } finally {
        globalThis.fetch = realFetch;
    }

    return asked;
}

const FILES = "https://www.googleapis.com/drive/v3/files";
const LIST_URL = `${FILES}?q=${encodeURIComponent("name contains 'x'")}&pageSize=10&fields=files(id,name,mimeType,webViewLink,modifiedTime,size,owners)`;
const ARGS = {query: "name contains 'x'", maxResults: 10, accessToken: "token"};

const listing = (files: {id: string; mimeType: string}[]): FakeResponse => ({body: JSON.stringify({files})});
const exportUrl = (id: string, mimeType: string) => `${FILES}/${id}/export?mimeType=${encodeURIComponent(mimeType)}`;
const downloadUrl = (id: string) => `${FILES}/${id}?alt=media`;

Deno.test("reads each file found: a Google file exported (a sheet as CSV), a text file downloaded, a binary one only named", async () => {
    let contents: (string | undefined)[] = [];

    const asked = await withDrive({
        [LIST_URL]: listing([
            {id: "doc", mimeType: "application/vnd.google-apps.document"},
            {id: "sheet", mimeType: "application/vnd.google-apps.spreadsheet"},
            {id: "slides", mimeType: "application/vnd.google-apps.presentation"},
            {id: "notes", mimeType: "text/plain"},
            {id: "data", mimeType: "application/json"},
            {id: "scan", mimeType: "application/pdf"},
        ]),
        [exportUrl("doc", "text/plain")]: {body: "doc text"},
        [exportUrl("sheet", "text/csv")]: {body: "a,b"},
        [exportUrl("slides", "text/plain")]: {body: "slide text"},
        [downloadUrl("notes")]: {body: "notes text"},
        [downloadUrl("data")]: {body: "{\"a\":1}"},
        [downloadUrl("scan")]: {body: "%PDF"},
    }, async () => {
        contents = (await fetchGdriveFiles(ARGS)).map(file => file.content);
    });

    assertEquals(contents, ["doc text", "a,b", "slide text", "notes text", "{\"a\":1}", "[Binary file content - application/pdf]"]);
    assertEquals(asked.length, 7);
});

Deno.test("says why a file couldn't be read, and goes on with the others", async () => {
    let contents: (string | undefined)[] = [];

    await withDrive({
        [LIST_URL]: listing([
            {id: "locked", mimeType: "application/vnd.google-apps.document"},
            {id: "gone", mimeType: "text/plain"},
            {id: "offline", mimeType: "text/plain"},
        ]),
        [exportUrl("locked", "text/plain")]: {status: 403, statusText: "Forbidden", body: ""},
        [downloadUrl("gone")]: {status: 404, statusText: "Not Found", body: ""},
        [downloadUrl("offline")]: new Error("network down"),
    }, async () => {
        contents = (await fetchGdriveFiles(ARGS)).map(file => file.content);
    });

    assertEquals(contents, ["[Could not read content: Forbidden]", "[Could not read content: Not Found]", "[Error reading content: network down]"]);
});

Deno.test("finds nothing without failing, and reports a failed search with Google's answer", async () => {
    let found: unknown = null;

    await withDrive({[LIST_URL]: {body: "{}"}}, async () => {
        found = await fetchGdriveFiles(ARGS);
    });
    assertEquals(found, []);

    let message = "";
    const realError = console.error;

    console.error = () => {};

    try {
        await withDrive({[LIST_URL]: {status: 401, statusText: "Unauthorized", body: "bad token"}}, async () => {
            await fetchGdriveFiles(ARGS).catch((error: Error) => { message = error.message; });
        });
    } finally {
        console.error = realError;
    }

    assertEquals(message, "Failed to fetch Google Drive files: Google Drive API search failed: 401 Unauthorized - Response: bad token");
});
