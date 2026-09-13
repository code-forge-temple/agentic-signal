import {ROLE} from "../../../../constants";

export type ChatMessage = {
    role: typeof ROLE.USER | typeof ROLE.ASSISTANT;
    content: string;
    thinking?: string;
};

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
