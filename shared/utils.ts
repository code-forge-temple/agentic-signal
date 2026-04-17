import {CODE_BLOCK_LANG_BY_EXTENSION, IMAGE_FILE_EXTENSIONS} from "./constants.ts";


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

export const markdownImageFilePrefix = (index: number): string => `### Image ${index} attached\n`;

export const markdownFilePrefix = (fileName: string): string => `### File "${fileName}"\n`;