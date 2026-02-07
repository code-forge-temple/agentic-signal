/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {EXTRACTION_TYPE} from "./types";


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
}

const extensionLangMap: Record<string, string> = {
    js: 'javascript',
    ts: 'typescript',
    tsx: 'tsx',
    json: 'json',
    html: 'html',
    css: 'css',
    scss: 'scss',
    md: 'markdown',
    xml: 'xml',
    csv: 'csv',
    yaml: 'yaml',
    yml: 'yaml',
    ini: 'ini',
    sh: 'bash',
    sql: 'sql',
    py: 'python',
    java: 'java',
    c: 'c',
    cpp: 'cpp',
    h: 'c',
    bat: 'bat'
};

export const fileExtensionToCodeBlockLang = (extension: string | undefined): string => {
    return extensionLangMap[extension?.toLowerCase() || ''] ?? '';
};
