/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {readJsonRecord} from "./storage";
import {DEFAULT_CONTEXT_WINDOW, getModelSettings, LlmSettings, LlmSettingsMap} from "./llmSettings";

/**
 * Kept out of llmSettings.ts deliberately: that holds preferences the user sets, this caches
 * a fact about the model itself — its trained context length, as reported by ollama.show().
 */

export const MODEL_CONTEXT_STORAGE_KEY = "aiAssistantModelContext";

/**
 * null = asked, no answer; missing key = never asked. Collapsing the two would refetch a
 * model with no reported context length forever.
 */
export type ModelContextMap = Record<string, number | null>;

export const readModelContextMap = (raw: string | undefined): ModelContextMap => {
    const record = readJsonRecord(raw);

    if (!record) return {};

    const map: ModelContextMap = {};

    for (const [model, value] of Object.entries(record)) {
        if (value === null) {
            map[model] = null;
        } else if (typeof value === "number" && Number.isFinite(value) && value > 0) {
            map[model] = value;
        }
    }

    return map;
};

export const withModelContext = (map: ModelContextMap, model: string, contextLength: number | null): ModelContextMap => ({
    ...map,
    [model]: contextLength,
});

/**
 * Cloud models are proxied by the local Ollama server out to Ollama's datacenter: the weights
 * and the KV cache live there, nothing is allocated on this machine. Listed through a local
 * server they always carry a `-cloud` tag suffix (e.g. `gpt-oss:120b-cloud`) — the bare name is
 * only used when calling ollama.com's API directly, which this app never does.
 */
export const isCloudModel = (model: string): boolean => model.endsWith("-cloud");

export type ContextLimitSource = "override" | "cloudMax" | "assumedDefault";

export type ResolvedContextLimit = {
    /** null when we genuinely don't know: a cloud model whose maximum show() didn't report. */
    limit: number | null;
    source: ContextLimitSource;
};

/**
 * Works out what the conversation is actually being measured against, which is not always what
 * the user asked for — see the cloud case below.
 */
export const resolveContextLimit = (
    model: string,
    settings: LlmSettings,
    modelMax: number | null | undefined
): ResolvedContextLimit => {
    /*
     * Checked before the override on purpose. Ollama Cloud silently ignores num_ctx (it returns
     * HTTP 200 and serves the model's full window regardless — ollama/ollama#16598), so showing
     * a stale override as the limit would make the gauge read "over" while nothing is wrong.
     */
    if (isCloudModel(model)) {
        return {limit: modelMax ?? null, source: "cloudMax"};
    }

    if (settings.contextWindow !== undefined) {
        return {limit: settings.contextWindow, source: "override"};
    }

    return {limit: DEFAULT_CONTEXT_WINDOW, source: "assumedDefault"};
};

// The AI Buddy's instructions measured 4.5–5.1 characters per token across the models tried (2026-10-31);
// 4 errs on the safe side.
const SYSTEM_PROMPT_CHARS_PER_TOKEN = 4;
// The conversation on top: the newest message (a whole workflow with @current-workflow) and the reply,
// thinking included. Ollama drops the oldest messages first, so older turns needn't fit; but instructions
// that don't fit lose their beginning, silently.
const CONVERSATION_RESERVE_TOKENS = 8192;
const CONTEXT_WINDOW_STEP = 8192;

/** The smallest context window, in 8K steps, that holds the AI Buddy's instructions and a reply's worth of conversation. */
export const minimumContextWindow = (systemPrompt: string): number => {
    const needed = Math.ceil(systemPrompt.length / SYSTEM_PROMPT_CHARS_PER_TOKEN) + CONVERSATION_RESERVE_TOKENS;

    return Math.ceil(needed / CONTEXT_WINDOW_STEP) * CONTEXT_WINDOW_STEP;
};

// "32K" for whole K, the exact count otherwise (the settings slider moves in 512s, down to 512).
const inK = (tokens: number): string => Number.isInteger(tokens / 1024) ? `${tokens / 1024}K` : tokens.toLocaleString("en-US");

/**
 * Why the selected model's context window is too small for the AI Buddy, or null when it's big enough or
 * unknown. Checked against what the conversation really gets (`resolveContextLimit`): the window set in the
 * model's settings, else Ollama's default, and a cloud model's own maximum whatever is set.
 * A local model whose window is too small never sees much of the instructions: Ollama cuts their beginning
 * to make them fit, without saying so. A cloud model refuses with "prompt too long" instead.
 */
export const contextWindowWarning = (model: string, {limit, source}: ResolvedContextLimit, minimum: number): string | null => {
    if (!model || limit === null || limit >= minimum) return null;

    const need = `the AI Buddy's instructions and a reply need at least ${inK(minimum)}`;
    const cut = "What doesn't fit is cut from the start of the instructions, without a warning.";
    const setIt = `Set at least ${inK(minimum)} with the gear next to the model list.`;

    if (source === "cloudMax") {
        return `Context window too small: this model takes at most ${inK(limit)} tokens, but ${need}. Longer conversations are refused. Pick a model with a bigger window.`;
    }

    if (source === "override") {
        return `Context window too small: this model gets ${inK(limit)} tokens, as set in its settings, but ${need}. ${cut} ${setIt}`;
    }

    // Ollama picks its default from the server's free VRAM: 4K below 24 GiB, more above, so it may be enough.
    // eslint-disable-next-line max-len
    return `Context window may be too small: this model is left on Ollama's default, only ${inK(limit)} tokens unless the Ollama server has 24 GiB of free VRAM or more, but ${need}. ${cut} ${setIt}`;
};

/**
 * The model's settings as a reply streams with them. LlmSettings and StreamChatOptions have the same shape (absent
 * means "don't override" on both sides), so they pass straight through, except that a cloud model gets no context
 * window: Ollama Cloud ignores num_ctx anyway (ollama/ollama#16598), and sending it would suggest it had taken effect.
 */
export function streamOptionsFor (settingsMap: LlmSettingsMap, model: string): LlmSettings {
    const settings = getModelSettings(settingsMap, model);

    return isCloudModel(model) ? {...settings, contextWindow: undefined} : settings;
}
