/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

export const TaskNodeType = {
    GET_DATA: 'get-data',
    HTTP_DATA: 'http-data',
    LLM_PROCESS: 'llm-process',
    AI_TOOL: 'ai-tool',
    CHART: 'chart',
    DATA_SOURCE: 'data-source',
    JSON_REFORMATTER: 'json-reformatter',
    DATA_FLOW_SPY: 'data-flow-spy',
    DATA_VALIDATION: 'data-validation',
    TIMER: 'timer',
} as const;

export type TaskNodeType = typeof TaskNodeType[keyof typeof TaskNodeType];

export const TaskNodeTitles: Record<TaskNodeType, string> = {
    [TaskNodeType.GET_DATA]: 'GET Data',
    [TaskNodeType.HTTP_DATA]: 'Fetch Web Page',
    [TaskNodeType.LLM_PROCESS]: 'AI Data Processing',
    [TaskNodeType.AI_TOOL]: 'AI Tool',
    [TaskNodeType.CHART]: 'Display Chart',
    [TaskNodeType.DATA_SOURCE]: 'Data Source',
    [TaskNodeType.JSON_REFORMATTER]: 'JSON Reformatter',
    [TaskNodeType.DATA_FLOW_SPY]: 'Data Flow Spy',
    [TaskNodeType.DATA_VALIDATION]: 'Data Validation',
    [TaskNodeType.TIMER]: 'Timer',
};

export const FetchDataType = {
    JSON: 'json',
    TEXT: 'text',
    CSV: 'csv',
    XML: 'xml',
    BLOB: 'blob',
    ARRAY_BUFFER: 'arrayBuffer',
} as const;

export type FetchDataType = typeof FetchDataType[keyof typeof FetchDataType];


export const AI_TOOL_PORT_COLOR = "#9c27b0";

export const TIMER_TRIGGER_PORT_COLOR = "#0bb6e1ea";

export const TOOL_PORT_ID = "tools-target";

export const TIMER_TRIGGER_PORT_ID = "timer-trigger";

export const PROVIDERS = {
    GMAIL: 'gmail',
    DRIVE: 'drive',
    CALENDAR: 'calendar',
};

export const PROVIDER_SCOPES = {
    [PROVIDERS.GMAIL]: 'https://www.googleapis.com/auth/gmail.readonly',
    [PROVIDERS.DRIVE]: 'https://www.googleapis.com/auth/drive.readonly',
    [PROVIDERS.CALENDAR]: 'https://www.googleapis.com/auth/calendar.readonly',
};

export const ACCESS_TOKEN_TYPE_OAUTH = "oauth";