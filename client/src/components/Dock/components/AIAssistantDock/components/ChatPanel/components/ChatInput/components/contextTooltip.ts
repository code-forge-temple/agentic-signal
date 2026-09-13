/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {ContextLimitSource} from '../../../../../utils/modelContext';


export type ContextGaugeProps = {
    usedTokens: number;
    /** null when the window size is genuinely unknown — a cloud model that reported no maximum. */
    contextLimit: number | null;
    limitSource: ContextLimitSource;
    hasModel: boolean;
};

const LIMIT_NOTE: Record<ContextLimitSource, string> = {
    override: 'Limit: your context window override for this model.',
    cloudMax: "Limit: this cloud model's maximum. It runs on Ollama's servers, which always allocate the full window and silently ignore any size set here.",
    // eslint-disable-next-line max-len
    assumedDefault: "Limit: assuming Ollama's default, which depends on the server's free VRAM — 4K below 24 GiB, 32K up to 48 GiB, 256K above — and Ollama doesn't report the window it actually allocated. Set a context window in model settings for an exact figure.",
};

const OVER_LIMIT_NOTE: Record<ContextLimitSource, string> = {
    override: 'Over the limit — Ollama is dropping the oldest messages.',
    // Cloud rejects an oversized prompt outright rather than truncating it.
    cloudMax: 'Over the limit — Ollama Cloud rejects a prompt longer than the model maximum.',
    assumedDefault: 'Over the limit — Ollama is dropping the oldest messages.',
};

/**
 * Kept out of ContextGauge.tsx so the wording is testable without rendering the ring (and so
 * that file exports only its component).
 */
export const buildContextTooltip = ({usedTokens, contextLimit, limitSource, hasModel}: ContextGaugeProps): string => {
    if (!hasModel) return 'Context window\nNo model selected.';

    // Unmeasured is a real state, distinct from "measured as zero": nothing has been sent yet.
    const measured = usedTokens > 0;

    if (contextLimit === null) {
        return [
            measured ? `Context: ${usedTokens.toLocaleString()} tokens used.` : 'Context: no measurement yet.',
            "Window size unknown — this cloud model didn't report a maximum.",
        ].join('\n');
    }

    const percent = contextLimit > 0 ? Math.round((usedTokens / contextLimit) * 100) : 0;

    return [
        measured
            ? `Context: ${usedTokens.toLocaleString()} / ${contextLimit.toLocaleString()} tokens (${percent}%)`
            : `Context: no measurement yet — limit ${contextLimit.toLocaleString()} tokens.`,
        measured
            ? 'Measured on the last response; the next message adds to it.'
            : 'Send a message to measure it.',
        LIMIT_NOTE[limitSource],
        usedTokens > contextLimit ? OVER_LIMIT_NOTE[limitSource] : ''
    ].filter(Boolean).join('\n');
};
