/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {describe, expect, it} from "vitest";
import {fillCredentialPlaceholders, SavedCredentials, withCredentials} from "./credentialPlaceholders";


const UNLOCKED: SavedCredentials = {
    keys: ["brave-search.apiKey", "credential.myKey", "credential.secretUrl"],
    values: {"brave-search.apiKey": "BSA-1", "credential.myKey": "abc/123 x", "credential.secretUrl": "https://cal.example.com/private-abc/basic.ics"},
};
const LOCKED: SavedCredentials = {keys: UNLOCKED.keys, values: null};
const NO_VAULT: SavedCredentials = {keys: null, values: null};

describe("fillCredentialPlaceholders", () => {
    it("fills custom and declared credentials, as they are saved", () => {
        const {text} = fillCredentialPlaceholders("https://api.example.com/?k={{myKey}}&b={{ brave-search.apiKey }}&again={{myKey}}", UNLOCKED);

        expect(text).toBe("https://api.example.com/?k=abc/123 x&b=BSA-1&again=abc/123 x");
    });

    it("fills a whole URL kept as a credential", () => {
        expect(fillCredentialPlaceholders("{{secretUrl}}", UNLOCKED).text).toBe("https://cal.example.com/private-abc/basic.ics");
    });

    it("leaves text without placeholders alone, and needs no vault for it", () => {
        expect(fillCredentialPlaceholders("https://example.com/?q={x}", NO_VAULT).text).toBe("https://example.com/?q={x}");
    });

    it("names a credential that isn't saved", () => {
        expect(() => fillCredentialPlaceholders("https://x.com/?k={{other}}", UNLOCKED)).toThrow('No saved credential named "other"');
        expect(() => fillCredentialPlaceholders("https://x.com/?k={{myKey}}", NO_VAULT)).toThrow('No saved credential named "myKey"');
    });

    it("says when the vault is locked", () => {
        expect(() => fillCredentialPlaceholders("https://x.com/?k={{myKey}}", LOCKED)).toThrow("The vault is locked");
    });

    it("never reads app settings: only saved credentials count", () => {
        expect(() => fillCredentialPlaceholders("https://x.com/?m={{selectedModel}}", UNLOCKED)).toThrow('No saved credential named "selectedModel"');
    });

    it("puts the placeholders back in a message, plain or percent-encoded", () => {
        const {hide} = fillCredentialPlaceholders("https://x.com/?k={{myKey}}&b={{brave-search.apiKey}}", UNLOCKED);

        expect(hide("Failed for https://x.com/?k=abc/123 x&b=BSA-1")).toBe("Failed for https://x.com/?k={{myKey}}&b={{brave-search.apiKey}}");
        expect(hide("Failed for https://x.com/?k=abc%2F123%20x")).toBe("Failed for https://x.com/?k={{myKey}}");
    });

    it("puts the placeholders back where a URL parser encoded the value its own way", () => {
        const saved: SavedCredentials = {
            keys: [...UNLOCKED.keys ?? [], "credential.pct", "credential.hash"],
            values: {...UNLOCKED.values, "credential.pct": "a%2Fb c", "credential.hash": "ab#cd"},
        };
        const {text, hide} = fillCredentialPlaceholders("https://x.com/{{myKey}}?k={{pct}}&h={{hash}}", saved);
        // As Chrome would report it: spaces encoded, "/" and an existing "%2F" left as they are.
        const reported = new URL(text).href;

        expect(reported).toBe("https://x.com/abc/123%20x?k=a%2Fb%20c&h=ab#cd");
        expect(hide(`net::ERR_FAILED at ${reported}`)).toBe("net::ERR_FAILED at https://x.com/{{myKey}}?k={{pct}}&h={{hash}}");
        // "ab#cd" cut short at "#" is "ab", which isn't the value: other text stays.
        expect(hide("ab and cd")).toBe("ab and cd");
    });
});

describe("withCredentials", () => {
    it("hands over the filled text", async () => {
        await expect(withCredentials("?k={{myKey}}", async filled => filled, UNLOCKED)).resolves.toBe("?k=abc/123 x");
    });

    it("keeps the values out of an error", async () => {
        const failing = withCredentials("https://x.com/?k={{myKey}}", async filled => {
            throw new Error(`Failed to render HTML for ${filled}`);
        }, UNLOCKED);

        await expect(failing).rejects.toThrow("Failed to render HTML for https://x.com/?k={{myKey}}");
    });
});
