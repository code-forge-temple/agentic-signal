/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {StreamPart} from "./types";

/** A streamed reply so far: its text, its thinking, and the token counts once the last part brought them. */
export type StreamedReply = {reply: string; thinking: string; promptEvalCount?: number; evalCount?: number};

/**
 * Adds a streamed part to the reply so far. Only the terminating part carries the token counts, and the
 * stream's loop consumes it, so they're latched here for the final chunk.
 */
export function addStreamedPart (streamed: StreamedReply, part: StreamPart): void {
    if (part.thinking) {
        streamed.thinking += part.thinking;
    }

    streamed.reply += part.content;

    if (typeof part.promptEvalCount === "number") {
        streamed.promptEvalCount = part.promptEvalCount;
    }

    if (typeof part.evalCount === "number") {
        streamed.evalCount = part.evalCount;
    }
}

/** The token counts the server reported, leaving out any it didn't. */
export function tokenCounts ({promptEvalCount, evalCount}: StreamedReply) {
    return {
        ...(promptEvalCount !== undefined ? {promptEvalCount} : {}),
        ...(evalCount !== undefined ? {evalCount} : {})
    };
}
