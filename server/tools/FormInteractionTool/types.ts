/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

export const FormInteractionFieldFields = {
    label: 'String',
    name: 'String',
    type: 'String',
    selector: 'String',
    required: 'Boolean',
    options: '[String]',
    currentValue: 'String',
    placeholder: 'String',
} as const;

export const FormInteractionButtonFields = {
    label: 'String',
    selector: 'String',
} as const;

export const FormInteractionResultFields = {
    success: 'Boolean',
    currentUrl: 'String',
    pageTitle: 'String',
    submitted: 'Boolean',
    formFields: '[FormInteractionField]',
    actionButtons: '[FormInteractionButton]',
    error: 'String',
} as const;

export interface FormInteractionField {
    label: string;
    name: string;
    type: string;
    selector: string;
    required: boolean;
    options?: string[];
    currentValue?: string;
    placeholder?: string;
}

/** A clickable control on the page (e.g. "Next" / "Submit") the LLM can target with submitSelector. */
export interface FormInteractionButton {
    label: string;
    selector: string;
}

/** A single interaction action the LLM instructs the tool to perform on a form field. */
/** A binary file forwarded from the client (base64-encoded) to be written to a temp dir. */
export interface AttachedFile {
    name: string;
    base64: string;
    mimeType: string;
}

export interface FillAction {
    /** CSS selector for the target element. */
    selector: string;
    /**
     * - fill: type text into an input or textarea
     * - select: choose an option in a <select> (by visible label or value)
     * - check: check a checkbox or radio button
     * - uncheck: uncheck a checkbox
     * - click: click any element (e.g. a custom dropdown trigger or CTA button)
     * - upload: set files on a <input type="file"> using a pre-configured fileKey
     */
    /** Interaction to perform on the element. */
    actionType: 'fill' | 'select' | 'check' | 'uncheck' | 'click' | 'upload';
    /** Value for fill / select / radio actions. */
    value?: string;
    /**
     * Key referencing a file path in the tool's configuredFiles map.
     * Required when type is 'upload'.
     */
    fileKey?: string;
}

export interface FormInteractionArgs {
    url: string;
    /** If empty or omitted, the tool only reads the form fields (no filling). */
    actions?: FillAction[];
    /** CSS selector of the submit or "Next" button to click after filling. */
    submitSelector?: string;
    /**
     * Binary files forwarded from the LlmProcessNode (originally attached in DataSourceNode).
     * Each run writes these to a unique temp folder and deletes them afterwards.
     */
    attachedFiles?: AttachedFile[];
    /**
     * Seconds between each field action and base for per-character typing delay.
     * 0 = instant fill (uses locator.fill, no pauses); 1 = default human-like pace.
     */
    typingDelay: number;
    browserPath?: string;
    /**
     * Maximum seconds for one formInteraction call (covers session lookup, every action,
     * the submit click, and field extraction). Raise this if a high typingDelay combined
     * with long text fields pushes a single call past the client-side default (300s).
     */
    interactionTimeoutSeconds: number;
    /**
     * Scopes the browser session to a single run (see sessionManager.ts). Generated fresh
     * per run-trigger on the client so concurrent runs of the same workflow don't collide
     * on a session keyed by URL alone.
     */
    sessionId: string;
    /** The tool's subtype identifier forwarded from the frontend so server error messages stay in sync. */
    toolName: string;
}

export interface FormInteractionResult {
    success: boolean;
    currentUrl: string;
    pageTitle: string;
    submitted: boolean;
    formFields: FormInteractionField[];
    actionButtons: FormInteractionButton[];
    error?: string;
}
