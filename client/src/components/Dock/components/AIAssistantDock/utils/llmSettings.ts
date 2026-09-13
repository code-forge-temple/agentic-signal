/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {ThinkLevel, ThinkOption, isThinkLevel} from "../../../../../types/ollama.types";
import {readJsonRecord} from "./storage";

/**
 * Per-model chat settings for the AI Assistant panel, keyed by model name and stored as one
 * JSON map in the global config store. Scoped to the chat panel on purpose: LlmProcessNode
 * keeps its own per-node settings, which are serialised into the workflow.
 */

export const LLM_SETTINGS_STORAGE_KEY = "aiAssistantLlmSettings";

/**
 * An assumption, not a reading: Ollama never reports the window it actually allocated, and a
 * server with OLLAMA_CONTEXT_LENGTH set will differ from this.
 */
export const DEFAULT_CONTEXT_WINDOW = 4096;

export const CONTEXT_WINDOW_MIN = 512;

export const CONTEXT_WINDOW_STEP = 512;

/** Slider ceiling when ollama.show() couldn't tell us the model's real maximum. */
export const CONTEXT_WINDOW_FALLBACK_MAX = 32768;

export const DEFAULT_TEMPERATURE = 0.8;

export const TEMPERATURE_MIN = 0;

export const TEMPERATURE_MAX = 2;

/**
 * Every field optional, absent meaning "not overridden". There is no separate `enabled` flag
 * that could disagree with its value, and an entry written before a field existed is already
 * correct rather than needing to be merged over defaults.
 */
export type LlmSettings = {
    think?: ThinkOption;
    temperature?: number;
    contextWindow?: number;
};

export type LlmSettingsMap = Record<string, LlmSettings>;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

/**
 * Validates one stored entry field-by-field. Out-of-range numbers are clamped rather than
 * dropped — with no `enabled` flag gating them any more, a hand-edited `temperature: 99`
 * would otherwise flow straight into the request.
 */
const readSettings = (raw: unknown): LlmSettings | null => {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;

    const source = raw as Record<string, unknown>;
    const settings: LlmSettings = {};

    if (typeof source.think === "boolean" || isThinkLevel(source.think)) {
        settings.think = source.think;
    }

    if (typeof source.temperature === "number" && Number.isFinite(source.temperature)) {
        settings.temperature = clamp(source.temperature, TEMPERATURE_MIN, TEMPERATURE_MAX);
    }

    if (typeof source.contextWindow === "number" && Number.isFinite(source.contextWindow)) {
        settings.contextWindow = Math.round(Math.max(source.contextWindow, CONTEXT_WINDOW_MIN));
    }

    return settings;
};

export const readLlmSettingsMap = (raw: string | undefined): LlmSettingsMap => {
    const record = readJsonRecord(raw);

    if (!record) return {};

    const map: LlmSettingsMap = {};

    for (const [model, value] of Object.entries(record)) {
        const settings = readSettings(value);

        if (settings) {
            map[model] = settings;
        }
    }

    return map;
};

const hasAnySetting = (settings: LlmSettings) => Object.values(settings).some(value => value !== undefined);

/**
 * Deliberately does NOT merge numeric defaults: re-adding `temperature: DEFAULT_TEMPERATURE`
 * to a model that never set one would read as "overridden to 0.8" and start sending it on
 * every request. Slider defaults belong to the draft (see `toDraft`), not to stored settings.
 */
export const getModelSettings = (map: LlmSettingsMap, model: string): LlmSettings => map[model] ?? {};

export const withModelSettings = (map: LlmSettingsMap, model: string, settings: LlmSettings): LlmSettingsMap => {
    const next = {...map};

    // Nothing overridden means nothing to store — otherwise turning every toggle back off
    // would leave an empty object behind for every model ever opened.
    if (hasAnySetting(settings)) {
        next[model] = settings;
    } else {
        delete next[model];
    }

    return next;
};

/**
 * What the settings dialog edits. Not the stored shape: a disabled slider still needs a value
 * to sit at, so the draft carries an explicit enabled flag alongside each number, and only
 * `fromDraft` collapses that back to "present or absent".
 */
export type LlmSettingsDraft = {
    think: boolean;
    /** "default" sends a plain `true` — a level tunes how long the reasoning trace runs. */
    thinkLevel: ThinkLevel | "default";
    temperatureEnabled: boolean;
    temperature: number;
    contextWindowEnabled: boolean;
    contextWindow: number;
};

export const toDraft = (settings: LlmSettings): LlmSettingsDraft => ({
    think: settings.think !== undefined && settings.think !== false,
    thinkLevel: isThinkLevel(settings.think) ? settings.think : "default",
    temperatureEnabled: settings.temperature !== undefined,
    temperature: settings.temperature ?? DEFAULT_TEMPERATURE,
    contextWindowEnabled: settings.contextWindow !== undefined,
    contextWindow: settings.contextWindow ?? DEFAULT_CONTEXT_WINDOW,
});

export const fromDraft = (draft: LlmSettingsDraft): LlmSettings => ({
    ...(draft.think ? {think: draft.thinkLevel === "default" ? true : draft.thinkLevel} : {}),
    ...(draft.temperatureEnabled ? {temperature: draft.temperature} : {}),
    ...(draft.contextWindowEnabled ? {contextWindow: draft.contextWindow} : {}),
});
