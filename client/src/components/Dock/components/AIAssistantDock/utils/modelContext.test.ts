/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {describe, expect, it} from 'vitest';
import {contextWindowWarning, minimumContextWindow, resolveContextLimit} from './modelContext';


describe('minimumContextWindow', () => {
    it('fits the instructions at 4 characters a token, plus 8K for the conversation, rounded up to 8K', () => {
        // 79,448 characters ≈ 19.9K tokens + 8K = 28K, so 32K.
        expect(minimumContextWindow('x'.repeat(79448))).toBe(32768);
    });

    it('grows with the instructions', () => {
        expect(minimumContextWindow('x'.repeat(4 * 8192))).toBe(16384);
        expect(minimumContextWindow('x'.repeat(4 * 8192 + 1))).toBe(24576);
    });
});

describe('contextWindowWarning', () => {
    const minimum = 32768;
    const warningFor = (model: string, contextWindow: number | undefined, modelMax?: number | null) =>
        contextWindowWarning(model, resolveContextLimit(model, contextWindow === undefined ? {} : {contextWindow}, modelMax), minimum);

    it("warns about a local model left on Ollama's default, which may be too small, saying how to fix it", () => {
        expect(warningFor('llama3:8b', undefined)).toBe(
            // eslint-disable-next-line max-len
            "Context window may be too small: this model is left on Ollama's default, only 4K tokens unless the Ollama server has 24 GiB of free VRAM or more, but the AI Buddy's instructions and a reply need at least 32K. What doesn't fit is cut from the start of the instructions, without a warning. Set at least 32K with the gear next to the model list."
        );
    });

    it("goes by the window set in the model's settings", () => {
        expect(warningFor('llama3:8b', 16384)).toMatch(/^Context window too small: this model gets 16K tokens, as set in its settings, .* Set at least 32K/);
        expect(warningFor('llama3:8b', 512)).toMatch(/gets 512 tokens,/);
        expect(warningFor('llama3:8b', 1536)).toMatch(/gets 1,536 tokens,/);
        expect(warningFor('llama3:8b', 32768)).toBeNull();
        expect(warningFor('llama3:8b', 65536)).toBeNull();
    });

    it("goes by a cloud model's own maximum, whatever is set (Ollama Cloud ignores it)", () => {
        expect(warningFor('small-cloud', 65536, 8192)).toMatch(/at most 8K tokens.*Longer conversations are refused\. Pick a model with a bigger window\.$/);
        expect(warningFor('gemma4:31b-cloud', 4096, 262144)).toBeNull();
    });

    it('stays quiet when the window is unknown or no model is picked', () => {
        expect(warningFor('gemma4:31b-cloud', undefined, null)).toBeNull();
        expect(warningFor('', undefined)).toBeNull();
    });
});
