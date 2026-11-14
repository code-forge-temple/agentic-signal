/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {useCallback} from 'react';
import {refreshOllamaModels, useOllamaModels} from '../stores/ollamaModels';
import {errorMessage} from '@shared/utils';


// An untagged name ("llama3") is listed under Ollama's default tag ("llama3:latest").
const isListed = (model: string, names: string[]) => names.includes(model) || names.includes(`${model}:latest`);

/** Whether a fetch showed that Ollama doesn't have the model; null (Ollama couldn't be asked) shows nothing. */
export const isModelGone = (model: string | undefined, fetchedModels: string[] | null): boolean =>
    Boolean(model && fetchedModels && !isListed(model, fetchedModels));

/**
 * What a model field offers: the fetched list, plus the saved model while the list doesn't show it (Ollama out of
 * reach, or an untagged name), so the field never looks emptied.
 */
export const modelOptions = (model: string | undefined, models: string[]): string[] =>
    model && !models.includes(model) ? [model, ...models] : models;

/**
 * The models installed on the Ollama host: the app's one list (stores/ollamaModels), so a fetch by any user refreshes
 * it for everyone showing it. `fetchModels` resolves with their names, or with null when the host can't be reached,
 * which also empties the list and reports the error to this caller only, through onError; `reachable` tells which
 * happened last. Null means nothing is known about any model, so a caller must not take it as "the model is gone".
 * Only the newest fetch updates the list, so an answer from a host typed earlier can't replace the current one's.
 */
export function useFetchModels (onError?: (error: string) => void) {
    const models = useOllamaModels(state => state.models);
    const reachable = useOllamaModels(state => state.reachable);
    // Loading means nothing to show yet: a known list stays shown, and usable, while anyone's fetch refreshes it.
    const isFetchingModels = useOllamaModels(state => state.isFetching && !state.reachable);

    const fetchModels = useCallback(async (): Promise<string[] | null> => {
        try {
            return await refreshOllamaModels();
        } catch (error) {
            onError?.(`Failed to fetch models: ${errorMessage(error)}`);

            return null;
        }
    }, [onError]);

    return {models, isFetchingModels, reachable, fetchModels};
}
