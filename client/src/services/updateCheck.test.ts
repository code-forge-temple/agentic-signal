/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {afterEach, describe, expect, it, vi} from "vitest";
import {fetchLatestRelease, isNewerVersion, LATEST_RELEASE_API} from "./updateCheck";


describe("isNewerVersion", () => {
    it("compares major, minor and patch as numbers", () => {
        expect(isNewerVersion("3.7.0", "3.6.0")).toBe(true);
        expect(isNewerVersion("3.6.1", "3.6.0")).toBe(true);
        expect(isNewerVersion("4.0.0", "3.12.9")).toBe(true);
        expect(isNewerVersion("3.10.0", "3.9.0")).toBe(true);
        expect(isNewerVersion("3.6.0", "3.6.0")).toBe(false);
        expect(isNewerVersion("3.5.1", "3.6.0")).toBe(false);
    });

    it("reads a tag's leading v", () => {
        expect(isNewerVersion("v3.7.0", "3.6.0")).toBe(true);
    });

    it("never takes a pre-release for newer than its own release", () => {
        expect(isNewerVersion("3.7.0-beta.1", "3.7.0")).toBe(false);
        expect(isNewerVersion("3.7.0", "3.7.0-beta.1")).toBe(true);
        expect(isNewerVersion("3.8.0-beta.1", "3.7.0")).toBe(true);
    });

    it("says no to anything that isn't a version", () => {
        expect(isNewerVersion("latest", "3.6.0")).toBe(false);
        expect(isNewerVersion("3.7", "3.6.0")).toBe(false);
    });
});

describe("fetchLatestRelease", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    const answer = (status: number, body: unknown) => vi.fn().mockResolvedValue(new Response(JSON.stringify(body), {status}));

    it("reads the version and the page of GitHub's latest release", async () => {
        const fetchMock = answer(200, {tag_name: "v3.7.0", html_url: "https://github.com/code-forge-temple/agentic-signal/releases/tag/v3.7.0"});

        vi.stubGlobal("fetch", fetchMock);

        await expect(fetchLatestRelease()).resolves.toEqual({version: "3.7.0", url: "https://github.com/code-forge-temple/agentic-signal/releases/tag/v3.7.0"});
        expect(fetchMock.mock.calls[0][0]).toBe(LATEST_RELEASE_API);
    });

    it("fails on an error status or an answer without a version", async () => {
        vi.stubGlobal("fetch", answer(403, {message: "API rate limit exceeded"}));
        await expect(fetchLatestRelease()).rejects.toThrow("GitHub answered 403");

        vi.stubGlobal("fetch", answer(200, {tag_name: "nightly", html_url: "https://example.com"}));
        await expect(fetchLatestRelease()).rejects.toThrow("no release version");
    });
});
