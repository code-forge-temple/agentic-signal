/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {TRIPLE_BACKTICK} from "@shared/constants";
import {AI_ASSISTANT_KEYWORDS, ROLE} from "../../../../../constants";
import {ChatEntry, ChatMessage, ChatNotice, ContextUsage, EMPTY_CONTEXT_USAGE, NOTICE_ROLE} from "../constants";
import {withModelSwitch} from "./modelSwitch";


/** The entries with the last one, an AI Buddy reply, changed; the same entries when the last isn't a reply. */
function withLastReply (entries: ChatEntry[], change: (reply: ChatMessage) => ChatMessage): ChatEntry[] {
    const last = entries[entries.length - 1];

    if (last?.role !== ROLE.ASSISTANT) return entries;

    return [...entries.slice(0, -1), change(last)];
}

/** The reply as streamed so far. */
export const withReplyText = (entries: ChatEntry[], {reply, thinking}: {reply: string; thinking?: string}) =>
    withLastReply(entries, last => ({...last, content: reply, thinking}));

/** The reply replaced by `content` (an error), which keeps the command results it was answering from. */
export const withReplyReplaced = (entries: ChatEntry[], content: string) =>
    withLastReply(entries, last => ({role: ROLE.ASSISTANT, content, commandResults: last.commandResults}));

/**
 * What a finished reply used of the context window. Empty when Ollama reported neither count: an Ollama build that
 * doesn't report them would otherwise leave the previous reading in place, looking freshly measured.
 */
export const contextUsageOf = (model: string, {promptEvalCount, evalCount}: {promptEvalCount?: number; evalCount?: number}): ContextUsage =>
    (promptEvalCount === undefined && evalCount === undefined
        ? EMPTY_CONTEXT_USAGE
        : {model, promptTokens: promptEvalCount ?? 0, replyTokens: evalCount ?? 0});

/** The tokens a reading counts for `model`: none from another model, since token counts differ between tokenizers. */
export const usedTokens = (usage: ContextUsage, model: string) => (usage.model === model ? usage.promptTokens + usage.replyTokens : 0);

/**
 * The chat before the message at `index`, for resending it. A model switch among the entries it drops still holds,
 * so it's drawn again before the resent message.
 */
export function historyBefore (entries: ChatEntry[], index: number, model: string): ChatEntry[] {
    const history = entries.slice(0, index);
    const firstSwitch = entries.slice(index + 1).find((entry): entry is ChatNotice => entry.role === NOTICE_ROLE);

    return firstSwitch && firstSwitch.previousModel !== model ? withModelSwitch(history, model, firstSwitch.previousModel) : history;
}

/** The user's text with each @current-workflow replaced by the shown workflow's JSON. */
export const withCurrentWorkflow = (text: string, workflowJson: () => string) => text.replace(
    new RegExp(AI_ASSISTANT_KEYWORDS.CURRENT_WORKFLOW, 'g'),
    () => `current workflow:\n\n${TRIPLE_BACKTICK}json\n${workflowJson()}\n${TRIPLE_BACKTICK}\n`
);

/** What the AI Buddy is told when a workflow it wrote fails to import. */
export const importFailureMessage = (error: string) =>
    `The workflow JSON you generated failed to import with this error: ${TRIPLE_BACKTICK}${error}${TRIPLE_BACKTICK}\nPlease fix the JSON and try again.`;
