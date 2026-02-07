/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {useState, useCallback} from 'react';
import {OllamaService} from '../../../../services/ollamaService';
import {GenericNodeData} from '../../../../types/workflow';
import {Message, MessageRole, SystemUserConfigValues, ToolSchema} from '../../../../types/ollama.types';
import Ajv from "ajv";
import {LlmProcessNodeData} from '../types/workflow';


export interface UseAIProcessorOptions {
    onSuccess?: (result: any) => void;
    onError?: (error: string) => void;
}

function getExpectedOutputType (format: any): string {
    try {
        const schema = typeof format === "string" ? JSON.parse(format) : format;

        if (!schema || typeof schema !== "object") return "unknown";

        if (schema.type) {
            return schema.type;
        }

        for (const key of ["oneOf", "anyOf", "allOf"]) {
            if (Array.isArray(schema[key])) {
                for (const subschema of schema[key]) {
                    const type = getExpectedOutputType(subschema);

                    if (type !== "unknown") return type;
                }
            }
        }
    } catch (e) {
        throw new Error(`Invalid format schema: ${e instanceof Error ? e.message : String(e)}`);
    }

    return "unknown";
}

const serializeInput = (inputData: any): string | undefined => {
    if (inputData == undefined) {
        return undefined;
    }

    if (typeof inputData === 'string') {
        return inputData;
    }

    if (typeof inputData === 'object') {
        return JSON.stringify(inputData, null, 4);
    }

    return String(inputData);
};

function assertIsSerializedInput (input: any): asserts input is string {
    if (typeof input !== 'string') {
        throw new Error(`Expected serialized input to be a string, but got ${typeof input}`);
    }
}

const buildUnifiedFormat = (format: {onSuccess?: string; onError?: string;}): string | undefined => {
    if (!format) return undefined;

    const {onSuccess, onError} = format;

    if (onSuccess && onError) {
        return JSON.stringify({
            oneOf: [
                JSON.parse(onSuccess),
                JSON.parse(onError)
            ]
        });
    }

    if (onSuccess) return onSuccess;

    // in case of only onError provided, we ignore it because we don't want to return an error as a success response

    return undefined;
};

export function useAIProcessor (options: UseAIProcessorOptions = {}) {
    const {onSuccess, onError} = options;
    const [error, setError] = useState<string | null>(null);
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

                setError(errorMsg);
                onError?.(errorMsg);

                return [];
            }
        } catch (error) {
            const errorMsg = `Failed to fetch models: ${error instanceof Error ? error.message : String(error)}`;

            setError(errorMsg);
            onError?.(errorMsg);

            return [];
        } finally {
            setIsFetchingModels(false);
        }
    }, [onError]);

    const processAIRequest = useCallback(async ({
        input,
        prompt,
        message,
        model,
        format,
        tools,
        feedback,
        maxToolRetries,
        conversationHistory
    }: Pick<GenericNodeData & LlmProcessNodeData, 'input' | 'prompt' | 'message' | 'model' | 'format'> & {
    tools?: {
        schema: ToolSchema,
        systemUserConfigValues: SystemUserConfigValues,
        handler: (params: any) => Promise<any>
    }[];
    feedback?: string;
    maxToolRetries: number;
    conversationHistory: {
        value: Message[];
        onChange: (history: Message[]) => void;
    };
}) => {
        if (!model) {
            const errorMsg = "Please select a model first.";

            setError(errorMsg);
            onError?.(errorMsg);

            return null;
        }

        if (!prompt && !message && !input) {
            const errorMsg = "Please provide a prompt, message, or input data.";

            setError(errorMsg);
            onError?.(errorMsg);

            return null;
        }

        setError(null);

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
                    const serializedInput = serializeInput(input);

                    assertIsSerializedInput(serializedInput);

                    const userContent = message
                        ? `${message.preffix || ''}${serializedInput}${message.suffix || ''}`
                        : serializedInput;

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
                        const serializedInput = serializeInput(input);

                        assertIsSerializedInput(serializedInput);

                        const userContent = message
                            ? `${message.preffix || ''}${serializedInput}${message.suffix || ''}`
                            : serializedInput;

                        messages.push({
                            role: MessageRole.USER,
                            content: userContent
                        });
                    }
                }
            }

            let parsedFormat;
            let onErrorSchema;
            let onErrorValidator: ((data: any) => boolean) | undefined;

            if (format) {
                try {
                    let unifiedFormat: string | undefined;

                    if (typeof format === "object" && (format.onSuccess || format.onError)) {
                        unifiedFormat = buildUnifiedFormat(format);

                        if (format.onError) {
                            onErrorSchema = JSON.parse(format.onError);

                            const ajv = new Ajv();

                            onErrorValidator = ajv.compile(onErrorSchema);
                        }
                    } else if (typeof format === "string") {
                        unifiedFormat = format;
                    }

                    if (unifiedFormat) {
                        parsedFormat = JSON.parse(unifiedFormat);
                    }
                } catch (parseError) {
                    const errorMsg = `Invalid format JSON: ${parseError instanceof Error ? parseError.message : String(parseError)}`;

                    setError(errorMsg);
                    onError?.(errorMsg);

                    return null;
                }
            }

            const response = await OllamaService.getInstance().fetchAIResponse({
                messages,
                model,
                ...(parsedFormat ? {format: parsedFormat} : {}),
                tools,
                maxToolRetries
            });

            if (!response.success) {
                const errorMsg = `Failed to fetch AI response: ${response.error}`;

                setError(errorMsg);
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

                if (expectedOutputType === "object") {
                    result = JSON.parse(result);

                    if (onErrorValidator && onErrorValidator(result)) {
                        const errorMsg = `LLM returned an error response matching onError schema:\n${JSON.stringify(result, null, 4)}`;

                        setError(errorMsg);
                        onError?.(errorMsg);

                        return null;
                    }
                }
            } catch (parseError) {
                const errorMsg = `Failed to parse AI response: ${parseError instanceof Error ? parseError.message : String(parseError)}`;

                setError(errorMsg);
                onError?.(errorMsg);

                return null;
            }


            onSuccess?.(result);

            return result;
        } catch (error) {
            const errorMsg = `Unexpected error: ${error instanceof Error ? error.message : String(error)}`;

            setError(errorMsg);
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
        clearError: () => setError(null),
    };
}