/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

export type ErrorResponse = {
    success: false;
    error: string;
}

export const MessageRole = {
    SYSTEM: "system",
    USER: "user",
    ASSISTANT: "assistant"
} as const;

export type MessageRole = typeof MessageRole[keyof typeof MessageRole];

export type Message = {
    role: MessageRole;
    content: string;
    images?: string[];
};

export type FetchModelResponse =
    | {success: true; reply: number}
    | ErrorResponse;

export type FetchAiResponseSuccess = {
    success: true;
    reply: string;
    thinking?: string;
    final: boolean
}

export type FetchAiResponse =
    | FetchAiResponseSuccess
    | ErrorResponse;

/**
 * Deliberately a separate type from `FetchAiResponseSuccess`, which is shared with
 * `fetchAIResponse` and the whole orchestration path: only the streaming chat reports
 * token counts, so only it should carry them.
 */
export type StreamAiResponseSuccess = FetchAiResponseSuccess & {
    promptEvalCount?: number;
    evalCount?: number;
}

export type StreamAiResponse =
    | StreamAiResponseSuccess
    | ErrorResponse;

/**
 * Ollama's docs also document a "max" level, but the pinned ollama client (0.5.18) types
 * `think` as boolean | "high" | "medium" | "low" and doesn't know about it. Bump that
 * dependency before adding it here rather than casting past its types.
 */
export const THINK_LEVELS = ["low", "medium", "high"] as const;

export type ThinkLevel = typeof THINK_LEVELS[number];

/**
 * Ollama accepts either a boolean or a reasoning level. Most models take both; gpt-oss takes
 * ONLY a level and silently ignores true/false — its trace can be shortened but never disabled.
 */
export type ThinkOption = boolean | ThinkLevel;

export function isThinkLevel (value: unknown): value is ThinkLevel {
    return typeof value === "string" && (THINK_LEVELS as readonly string[]).includes(value);
}

/**
 * Per-request overrides for the streaming chat. Every field is optional and absent means
 * "don't override" — `contextWindow` becomes Ollama's `num_ctx` at the request boundary.
 */
export type StreamChatOptions = {
    think?: ThinkOption;
    temperature?: number;
    contextWindow?: number;
}

export type FetchModelContextLengthResponse =
    | {success: true; contextLength: number | null}
    | ErrorResponse;

export type ToolSchema = {
    name: string;
    description?: string;
    parameters?: object;
};

export type ExtractConfigValues<T> = {
    [K in keyof T]?: Required<T>[K] extends { type: "boolean" }
        ? boolean
        : Required<T>[K] extends { type: "string" }
        ? string
        : Required<T>[K] extends { type: "number" }
        ? number
        : Required<T>[K] extends { type: "array" }
        ? any[]
        : Required<T>[K] extends { type: "object" }
        ? object
        : any;
};

export type SystemUserConfigSchema = {
    requireToolUse?: {
        type: "boolean";
        description: string;
        default: boolean;
        required?: boolean;
    };
};

export const extendSystemUserConfigSchema = (schema: GenericSchema): UserConfigSchema => {
    return {
        ...schema,
        requireToolUse: {
            type: "boolean",
            description: "Require tool use (forces the LLM to always call this tool)",
            default: true
        }
    }
}

export type SystemUserConfigValues = ExtractConfigValues<SystemUserConfigSchema>;

type GenericSchema = {
        [key: string]: {
        type: string;
        description?: string;
        required?: boolean;
        default?: any;
        [key: string]: any;
    }
}

export type UserConfigSchema = SystemUserConfigSchema & GenericSchema;

export const getDefaultUserConfigValues = (schema: UserConfigSchema): Record<string, any> => {
    const defaults: Record<string, any> = {};

    for (const [key, fieldSchema] of Object.entries(schema)) {
        if (fieldSchema && typeof fieldSchema === 'object' && 'default' in fieldSchema) {
            defaults[key] = fieldSchema.default;
        }
    }

    return defaults;
}

export type ToolError = { error: string };

export function isToolError (obj: unknown): obj is ToolError {
    return typeof obj === "object" && obj !== null && "error" in obj && typeof (obj as any).error === "string";
}