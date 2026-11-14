import {CODE_BLOCK_LANG_BY_EXTENSION, DEFAULT_RAG_COLLECTION} from "./constants.ts";


export const EXTRACTION_TYPE = {
    IMAGE: 'IMAGE',
    CODE_BLOCK: 'CODE_BLOCK',
} as const;

export type EXTRACTION_TYPE = typeof EXTRACTION_TYPE[keyof typeof EXTRACTION_TYPE];

export const extractFromMarkdown = (markdown: string, type: EXTRACTION_TYPE): string[] => {
    const results: string[] = [];

    if (type === EXTRACTION_TYPE.IMAGE) {
        const imageRegex = /!\[[^\]]*\]\((data:[^)]*)\)/g;
        let match;

        while ((match = imageRegex.exec(markdown)) !== null) {
            results.push(match[1]);
        }
    }

    if (type === EXTRACTION_TYPE.CODE_BLOCK) {
        const codeBlockRegex = /```[a-zA-Z0-9]*\n([\s\S]*?)\n```/g;
        let match;

        while ((match = codeBlockRegex.exec(markdown)) !== null) {
            results.push(match[1]);
        }
    }

    return results;
};

// The headings a message's attachments are written under (markdownFilePrefix, markdownImageFilePrefix), after a blank
// line; group 1 is a file's name, none for an image. A name runs to the end of its heading line, so quotes and
// parentheses in it ('my "draft".md', 'photo (1).png') are part of it. Only these split a message: a document's own
// "### " headings, and any heading in the text, are text.
const ATTACHMENT_HEADING = /\n\n### (?:File name "([^\n]+)"|Image \d+ \(file name [^\n]*\) attached)\n/g;
const CLOSING_FENCE = /\n```[ \t]*(?=\n|$)/g;

/**
 * How much of `rest` (the text after an attachment's heading, up to the next one) is the attachment: a text file is in
 * a code block (a document's own code blocks inside it), so it ends at the last closing fence; anything else (an image,
 * a placeholder line) at the first blank line. What follows, a message's suffix say, isn't the attachment's.
 */
function attachmentLength (rest: string): number {
    if (rest.startsWith("```")) {
        const fences = [...rest.matchAll(CLOSING_FENCE)];
        const lastFence = fences[fences.length - 1];

        return lastFence ? lastFence.index + lastFence[0].length : rest.length;
    }

    const blankLine = rest.indexOf("\n\n");

    return blankLine === -1 ? rest.length : blankLine;
}

/** A message's attachments, in order: where each starts (its heading) and ends, its content, and a file's name. */
function attachmentSections (markdown: string): Array<{fileName?: string; start: number; end: number; content: string}> {
    const headings = [...markdown.matchAll(ATTACHMENT_HEADING)];

    return headings.map((heading, i) => {
        const contentStart = heading.index + heading[0].length;
        const rest = markdown.slice(contentStart, headings[i + 1]?.index ?? markdown.length);
        const content = rest.slice(0, attachmentLength(rest));

        return {fileName: heading[1], start: heading.index, end: contentStart + content.length, content: content.trim()};
    });
}

/**
 * The text files in a message built by DataSourceNode (markdownFilePrefix sections), as {name, content}: what the RAG
 * node ingests. Images aren't files here.
 */
export const extractFileBlocksFromMarkdown = (markdown: string): Array<{name: string; content: string}> =>
    attachmentSections(markdown).flatMap(({fileName, content}) => (fileName === undefined ? [] : [{name: fileName, content}]));

/** The text before a message's first attachment (all of it when there's none): the RAG node's query. */
export const extractQueryFromMarkdown = (markdown: string): string => markdown.slice(0, attachmentSections(markdown)[0]?.start).trim();

/**
 * The message without its text files, everything else kept (the text, images, what follows the files): what an LLM
 * gets when a RAG node took the files, so they don't fill its context window.
 */
export function withoutFileBlocks (markdown: string): string {
    let kept = "";
    let from = 0;

    for (const {fileName, start, end} of attachmentSections(markdown)) {
        if (fileName === undefined) continue;

        kept += markdown.slice(from, start);
        from = end;
    }

    return kept + markdown.slice(from);
}

export const isObject = (value: unknown): value is Record<string, unknown> => {
    return typeof value === "object" && value !== null;
}

export const fileExtensionToCodeBlockLang = (extension: string | undefined): string => {
    return CODE_BLOCK_LANG_BY_EXTENSION[extension?.toLowerCase() || ''] ?? '';
};

export const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    const chunkSize = 0x8000;

    for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }

    return globalThis.btoa(binary);
};

/** A file name's own extension, lower-cased; empty when it has none ("Makefile", "pdf"). */
export const fileExtension = (name: string): string => (name.includes('.') ? name.split('.').pop()!.toLowerCase() : "");

export const markdownImageFilePrefix = (index: number, fileName: string): string => `### Image ${index} (file name ${fileName}) attached\n`;

export const markdownFilePrefix = (fileName: string): string => `### File name "${fileName}"\n`;

/** An error's message, or the thrown value as text when it isn't an Error. */
export const errorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/**
 * The Weaviate class a RAG collection's chunks are kept in: its name (rag_collection when none is typed) with only
 * letters and digits kept and the first one uppercase, as Weaviate requires (Rag before a leading digit, since a class
 * starts with a letter); RagCollection when nothing is left. So "my_docs", "my-docs" and "my docs" are all the class
 * Mydocs: one collection. Its meta class is that name with "Meta" after it. The server writes by this rule and the RAG
 * node reads by it, so they always mean the same collection.
 */
export const ragClassName = (collectionName: string): string => {
    const safe = (collectionName || DEFAULT_RAG_COLLECTION).replace(/[^a-zA-Z0-9]/g, "");

    if (!safe) return "RagCollection";

    return /^[0-9]/.test(safe) ? `Rag${safe}` : safe.charAt(0).toUpperCase() + safe.slice(1);
};

/**
 * Whether a Weaviate class holds a RAG collection's file list (its meta class: the collection's class with "Meta" after
 * it), not chunks. "Meta" alone is no collection's meta class: it's the class of a collection named "meta".
 */
export const isRagMetaClass = (className: string): boolean => className !== "Meta" && className.endsWith("Meta");

/**
 * A RAG owner key's fingerprint (SHA-256, hex), the only form of the key a collection's meta keeps: whoever can read
 * Weaviate learns nothing they could type in. Empty for no key.
 */
export async function ragOwnerKeyHash (ownerKey: string | undefined): Promise<string> {
    if (!ownerKey) return "";

    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`agentic-signal.rag-owner:${ownerKey}`));

    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Whether a node with `ownerKey` may change a collection (add to it, replace its files, change its model, delete it):
 * one whose meta holds no key fingerprint is open to all; one that holds one only to the same key. Querying needs none.
 */
export async function mayChangeRagCollection (storedKeyHash: string | null | undefined, ownerKey: string | undefined): Promise<boolean> {
    return !storedKeyHash || storedKeyHash === await ragOwnerKeyHash(ownerKey);
}
