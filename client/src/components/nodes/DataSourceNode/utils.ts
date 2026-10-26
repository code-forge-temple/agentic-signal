/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {BINARY_FILE_EXTENSIONS, IMAGE_FILE_EXTENSIONS} from "@shared/constants";
import {arrayBufferToBase64, extractFromMarkdown, EXTRACTION_TYPE} from "@shared/utils";
import {FileData} from "./types/workflow";


const IMAGE_MIME_SUBTYPES: Partial<Record<string, string>> = {jpg: "jpeg", svg: "svg+xml"};

export const mimeTypeFromExtension = (ext: string): string => {
    if (IMAGE_FILE_EXTENSIONS.has(ext)) return `image/${IMAGE_MIME_SUBTYPES[ext] ?? ext}`;

    if (BINARY_FILE_EXTENSIONS.has(ext)) return "application/octet-stream";

    return ext === "csv" ? "text/csv" : "text/plain";
};

/**
 * A text file's own text, from the code block its `content` is saved in. Takes everything up to the closing fence
 * at the very end, so a file with code blocks of its own (e.g. Markdown) comes out whole.
 * `undefined` when `content` isn't wrapped in a code block.
 */
export const fileText = (content: string): string | undefined => content.match(/^```[a-zA-Z0-9]*\n([\s\S]*)\n```$/)?.[1];

/**
 * The file's bytes as base64. Workflows saved before every attached file kept its `base64` have only the
 * Markdown `content`: a text file's code block or an image's data URL, both rebuilt here. A binary file
 * (PDF, DOCX, …) can't be rebuilt from its placeholder text, so it returns `undefined`.
 */
export const fileBase64 = (file: FileData, ext: string): string | undefined => {
    if (file.base64 !== undefined) return file.base64;

    if (IMAGE_FILE_EXTENSIONS.has(ext)) {
        return extractFromMarkdown(file.content, EXTRACTION_TYPE.IMAGE)[0]?.split(",")[1];
    }

    if (BINARY_FILE_EXTENSIONS.has(ext)) return undefined;

    return arrayBufferToBase64(new TextEncoder().encode(fileText(file.content) ?? file.content).buffer);
};
