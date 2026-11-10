/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {useEffect} from "react";
import {errorMessage} from "@shared/utils";
import {RagNodeData} from "../types/workflow";
import {ragService} from "../services/ragService";
import {ragRequest} from "../utils/ragRequest";
import {savedOllamaHost} from "../../../../context/settingsStorage";
import {EnhancedNodeData} from "../../../../types/workflow";


type RagHandlerOptions = {
    id: string;
    settings: Pick<RagNodeData, "embeddingModel" | "collectionName" | "chunkSize" | "chunkOverlap" | "topK" | "weaviateUrl">;
    weaviateApiKey: string;
    onConfigChange: EnhancedNodeData["onConfigChange"];
    /** Must keep its identity: a new one would give the node a new handler on every render. */
    showError: (message: string) => void;
};

/**
 * Gives the node's data the handler an LLM node calls for context, made afresh whenever a setting changes. A failure
 * shows in the RAG node's logs and fails the call.
 */
export function useRagHandler ({id, settings, weaviateApiKey, onConfigChange, showError}: RagHandlerOptions) {
    const {embeddingModel, collectionName, chunkSize, chunkOverlap, topK, weaviateUrl} = settings;

    useEffect(() => {
        const current = {embeddingModel, collectionName, chunkSize, chunkOverlap, topK, weaviateUrl};

        onConfigChange(id, {
            handler: async (input: string): Promise<string> => {
                try {
                    return await ragService.ingestAndRetrieve(ragRequest({input, settings: current, weaviateApiKey, ollamaHost: savedOllamaHost()}));
                } catch (err) {
                    const message = errorMessage(err);

                    showError(message);

                    throw new Error(message);
                }
            },
        });
    }, [id, embeddingModel, collectionName, chunkSize, chunkOverlap, topK, weaviateUrl, weaviateApiKey, onConfigChange, showError]);
}
