/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {create} from 'zustand';
import {OllamaService} from '../services/ollamaService';
import {savedOllamaHost} from '../context/settingsStorage';

type OllamaModelsState = {
    /** The models Ollama last listed; empty while it can't be reached. */
    models: string[];
    /** Ollama answered the last fetch. */
    reachable: boolean;
    isFetching: boolean;
};

/**
 * The models Ollama has, one list for the whole app: the chat, the LLM and RAG nodes and Settings all show it, so a
 * fetch by any of them (Settings after a model is pulled or deleted, a node opening its settings) updates every one.
 */
export const useOllamaModels = create<OllamaModelsState>(() => ({models: [], reachable: false, isFetching: false}));

let newestRequest = 0;
// The host the list is for; null before the first fetch.
let listedHost: string | null = null;

/**
 * Asks Ollama for its models. The newest request's answer is the one the list keeps. Resolves to the names; rejects
 * with why Ollama couldn't be asked, or resolves to null when a newer request has taken over from a failed one.
 * A host that changed since the last fetch shows nothing until it answers: it may be a wrong one.
 */
export async function refreshOllamaModels (): Promise<string[] | null> {
    const request = ++newestRequest;
    const isNewest = () => request === newestRequest;
    const host = savedOllamaHost();

    if (host !== listedHost) {
        listedHost = host;
        useOllamaModels.setState({models: [], reachable: false});
    }

    useOllamaModels.setState({isFetching: true});

    try {
        const response = await OllamaService.getInstance().fetchModels();

        if (!response.success) throw new Error(response.error);

        const names = response.models.map(model => model.name);

        if (isNewest()) useOllamaModels.setState({models: names, reachable: true});

        return names;
    } catch (error) {
        if (!isNewest()) return null;

        useOllamaModels.setState({models: [], reachable: false});
        throw error;
    } finally {
        if (isNewest()) useOllamaModels.setState({isFetching: false});
    }
}
