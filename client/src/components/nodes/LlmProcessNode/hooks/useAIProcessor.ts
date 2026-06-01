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
import {runOrchestration, runSingleCall} from '../utils/aiOrchestration';
import {assertIsSerializedInput, getExpectedOutputType, parseFormat, serializeInput} from '../utils/formatUtils';


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

            if (conversationHistory.value.length === 0) {
                // First run - initialize conversation
                if (prompt) {
                    messages.push({
                        role: MessageRole.SYSTEM,
                        content: prompt
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

            let result = response.reply;
            const updatedHistory = [...messages, {
                role: MessageRole.ASSISTANT,
                content: result
            }];

            conversationHistory.onChange(updatedHistory);

            try {
                const expectedOutputType = getExpectedOutputType(parsedFormat);

                if (expectedOutputType === "object" || expectedOutputType === "array") {
                    result = JSON.parse(result);

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