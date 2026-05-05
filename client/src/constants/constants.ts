/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/


export const NODE_PORT_IDS = {
    FLOW: "flow",
    TOOL: "tool",
    TRIGGER: "trigger",
    CONTEXT: "context",
} as const;

export const NODE_PORT_COLORS = {
    FLOW: "#ffc107",
    TOOL: "#9c27b0",
    TRIGGER: "#0bb6e1ea",
    CONTEXT: "#F44336",
} as const;

export const AI_ASSISTANT_KEYWORDS = {
    PREPARE_WORKFLOW: "@prepare-workflow",
    CURRENT_WORKFLOW: "@current-workflow",
} as const;

export const ROLE = {
    USER: "user",
    SYSTEM: "system",
    ASSISTANT: "assistant"
} as const;

export const DRAG_CANCEL_SELECTOR = [
    'input',
    'textarea',
    'select',
    'button',
    'label',
    '.MuiSlider-root',
    '.MuiInputBase-root',
    '.MuiSelect-root',
    '.MuiButton-root',
    '.MuiIconButton-root',
    "[role='combobox']",
    '.markdown-renderer',
    '.ace_editor',
    '.ace_text-input',
].join(', ');