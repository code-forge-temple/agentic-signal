/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import dirtyJSON from "dirty-json";

function convertStringBooleans (obj: any): any {
    if (Array.isArray(obj)) {
        return obj.map(convertStringBooleans);
    } else if (obj && typeof obj === "object") {
        const result: any = {};

        for (const [key, value] of Object.entries(obj)) {
            result[key] = convertStringBooleans(value);
        }

        return result;
    } else if (typeof obj === "string") {
        if (obj === "true") return true;

        if (obj === "false") return false;

        return obj;
    }

    return obj;
}

export const sanitizeJsonInput = (input: any): any => {
    let parsed: any;

    if (typeof input === "string") {
        try {
            const sanitized = (input as string)
                .replace(/["“”]/g, '"')
                .replace(/['‘’]/g, "'")
                .replace(/'/g, '"')
                .replace(/\bTrue\b/g, 'true')
                .replace(/\bFalse\b/g, 'false');

            parsed = dirtyJSON.parse(sanitized);
        } catch {
            throw new Error("Input could not be parsed as JSON");
        }
    } else if (typeof input === "object" && input !== null) {
        parsed = input;
    } else {
        throw new Error("Input must be a JSON string or an object");
    }

    return convertStringBooleans(parsed);
}

export const sanitizeStringInput = (input: any): string => {
    let str = String(input).trim();

    str = str.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => {
        return String.fromCharCode(parseInt(hex, 16));
    });

    str = str.replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&');

    return str.replace(/["“”]/g, '"').replace(/['‘’]/g, "'");
}