/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {IMAGE_FILE_EXTENSIONS} from "@shared/constants";
import {AceEditorMode} from "./types";
import {fileExtension} from "@shared/utils";

const MODE_BY_EXTENSION = new Map<string, AceEditorMode>(Object.entries({
    md: 'markdown',
    txt: 'text',
    html: 'html',
    css: 'css',
    scss: 'scss',
    js: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    json: 'json',
    xml: 'xml',
    csv: 'csv',
    yaml: 'yaml',
    yml: 'yaml',
    ini: 'ini',
    log: 'text',
    sh: 'sh',
    sql: 'sql',
    py: 'python',
    java: 'java',
    c: 'c_cpp',
    cpp: 'c_cpp',
    h: 'c_cpp',
    bat: 'batchfile',
    env: 'ini',
} satisfies Record<string, AceEditorMode>));

/** The editor mode for a file, by its extension: images show as Markdown, an unknown extension as text. */
export function getEditorMode (filename: string): AceEditorMode {
    const ext = fileExtension(filename);

    if (IMAGE_FILE_EXTENSIONS.has(ext)) return "markdown";

    // A Map, so "constructor" and the like are just unknown extensions.
    return MODE_BY_EXTENSION.get(ext) ?? 'text';
}
