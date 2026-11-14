/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {ToolSchema} from "../../types/tool.types";
import {ToolCall} from "./types";

/**
 * Some models occasionally emit a tool call as plain JSON text in `message.content`
 * instead of using the structured `message.tool_calls` field (observed on later
 * turns of a multi-call tool loop, e.g. gemma models). When that happens the tool loop
 * would otherwise treat the response as a final text answer and never
 * execute the call. This recovers it — but only when the parsed JSON unambiguously names
 * one of the tools actually available in this request, so a normal prose reply (even one
 * that happens to be valid JSON for unrelated reasons) is never affected.
 */
export function recoverToolCallFromContent (
    response: {message: {content?: string; tool_calls?: any[]}},
    tools?: {schema: Pick<ToolSchema, "name">}[]
): void {
    if (!tools || tools.length === 0) return;

    if (Array.isArray(response.message.tool_calls) && response.message.tool_calls.length > 0) return;

    const content = response.message.content?.trim();

    if (!content) return;

    const recovered = leakedToolCalls(parseLeakedJson(content), new Set(tools.map(t => t.schema.name)));

    if (recovered.length === 0) return;

    /* #if LOGS */
    console.log("Recovered tool call(s) emitted as plain-text content instead of tool_calls:", recovered);
    /* #endif */

    response.message.tool_calls = recovered;
    response.message.content = "";
}

/** The JSON in a response's text, code fence or not; undefined when there is none. */
function parseLeakedJson (content: string): unknown {
    const unfenced = content.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();

    try {
        return JSON.parse(unfenced);
    } catch {
        // The model sometimes hallucinates stray tokens around the JSON (e.g. leading
        // garbage before the '{'), which breaks a whole-string parse. Fall back to
        // scanning for the first balanced {...} object anywhere in the text.
        const extracted = extractBalancedJsonObject(unfenced);

        if (!extracted) return undefined;

        try {
            return JSON.parse(extracted);
        } catch {
            return undefined;
        }
    }
}

/**
 * The tool calls in leaked JSON (one call or a list) that name one of `toolNames`. Models leak tool calls in different
 * shapes: Ollama's own native shape nests { function: { name, arguments } }, but some models (observed with an 8B local
 * model) emit a flatter { name, arguments } instead. Either becomes the nested shape the tool loop expects.
 */
function leakedToolCalls (parsed: unknown, toolNames: Set<string>): ToolCall[] {
    const candidates: unknown[] = Array.isArray(parsed) ? parsed : [parsed];

    return candidates
        .map(candidate => asToolCall(candidate, toolNames))
        .filter((call): call is ToolCall => call !== null);
}

function asToolCall (candidate: unknown, toolNames: Set<string>): ToolCall | null {
    if (!candidate || typeof candidate !== "object") return null;

    const nested = (candidate as { function?: unknown }).function;
    const fnSource = (nested && typeof nested === "object" ? nested : candidate) as { name?: unknown; arguments?: unknown };
    const {name, arguments: args} = fnSource;

    if (typeof name !== "string" || !toolNames.has(name) || args === undefined) return null;

    return {function: {name, arguments: args}};
}

/**
 * Scans `text` for the first balanced `{...}` object, respecting string literals
 * (so a `{` or `}` inside a quoted value doesn't throw off the depth count), and
 * returns that substring — or `null` if none closes. Used to recover a tool-call
 * JSON blob from content that has stray tokens hallucinated around it.
 */
function extractBalancedJsonObject (text: string): string | null {
    const start = text.indexOf("{");

    if (start === -1) return null;

    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let i = start; i < text.length; i++) {
        const char = text[i];

        if (inString) {
            ({inString, escaped} = insideString(char, escaped));

            continue;
        }

        if (char === '"') {
            inString = true;
        } else if (char === "{") {
            depth++;
        } else if (char === "}") {
            depth--;

            if (depth === 0) return text.slice(start, i + 1);
        }
    }

    return null;
}

/** One character inside a string literal: whether the string goes on after it, and whether it escapes the next. */
function insideString (char: string, escaped: boolean): {inString: boolean; escaped: boolean} {
    if (escaped) return {inString: true, escaped: false};

    return {inString: char !== '"', escaped: char === "\\"};
}
