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

export type FetchAiResponse =
    | {success: true; reply: string; final: boolean}
    | ErrorResponse;

export type ToolSchema = {
    name: string;
    description?: string;
    parameters?: object;
};

export type UserConfigSchema = {
    [key: string]: {
        type: string;
        description?: string;
        required?: boolean;
        default?: any;
        [key: string]: any;
    }
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
} | {};