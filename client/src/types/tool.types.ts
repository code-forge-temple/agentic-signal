/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

// What an AI Tool is to the LLM node: its schema for the model, its settings and their defaults, and the error a tool
// answers with. The LLM layer's own types are in services/llm/types.ts.

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
        default?: unknown;
        minimum?: number;
        maximum?: number;
        [key: string]: any;
    }
}

export type UserConfigSchema = SystemUserConfigSchema & GenericSchema;

export const getDefaultUserConfigValues = (schema: UserConfigSchema): Record<string, unknown> => {
    const defaults: Record<string, unknown> = {};

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
