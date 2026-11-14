/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import Box from '@mui/material/Box';
import Switch from '@mui/material/Switch';
import Tooltip from '@mui/material/Tooltip';
import {Lock, Xmark} from 'iconoir-react';
import {CodeEditor, getEditorMode} from '../../../../CodeEditor';
import {MarkdownRenderer} from '../../../../MarkdownRenderer';
import {csvToMarkdownTable} from '../../../../../utils';
import {extractFromMarkdown, EXTRACTION_TYPE, fileExtension} from '@shared/utils';
import {BINARY_FILE_EXTENSIONS, IMAGE_FILE_EXTENSIONS} from '@shared/constants';
import {FileData} from '../../types/workflow';
import {fileText} from '../../utils';


type FileTabLabelProps = {
    file: FileData;
    onToggleToolsPayload: () => void;
    onRemove: () => void;
};

/**
 * An attached file's tab: whether it goes to the tools only (always for a binary file, locked), its name, and a cross
 * that removes it.
 */
export function FileTabLabel ({file, onToggleToolsPayload, onRemove}: FileTabLabelProps) {
    const isBinaryExt = BINARY_FILE_EXTENSIONS.has(fileExtension(file.name));
    const isToolsPayload = file.isToolsPayload ?? isBinaryExt;

    return (
        <Box sx={{display: 'flex', alignItems: 'center'}}>
            <Tooltip
                title={
                    isToolsPayload
                        ? "Passed to tools only (bypasses LLM context)"
                        : "Included in LLM context"
                }
            >
                {/* span wrapper required for Tooltip to work on a disabled Switch */}
                <span style={{display: 'inline-flex'}}>
                    <Switch
                        size="small"
                        checked={isToolsPayload}
                        disabled={isBinaryExt}
                        onChange={onToggleToolsPayload}
                        onClick={e => e.stopPropagation()}
                        sx={{mr: 0.5}}
                    />
                </span>
            </Tooltip>
            {isBinaryExt && (
                <Lock style={{fontSize: 12, marginRight: 4, opacity: 0.5}} />
            )}
            <span style={{marginRight: 4}}>{file.name}</span>
            <Xmark
                style={{fontSize: 16, cursor: 'pointer'}}
                onClick={e => {
                    e.stopPropagation();
                    onRemove();
                }}
            />
        </Box>
    );
}

/** An attached file shown: an image, a CSV as a table, Markdown rendered, other text read-only, a binary file not at all. */
export function FilePreview ({file}: {file: FileData}) {
    const ext = fileExtension(file.name);

    if (BINARY_FILE_EXTENSIONS.has(ext)) {
        return (
            <Box sx={{flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2, color: 'text.secondary', fontStyle: 'italic'}}>
                No preview available
            </Box>
        );
    }

    if (IMAGE_FILE_EXTENSIONS.has(ext)) {
        return (
            <img
                src={extractFromMarkdown(file.content, EXTRACTION_TYPE.IMAGE)[0]}
                alt={file.name}
            />
        );
    }

    const text = fileText(file.content);
    const rendered = ext === "csv" ? csvToMarkdownTable(text ?? "") : ext === "md" ? text : null;

    if (rendered) return <MarkdownRenderer content={rendered} disableLoadingDelay />;

    return (
        <CodeEditor
            mode={getEditorMode(file.name)}
            value={text}
            showLineNumbers={true}
            readOnly={true}
        />
    );
}
