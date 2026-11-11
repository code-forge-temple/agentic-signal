/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import Ajv from "ajv";
import {sanitizeJsonInput} from "../../ToolNode/tools/utils/sanitize";
import {errorMessage} from "@shared/utils";


// ---------------------------------------------------------------------------
// Format schema helpers
// ---------------------------------------------------------------------------

/**
 * Recursively resolves the expected JSON type from a parsed (or stringified)
 * JSON Schema. Returns undefined if the type cannot be determined — this is
 * the safe default; callers should skip JSON.parse on the LLM reply when the
 * type is unknown.
 *
 * Never throws — an unrecognised schema gives undefined.
 */
export function getExpectedOutputType (format: unknown): string | undefined {
    try {
        const schema: unknown = typeof format === "string" ? JSON.parse(format) : format;

        if (!schema || typeof schema !== "object") return undefined;

        const {type} = schema as { type?: unknown };

        // A `type` list (e.g. ["object", "null"]) is no single output type, but it must still
        // end the oneOf/anyOf/allOf search below, so it comes back as text rather than undefined.
        if (type) return typeof type === "string" ? type : String(type);

        return combinedOutputType(schema as Record<string, unknown>);
    } catch {
        return undefined;
    }
}

/** The first output type found among `schema`'s oneOf, then anyOf, then allOf subschemas. */
function combinedOutputType (schema: Record<string, unknown>): string | undefined {
    for (const key of ["oneOf", "anyOf", "allOf"]) {
        const subschemas = schema[key];

        if (!Array.isArray(subschemas)) continue;

        const type = firstOutputType(subschemas as unknown[]);

        if (type !== undefined) return type;
    }

    return undefined;
}

/** The output type of the first of `subschemas` that has one. */
function firstOutputType (subschemas: unknown[]): string | undefined {
    for (const subschema of subschemas) {
        const type = getExpectedOutputType(subschema);

        if (type !== undefined) return type;
    }

    return undefined;
}

/**
 * Merges `onSuccess` and `onError` schemas into a single `oneOf` schema string
 * suitable for passing to Ollama's structured output.
 *
 * Rules:
 * - Both present → `{ oneOf: [onSuccess, onError] }`
 * - Only `onSuccess` → returned as-is
 * - Only `onError` → returns `undefined` (an error schema alone must not
 *   constrain a success response)
 *
 * Throws if either schema string is not valid JSON.
 */
export function buildUnifiedFormat (format: {onSuccess?: string; onError?: string;}): string | undefined {
    const {onSuccess, onError} = format;

    if (onSuccess && onError) {
        return JSON.stringify({
            oneOf: [JSON.parse(onSuccess), JSON.parse(onError)]
        });
    }

    if (onSuccess) return onSuccess;

    return undefined;
}

export type ParsedFormat = {
    parsedFormat: object | undefined;
    onErrorValidator: ((data: any) => boolean) | undefined;
};

/**
 * Parses a node format config into a ready-to-use OllamaService format object
 * and an optional AJV validator for the `onError` schema.
 *
 * Accepts the three shapes that can arrive from the node config:
 * - `undefined` / empty → returns both fields as `undefined`
 * - object `{onSuccess?, onError?}` → standard node format config
 * - plain string → treated as a raw JSON Schema string (legacy / direct pass)
 *
 * Throws on invalid JSON in any schema string so callers can surface the error
 * to the user immediately rather than silently producing wrong output.
 */
export function parseFormat (
    format: {onSuccess?: string; onError?: string;} | string | undefined
): ParsedFormat {
    if (!format) return {parsedFormat: undefined, onErrorValidator: undefined};

    let unifiedFormat: string | undefined;
    let onErrorValidator: ((data: any) => boolean) | undefined;

    if (typeof format === "object" && (format.onSuccess || format.onError)) {
        unifiedFormat = buildUnifiedFormat(format);

        if (format.onError) {
            const ajv = new Ajv();

            onErrorValidator = ajv.compile(JSON.parse(format.onError));
        }
    } else if (typeof format === "string") {
        unifiedFormat = format;
    }

    const parsedFormat = unifiedFormat ? JSON.parse(unifiedFormat) as object : undefined;

    return {parsedFormat, onErrorValidator};
}

/**
 * Parses LLM response text into JSON, unwrapping optional markdown code fences.
 *
 * Supported input forms:
 * - raw JSON
 * - ```json\n{...}\n```
 * - ```\n{...}\n```
 * - fenced arrays
 * - leading/trailing whitespace
 */
export function llmResponseJsonParse<T = unknown> (reply: string): T {
    if (typeof reply !== "string") {
        throw new TypeError(
            `Expected string response, received ${typeof reply}`
        );
    }

    let jsonText = reply.trim();

    // Remove UTF-8 BOM if present
    jsonText = jsonText.replace(/^\uFEFF/, "");

    // Remove opening fence
    jsonText = jsonText.replace(/^```(?:json)?\s*/i, "");

    // Remove closing fence
    jsonText = jsonText.replace(/\s*```$/, "");

    jsonText = jsonText.trim();

    try {
        return JSON.parse(jsonText) as T;
    }
    catch (error) {
        try {
            return sanitizeJsonInput(jsonText) as T;
        }
        catch (sanitizeError) {
            throw new Error(
                `Failed to parse JSON: ${
                    errorMessage(error)
                }; sanitization fallback failed: ${
                    errorMessage(sanitizeError)
                }`
            );
        }
    }
}


// ---------------------------------------------------------------------------
// Input serialization
// ---------------------------------------------------------------------------

/**
 * Converts any input value to a string suitable for use as LLM message
 * content. Returns `undefined` for `null`/`undefined` inputs so callers can
 * skip adding an empty user message.
 */
export const serializeInput = (inputData: any): string | undefined => {
    if (inputData == undefined) return undefined;

    if (typeof inputData === "string") return inputData;

    if (typeof inputData === "object") return JSON.stringify(inputData, null, 4);

    return String(inputData);
};

export function assertIsSerializedInput (input: any): asserts input is string {
    if (typeof input !== "string") {
        throw new Error(`Expected serialized input to be a string, but got ${typeof input}`);
    }
}
