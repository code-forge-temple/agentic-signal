/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {readJsonRecord} from "./storage";
import {DEFAULT_CONTEXT_WINDOW, LlmSettings} from "./llmSettings";

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
