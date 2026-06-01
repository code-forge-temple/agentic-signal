/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {OllamaService} from "../../../../../services/ollamaService";
import {FetchAiResponse} from "../../../../../types/ollama.types";
import {RunSingleCallParams} from "./types";

/**
 * Thin pure wrapper around a single OllamaService call.
 * All message construction is the caller's responsibility.
 * This is the reusable primitive for all higher-level orchestration logic.
 */
export async function runSingleCall (params: RunSingleCallParams): Promise<FetchAiResponse> {
    return OllamaService.getInstance().fetchAIResponse({
        messages: params.messages,
        model: params.model,
        ...(params.format ? {format: params.format} : {}),
        tools: params.tools,
        maxToolRetries: params.maxToolRetries,
        think: params.think,
        temperature: params.temperature,
    });
}
