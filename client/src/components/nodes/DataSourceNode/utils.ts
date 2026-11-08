/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {BINARY_FILE_EXTENSIONS, IMAGE_FILE_EXTENSIONS, TRIPLE_BACKTICK} from "@shared/constants";
import {arrayBufferToBase64,
    extractFromMarkdown,
    EXTRACTION_TYPE,
    fileExtensionToCodeBlockLang,
    markdownFilePrefix,
    markdownImageFilePrefix, errorMessage} from "@shared/utils";
import {AttachedFile} from "@shared/types.gen";
import {NodeEnvelope} from "../../../types/workflow";
import {DATA_SOURCE_TYPES, DataSourceNodeData, FileData} from "./types/workflow";


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

const extensionOf = (name: string): string => name.split('.').pop()?.toLowerCase() || "";

const toArray = (x: unknown): unknown[] => x === undefined ? [] : (Array.isArray(x) ? x : [x]);

/** Throws on text that isn't base64. */
const base64ToBytes = (base64: string): Uint8Array => Uint8Array.from(atob(base64), c => c.charCodeAt(0));

/**
 * A file, given as its bytes, the way Data Source keeps an attached one: an image as a Markdown image, a
 * text file as a code block, a binary file (PDF, DOCX, …) as a placeholder and sent to tools only unless
 * `isToolsPayload` says otherwise. Throws when `base64` isn't base64.
 */
export const fileDataFromBytes = (
    {name, base64, mimeType, isToolsPayload}: {name: string; base64: string; mimeType?: string; isToolsPayload?: boolean}
): FileData => {
    const ext = extensionOf(name);
    const type = mimeType || mimeTypeFromExtension(ext);
    const isBinary = BINARY_FILE_EXTENSIONS.has(ext);
    // Decoded even when only the bytes are kept, so bad base64 is caught here rather than by a tool later.
    const bytes = base64ToBytes(base64);
    const content = IMAGE_FILE_EXTENSIONS.has(ext)
        ? `![${name}](data:${type};base64,${base64})`
        : isBinary
            ? `[Binary attachment: ${name}]`
            : `${TRIPLE_BACKTICK}${fileExtensionToCodeBlockLang(ext)}\n${new TextDecoder('utf-8').decode(bytes)}\n${TRIPLE_BACKTICK}`;

    return {name, content, base64, mimeType: type, isToolsPayload: isToolsPayload ?? isBinary};
};

/**
 * What a Data Source puts out: its own content, JSON or text with files, together with what came from upstream.
 * Files go into the text, except tools-only ones, which go to `toolsPayload`. Throws when the JSON doesn't
 * parse or a tools-only file has no data to send.
 */
export function buildDataSourceEnvelope (dataSource: DataSourceNodeData["dataSource"], upstream?: NodeEnvelope): NodeEnvelope {
    const up = upstream?.payload;
    const upTools = upstream?.toolsPayload;
    const upIsString = typeof up === 'string';

    if (dataSource.type === DATA_SOURCE_TYPES.JSON) {
        let own: unknown;

        try {
            own = JSON.parse(dataSource.value || "{}");
        } catch (e) {
            throw new Error("Invalid JSON data: " + (errorMessage(e)));
        }

        // Upstream and own are kept as distinct array elements rather than merged —
        // an object-spread merge would silently drop upstream keys on collision.
        // JSON mode never contributes its own new tools attachments.
        const payload = up === undefined
            ? own
            : upIsString
                ? [own, ...toArray(up)]
                : [...toArray(up), own];
        const toolsPayload = toArray(upTools);

        return {payload, ...(toolsPayload.length > 0 ? {toolsPayload} : {})};
    }

    let own = dataSource.value?.text || "";
    let imageCounter = 1;
    const ownTools: AttachedFile[] = [];
    const filesWithoutData: string[] = [];

    for (const file of dataSource.value?.files || []) {
        const ext = extensionOf(file.name);
        // isToolsPayload=undefined means infer from extension (backward compat with saved workflows)
        const isToolsPayload = file.isToolsPayload ?? BINARY_FILE_EXTENSIONS.has(ext);

        if (isToolsPayload) {
            const base64 = fileBase64(file, ext);

            if (base64 === undefined) {
                filesWithoutData.push(file.name);
            } else {
                ownTools.push({name: file.name, base64, mimeType: file.mimeType || mimeTypeFromExtension(ext)});
            }
        } else if (IMAGE_FILE_EXTENSIONS.has(ext)) {
            own += `\n\n${markdownImageFilePrefix(imageCounter++, file.name)}${file.content}\n\n`;
        } else {
            own += `\n\n${markdownFilePrefix(file.name)}${file.content}\n\n`;
        }
    }

    if (filesWithoutData.length > 0) {
        throw new Error(`No file data saved for ${filesWithoutData.map(name => `"${name}"`).join(", ")} — remove the file and attach it again.`);
    }

    // Both naturally textual — join into one document rather than keeping separate
    // array elements. Otherwise, upstream is kept distinct (spread if already an
    // array, wrapped as one element otherwise) with own appended last.
    const payload = up === undefined
        ? own
        : upIsString
            ? up + own
            : [...toArray(up), own];
    const toolsPayload = [...toArray(upTools), ...ownTools];

    return {payload, ...(toolsPayload.length > 0 ? {toolsPayload} : {})};
}
