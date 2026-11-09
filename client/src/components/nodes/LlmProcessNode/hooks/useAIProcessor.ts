/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {useState, useCallback, useEffect, useRef} from 'react';
import {useFetchModels} from '../../../../hooks/useFetchModels';
import {errorMessage} from '@shared/utils';
import {AIRequest, invalidRequest, RequestFailure, runAIRequest} from '../utils/aiRequest';


export interface UseAIProcessorOptions {
    onSuccess?: (result: unknown) => void;
    onError?: (error: string) => void;
}

export function useAIProcessor (options: UseAIProcessorOptions = {}) {
    const {onSuccess, onError} = options;
    const [error, setError] = useState<string[]>([]);
    const abortControllerRef = useRef<AbortController | null>(null);

    // Unmounting (the node deleted, or its whole layer) cancels the request in flight.
    useEffect(() => () => abortControllerRef.current?.abort(), []);

    const fail = useCallback((message: string): null => {
        setError(prev => [...prev, message]);
        onError?.(message);

        return null;
    }, [onError]);

    const {models, isFetchingModels, fetchModels} = useFetchModels(fail);

    const processAIRequest = useCallback(async (request: AIRequest) => {
        // A newer request supersedes one still in flight, whose reply would be stale. A cancelled
        // request ends quietly: no error, no feedback, no output.
        abortControllerRef.current?.abort();

        const controller = new AbortController();

        abortControllerRef.current = controller;

        const invalid = invalidRequest(request);

        if (invalid) return fail(invalid);

        setError([]);

        try {
            const result = await runAIRequest(request, controller.signal);

            onSuccess?.(result);

            return result;
        } catch (error) {
            if (controller.signal.aborted) return null;

            return fail(error instanceof RequestFailure ? error.message : `Unexpected error: ${errorMessage(error)}`);
        }
    }, [onSuccess, fail]);

    return {
        processAIRequest,
        fetchModels,
        models,
        isFetchingModels,
        error,
        clearError: () => setError([]),
    };
}
