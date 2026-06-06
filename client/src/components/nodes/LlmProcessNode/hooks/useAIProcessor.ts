/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {useState, useCallback} from 'react';
import {GenericNodeData} from '../../../../types/workflow';
import {Message, MessageRole, SystemUserConfigValues, ToolSchema} from '../../../../types/ollama.types';
import {LlmProcessNodeData} from '../types/workflow';
import {useFetchModels} from '../../../../hooks/useFetchModels';
import Ajv from 'ajv';
import {runOrchestration, runSingleCall, JSON_SCHEMA_PROMPT_PREFIX} from '../utils/aiOrchestration';
import {assertIsSerializedInput, getExpectedOutputType, llmResponseJsonParse, parseFormat, serializeInput} from '../utils/formatUtils';


export interface UseAIProcessorOptions {
    onSuccess?: (result: any) => void;
    onError?: (error: string) => void;
}

export function useAIProcessor (options: UseAIProcessorOptions = {}) {
    const {onSuccess, onError} = options;
    const [error, setError] = useState<string[]>([]);

    const handleFetchModelsError = useCallback((msg: string) => {
        setError(prev => [...prev, msg]);
        onError?.(msg);
    }, [onError]);

    const {models, isFetchingModels, fetchModels} = useFetchModels(handleFetchModelsError);

    const processAIRequest = useCallback(async ({
        input,
        prompt,
        message,
        model,
        format,
        tools,
        feedback,
        maxToolRetries,
        ragHandler,
        conversationHistory,
        think,
        temperature,
        orchestrationMode
    }: Pick<GenericNodeData & LlmProcessNodeData, 'input' | 'prompt' | 'message' | 'model' | 'format'> & {
    tools?: {
        schema: ToolSchema,
        systemUserConfigValues: SystemUserConfigValues,
        handler: (params: any) => Promise<any>
    }[];
    feedback?: string;
    maxToolRetries: number;
    ragHandler?: (input: string) => Promise<string>;
    conversationHistory: {
        value: Message[];
        onChange: (history: Message[]) => void;
    };
    think?: boolean;
    temperature?: number;
    orchestrationMode?: boolean;
}) => {
        if (!model) {
            const errorMsg = "Please select a model first.";

            setError(prev => [...prev, errorMsg]);
            onError?.(errorMsg);

            return null;
        }

        if (orchestrationMode && (Array.isArray(input) || typeof input === "string")) {
            setError([]);

            const orchestrationResult = await runOrchestration({
                input,
                prompt,
                model,
                format,
                tools,
                maxToolRetries,
                think,
                temperature,
            });

            if (!orchestrationResult.success) {
                setError(prev => [...prev, orchestrationResult.error]);
                onError?.(orchestrationResult.error);

                return null;
            }

            onSuccess?.(orchestrationResult.result);

            return orchestrationResult.result;
        }

        if (!prompt && !message && !input) {
            const errorMsg = "Please provide a prompt, message, or input data.";

            setError(prev => [...prev, errorMsg]);
            onError?.(errorMsg);

            return null;
        }

        setError([]);

        try {
            let messages: Message[] = [];
            let parsedFormat: object | undefined;
            let onErrorValidator: ((data: any) => boolean) | undefined;

            try {
                ({parsedFormat, onErrorValidator} = parseFormat(format));
            } catch (parseError) {
                const errorMsg = `Invalid format JSON: ${parseError instanceof Error ? parseError.message : String(parseError)}`;

                setError(prev => [...prev, errorMsg]);
                onError?.(errorMsg);

                return null;
            }

            const enhancedSystemPrompt = parsedFormat
                ? `${prompt ? `${prompt}\n\n` : ""}${JSON_SCHEMA_PROMPT_PREFIX}\n${JSON.stringify(parsedFormat, null, 4)}`
                : prompt;

            // Two-phase mode: when tools AND structured output are both present some LLMs
            // fail to call tools if a structured output format is also requested.
            // Phase 1 runs the tool-calling pass with only the plain prompt;
            // Phase 2 reformats the raw reply into the required JSON schema without tools.
            const needsTwoPhase = !!(parsedFormat && tools?.length);
            const phase1SystemPrompt = needsTwoPhase ? prompt : enhancedSystemPrompt;

            if (conversationHistory.value.length === 0) {
                // First run - initialize conversation
                if (phase1SystemPrompt) {
                    messages.push({
                        role: MessageRole.SYSTEM,
                        content: phase1SystemPrompt
                    });
                }

                // Always add user message if we have input or message config
                if (input !== undefined || message) {
                    const serializedInput = input ? serializeInput(input) : "";

                    assertIsSerializedInput(serializedInput);

                    const baseUserContent = message
                        ? `${message.prefix || ''}${serializedInput}${message.suffix || ''}`
                        : serializedInput;

                    let userContent = baseUserContent;

                    if (ragHandler) {
                        try {
                            const ragContext = await ragHandler(baseUserContent);

                            if (ragContext) {
                                userContent = `## CONTEXT\n${ragContext}\n\n${baseUserContent}`;
                            }
                        } catch (ragError) {
                            const errorMsg = `RAG retrieval failed: ${ragError instanceof Error ? ragError.message : String(ragError)}`;

                            setError(prev => [...prev, errorMsg]);
                            onError?.(errorMsg);

                            return null;
                        }
                    }

                    messages.push({
                        role: MessageRole.USER,
                        content: userContent
                    });
                }
            } else {
                // Continue conversation
                messages = [...conversationHistory.value];

                if (feedback) {
                    // Add feedback as user message
                    messages.push({
                        role: MessageRole.USER,
                        // eslint-disable-next-line max-len
                        content: `The previous response caused an error in downstream processing. Here's the feedback: ${feedback}\n\nPlease provide a corrected response that addresses this issue.`
                    });
                } else {
                    // New input - reset conversation but keep system message
                    const systemMsg = messages.find(m => m.role === MessageRole.SYSTEM);

                    messages = systemMsg ? [systemMsg] : [];

                    // Add new user message
                    if (input !== undefined || message) {
                        const serializedInput = input ? serializeInput(input) : "";

                        assertIsSerializedInput(serializedInput);

                        const userContent = message
                            ? `${message.prefix || ''}${serializedInput}${message.suffix || ''}`
                            : serializedInput;

                        messages.push({
                            role: MessageRole.USER,
                            content: userContent
                        });
                    }
                }
            }

            let result: any;

            if (needsTwoPhase) {
                // Phase 1: tool-calling pass — no structured output format so tools fire correctly
                const phase1Response = await runSingleCall({
                    messages,
                    model,
                    tools,
                    maxToolRetries,
                    think,
                    temperature
                });

                if (!phase1Response.success) {
                    const errorMsg = `Failed to fetch AI response (phase 1): ${phase1Response.error}`;

                    setError(prev => [...prev, errorMsg]);
                    onError?.(errorMsg);

                    return null;
                }

                const phase1Reply = phase1Response.reply;

                // Short-circuit: if Phase 1 already produced valid structured output, skip Phase 2
                let phase2Reply: string | undefined;

                try {
                    const ajv = new Ajv();
                    const validate = ajv.compile(parsedFormat!);
                    const phase1Parsed = llmResponseJsonParse(phase1Reply);

                    if (validate(phase1Parsed)) {
                        phase2Reply = phase1Reply;
                    }
                } catch {
                    // Not valid JSON or schema mismatch — proceed to Phase 2
                }

                if (phase2Reply === undefined) {
                    // Phase 2: reformat pass — structured output, no tools
                    const phase2Messages: Message[] = [
                        {
                            role: MessageRole.SYSTEM,
                            content: enhancedSystemPrompt ?? `${JSON_SCHEMA_PROMPT_PREFIX}\n${JSON.stringify(parsedFormat, null, 4)}`
                        },
                        {
                            role: MessageRole.USER,
                            content: `Here is the response to reformat:\n\n${phase1Reply}\n\nPlease reformat it to strictly match the required JSON schema.`
                        }
                    ];

                    const phase2Response = await runSingleCall({
                        messages: phase2Messages,
                        model,
                        format: parsedFormat,
                        maxToolRetries,
                        think,
                        temperature
                    });

                    if (!phase2Response.success) {
                        const errorMsg = `Failed to fetch AI response (phase 2): ${phase2Response.error}`;

                        setError(prev => [...prev, errorMsg]);
                        onError?.(errorMsg);

                        return null;
                    }

                    phase2Reply = phase2Response.reply;
                }

                result = phase2Reply;

                // Store Phase 1 messages + final structured reply in history
                conversationHistory.onChange([...messages, {
                    role: MessageRole.ASSISTANT,
                    content: result
                }]);
            } else {
                // Single-call path: no tools, or no structured output — no conflict
                const response = await runSingleCall({
                    messages,
                    model,
                    ...(parsedFormat ? {format: parsedFormat} : {}),
                    tools,
                    maxToolRetries,
                    think,
                    temperature
                });

                if (!response.success) {
                    const errorMsg = `Failed to fetch AI response: ${response.error}`;

                    setError(prev => [...prev, errorMsg]);
                    onError?.(errorMsg);

                    return null;
                }

                result = response.reply;

                conversationHistory.onChange([...messages, {
                    role: MessageRole.ASSISTANT,
                    content: result
                }]);
            }

            try {
                const expectedOutputType = getExpectedOutputType(parsedFormat);

                if (expectedOutputType === "object" || expectedOutputType === "array") {
                    result = llmResponseJsonParse(result);

                    if (expectedOutputType === "object" && onErrorValidator && onErrorValidator(result)) {
                        const errorMsg = `LLM returned an error response matching onError schema:\n${JSON.stringify(result, null, 4)}`;

                        setError(prev => [...prev, errorMsg]);
                        onError?.(errorMsg);

                        return null;
                    }
                }
            } catch (parseError) {
                const errorMsg = `Failed to parse AI response: ${parseError instanceof Error ? parseError.message : String(parseError)}`;

                setError(prev => [...prev, errorMsg]);
                onError?.(errorMsg);

                return null;
            }

            onSuccess?.(result);

            return result;
        } catch (error) {
            const errorMsg = `Unexpected error: ${error instanceof Error ? error.message : String(error)}`;

            setError(prev => [...prev, errorMsg]);
            onError?.(errorMsg);

            return null;
        }
    }, [onSuccess, onError]);

    return {
        processAIRequest,
        fetchModels,
        models,
        isFetchingModels,
        error,
        clearError: () => setError([]),
    };
}