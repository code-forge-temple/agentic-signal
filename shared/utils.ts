import {CODE_BLOCK_LANG_BY_EXTENSION, DEFAULT_RAG_COLLECTION, IMAGE_FILE_EXTENSIONS} from "./constants.ts";


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

/**
 * Extracts named file blocks from a markdown string built by DataSourceNode.
 * Parses `### File "name"\ncontent` sections produced by markdownFilePrefix().
 * Returns an array of {name, content} pairs for use in RAG ingestion.
 */
export const extractFileBlocksFromMarkdown = (markdown: string): Array<{name: string; content: string}> => {
    const parts = markdown.split(/\n\n### /);
    const results: Array<{name: string; content: string}> = [];

    for (let i = 1; i < parts.length; i++) {
        const fileMatch = parts[i].match(/^File name "([^"]+)"\n([\s\S]*?)(\n\n)?$/);

        if (fileMatch) {
            results.push({name: fileMatch[1], content: fileMatch[2].trim()});
        }
    }

    return results;
};

/**
 * Extracts the query text from a markdown string built by DataSourceNode.
 * Returns the text that precedes the first file/image block section.
 * If no file blocks are present, the entire string is the query.
 */
export const extractQueryFromMarkdown = (markdown: string): string => {
    const parts = markdown.split(/\n\n### /);

    return parts[0].trim();
};

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

export const isSupportedFileExtension = (extension: string | null): extension is string => {
    return (
        extension !== null &&
        (IMAGE_FILE_EXTENSIONS.has(extension) || extension in CODE_BLOCK_LANG_BY_EXTENSION)
    );
};

export const getFileExtension = (fileName: string | undefined, fileType?: string): string => {
    const extension = fileName?.split('.').pop()?.toLowerCase();

    if (extension && isSupportedFileExtension(extension)) {
        return extension;
    }

    const fallback = fileType?.toLowerCase() ?? "";

    if (fallback && isSupportedFileExtension(fallback)) {
        return fallback;
    }

    return "txt";
};

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
