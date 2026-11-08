/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {useState, useCallback, useRef} from 'react';
import {OllamaService} from '../services/ollamaService';
import {errorMessage} from '@shared/utils';


/**
 * The models installed on the Ollama host. `fetchModels` resolves with their names, or with none when the host can't be
 * reached, which also empties the list and reports the error; `reachable` tells which happened last. Only the newest
 * fetch updates the list, so an answer from a host typed earlier can't replace the current one's.
 */
export function useFetchModels (onError?: (error: string) => void) {
    const [models, setModels] = useState<string[]>([]);
    const [isFetchingModels, setIsFetchingModels] = useState(false);
    const [reachable, setReachable] = useState(false);
    const newestRef = useRef(0);

    const fetchModels = useCallback(async (): Promise<string[]> => {
        const request = ++newestRef.current;
        const isNewest = () => request === newestRef.current;

        setIsFetchingModels(true);

        try {
            const response = await OllamaService.getInstance().fetchModels();

            if (!response.success) throw new Error(response.error);

            const names = response.models.map(model => model.name);

            if (isNewest()) {
                setModels(names);
                setReachable(true);
            }

            return names;
        } catch (error) {
            if (isNewest()) {
                setModels([]);
                setReachable(false);
                onError?.(`Failed to fetch models: ${errorMessage(error)}`);
            }

            return [];
        } finally {
            if (isNewest()) setIsFetchingModels(false);
        }
    }, [onError]);

    /** Forgets the list until the next fetch answers: for a host that just changed, which may be a wrong one. */
    const resetModels = useCallback(() => {
        newestRef.current++;
        setModels([]);
        setReachable(false);
    }, []);

    return {models, isFetchingModels, reachable, fetchModels, resetModels};
}
