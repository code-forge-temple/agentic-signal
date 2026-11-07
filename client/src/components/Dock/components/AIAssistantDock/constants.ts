import {ROLE} from "../../../../constants";

export type ChatMessage = {
    role: typeof ROLE.USER | typeof ROLE.ASSISTANT;
    content: string;
    /** When the user sent it, in ms: the model reads it as a stamp before the message; the chat doesn't show it. */
    sentAt?: number;
    thinking?: string;
    /**
     * A command's results, which this reply answers from: shown folded away at the top of the reply,
     * and read by the model as a user message just before it.
     */
    commandResults?: {label: string; content: string};
    /**
     * Set while this is a command's status line, "Running /research on the AI Buddy layer…": the chat draws it
     * with that layer as a chip that opens it. `content` holds the same line as text.
     */
    runningCommand?: string;
    /** The user skipped the command this reply suggested (in a `command` block): it shows as skipped, with no Run. */
    suggestionSkipped?: boolean;
};

export const NOTICE_ROLE = "notice";

/** A line in the chat that isn't part of the conversation, never sent to the model: the model was switched here. */
export type ChatNotice = {
    role: typeof NOTICE_ROLE;
    model: string;
    /** The model in use before, so switching straight back removes the line again. */
    previousModel: string;
};

export type ChatEntry = ChatMessage | ChatNotice;

export const AI_ASSISTANT_TITLE = "AI Buddy";

/**
 * Tagged with the model that produced it: token counts aren't comparable across tokenizers,
 * so a reading is only meaningful while that model stays selected.
 */
export type ContextUsage = {
    model: string;
    promptTokens: number;
    replyTokens: number;
};

export const EMPTY_CONTEXT_USAGE: ContextUsage = {model: "", promptTokens: 0, replyTokens: 0};
