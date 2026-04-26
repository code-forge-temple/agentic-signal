/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {useState, useCallback} from 'react';
import {OllamaService} from '../services/ollamaService';


export function useFetchModels (onError?: (error: string) => void) {
    const [models, setModels] = useState<string[]>([]);
    const [isFetchingModels, setIsFetchingModels] = useState(false);

    const fetchModels = useCallback(async () => {
        setIsFetchingModels(true);

        try {
            const fetchResponse = await OllamaService.getInstance().fetchModels();

            if (fetchResponse.success) {
                const modelNames = fetchResponse.models.map(model => model.name);

                setModels(modelNames);

                return modelNames;
            } else {
                const errorMsg = `Failed to fetch models: ${fetchResponse.error}`;

                onError?.(errorMsg);

                return [];
            }
        } catch (error) {
            const errorMsg = `Failed to fetch models: ${error instanceof Error ? error.message : String(error)}`;

            onError?.(errorMsg);

            return [];
        } finally {
            setIsFetchingModels(false);
        }
    }, [onError]);

    return {models, isFetchingModels, fetchModels};
}
