/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {AceEditorMode} from "./types";

export function getEditorMode (filename: string): AceEditorMode {
    const ext = filename.split('.').pop()?.toLowerCase();

    if (["png", "jpg", "jpeg", "gif", "bmp", "webp", "svg"].includes(ext || "")) {
        return "markdown";
    }

    switch (ext) {
        case 'md': return 'markdown';
        case 'txt': return 'text';
        case 'html': return 'html';
        case 'css': return 'css';
        case 'scss': return 'scss';
        case 'js': return 'javascript';
        case 'ts': return 'typescript';
        case 'tsx': return 'typescript';
        case 'json': return 'json';
        case 'xml': return 'xml';
        case 'csv': return 'csv';
        case 'yaml':
        case 'yml': return 'yaml';
        case 'ini': return 'ini';
        case 'log': return 'text';
        case 'sh': return 'sh';
        case 'sql': return 'sql';
        case 'py': return 'python';
        case 'java': return 'java';
        case 'c': return 'c_cpp';
        case 'cpp': return 'c_cpp';
        case 'h': return 'c_cpp';
        case 'bat': return 'batchfile';
        case 'env': return 'ini';
        default: return 'text';
    }
}