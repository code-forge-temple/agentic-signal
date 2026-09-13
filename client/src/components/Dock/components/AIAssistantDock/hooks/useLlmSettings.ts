/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {useCallback, useMemo} from 'react';
import {getPersistedValue, useGlobalConfig} from '../../../../../stores/globalConfig';
import {
    LLM_SETTINGS_STORAGE_KEY,
    LlmSettings,
    readLlmSettingsMap,
    withModelSettings
} from '../utils/llmSettings';
import {MODEL_CONTEXT_STORAGE_KEY, readModelContextMap, withModelContext} from '../utils/modelContext';
import {writeJsonRecord} from '../utils/storage';


/**
 * Single owner of the two per-model maps kept in the global config store: the storage keys,
 * the `string | undefined | "" | corrupt` handling, and the writes all live here so the
 * chat panel, header and settings dialog can each just read what they need.
 */
export const useLlmSettings = () => {
    // Selector subscriptions rather than a bare `useGlobalConfig()`: these re-render only when
    // their own key changes, and — because the selected value is a stable string — they keep
    // the memos below honest.
    const rawSettings = useGlobalConfig(state => state.globalData[LLM_SETTINGS_STORAGE_KEY]);
    const rawContext = useGlobalConfig(state => state.globalData[MODEL_CONTEXT_STORAGE_KEY]);
    const setGlobalData = useGlobalConfig(state => state.setGlobalData);

    /*
     * Load-bearing, not an optimisation: the settings dialog seeds its draft from an effect
     * keyed on `settingsMap`. If this re-parsed into a fresh object every render, that effect
     * would reseed continuously and snap the sliders back mid-drag.
     */
    const settingsMap = useMemo(() => readLlmSettingsMap(rawSettings), [rawSettings]);
    const contextMap = useMemo(() => readModelContextMap(rawContext), [rawContext]);

    const saveModelSettings = useCallback((model: string, settings: LlmSettings) => {
        if (!model) return;

        /*
         * Read from storage, not from `settingsMap` and not from the store's mirror. Closing
         * over the rendered map would make this callback unstable; the mirror is a snapshot
         * from page load, so merging into it would drop another tab's writes.
         */
        const current = readLlmSettingsMap(getPersistedValue(LLM_SETTINGS_STORAGE_KEY));

        setGlobalData(LLM_SETTINGS_STORAGE_KEY, writeJsonRecord(withModelSettings(current, model, settings)), true);
    }, [setGlobalData]);

    const rememberModelContextLength = useCallback((model: string, contextLength: number | null) => {
        if (!model) return;

        const current = readModelContextMap(getPersistedValue(MODEL_CONTEXT_STORAGE_KEY));

        // Never overwrite: a cached answer (null included) is what stops the dialog's
        // fetch-on-open effect from re-running forever.
        if (model in current) return;

        setGlobalData(MODEL_CONTEXT_STORAGE_KEY, writeJsonRecord(withModelContext(current, model, contextLength)), true);
    }, [setGlobalData]);

    return {settingsMap, contextMap, saveModelSettings, rememberModelContextLength};
};
