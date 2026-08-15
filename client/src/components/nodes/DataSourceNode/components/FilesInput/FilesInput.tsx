/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {CodeEditor, getEditorMode} from '../../../../CodeEditor';
import {Box, IconButton, Switch, Tabs, Tab, Tooltip} from '@mui/material';
import {Attachment, Lock, Xmark} from 'iconoir-react';
import './FilesInput.scss';
import {useRef, useEffect, useState} from 'react';
import {FileData, MarkdownAndFilesDataSource} from '../../types/workflow';
import {extractFromMarkdown, EXTRACTION_TYPE} from '@shared/utils';
import {fileExtensionToCodeBlockLang} from "@shared/utils";
import {BINARY_FILE_EXTENSIONS, IMAGE_FILE_EXTENSIONS, SUPPORTED_FILE_EXTENSIONS, TRIPLE_BACKTICK} from '@shared/constants';
import {arrayBufferToBase64} from '@shared/utils';


type FilesInputProps = {
    value?: MarkdownAndFilesDataSource["value"];
    onChange: (value: MarkdownAndFilesDataSource["value"]) => void;
};

export const FilesInput = ({value, onChange}: FilesInputProps) => {
    const [userInput, setUserInput] = useState(value?.text || '');
    const [tab, setTab] = useState(0);
    const tabsRef = useRef<HTMLDivElement>(null);
    const [attachedFiles, setAttachedFiles] = useState<FileData[]>(value?.files || []);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const debouncedTimeoutRef = useRef<number | null>(null);

    useEffect(() => {
        if (debouncedTimeoutRef.current) {
            clearTimeout(debouncedTimeoutRef.current);
        }

        debouncedTimeoutRef.current = window.setTimeout(() => {
            onChange({
                text: userInput,
                files: attachedFiles
            });
        }, 300);

        return () => {
            if (debouncedTimeoutRef.current) {
                clearTimeout(debouncedTimeoutRef.current);
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userInput, attachedFiles]);

    useEffect(() => {
        const tabsNode = tabsRef.current;

        if (!tabsNode) return;

        const scroller = tabsNode.querySelector('.MuiTabs-scroller') as HTMLDivElement | null;

        if (!scroller) return;

        const onWheel = (e: WheelEvent) => {
            if (e.deltaY !== 0) {
                e.preventDefault();

                scroller.scrollLeft += e.deltaY;
            }
        };

        scroller.addEventListener('wheel', onWheel, {passive: false});

        return () => scroller.removeEventListener('wheel', onWheel);
    }, []);

    const toggleIsToolsPayload = (idx: number) => {
        setAttachedFiles(prev =>
            prev.map((f, i) => i === idx ? {...f, isToolsPayload: !f.isToolsPayload} : f)
        );
    };

    const removeFile = (idx: number) => {
        setAttachedFiles(prev => {
            const newFiles = prev.filter((_, i) => i !== idx);

            if (tab > 0 && tab - 1 === idx) {
                setTab(0);
            } else if (tab > 0 && tab - 1 > idx) {
                setTab(tab - 1);
            }

            return newFiles;
        });
    };
    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;

        if (!files) return;

        if (files.length > 0) {
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const ext = file.name.split('.').pop()?.toLowerCase();
                const reader = new FileReader();

                if (IMAGE_FILE_EXTENSIONS.has(ext || "")) {
                    reader.onload = (e) => {
                        const dataUrl = e.target?.result as string;
                        const base64 = dataUrl.split(',')[1];
                        const mime = file.type || `image/${ext}`;
                        const fileData: FileData = {
                            name: file.name,
                            content: `![${file.name}](${dataUrl})`,
                            base64,
                            mimeType: mime,
                            isToolsPayload: false,
                        };

                        setAttachedFiles((prevFiles) => [...prevFiles, fileData]);
                    };
                    reader.readAsDataURL(file);
                } else {
                    // Both binary and text files: read as ArrayBuffer so base64 is always
                    // available regardless of the isToolsPayload toggle state.
                    const isBinaryExt = BINARY_FILE_EXTENSIONS.has(ext || "");

                    reader.onload = (e) => {
                        const buffer = e.target?.result as ArrayBuffer;
                        const base64 = arrayBufferToBase64(buffer);

                        let content: string;

                        if (isBinaryExt) {
                            content = `[Binary attachment: ${file.name}]`;
                        } else {
                            const text = new TextDecoder('utf-8').decode(buffer);
                            const lang = fileExtensionToCodeBlockLang(ext);

                            content = `${TRIPLE_BACKTICK}${lang}\n${text}\n${TRIPLE_BACKTICK}`;
                        }

                        const fileData: FileData = {
                            name: file.name,
                            content,
                            base64,
                            mimeType: file.type || (isBinaryExt ? 'application/octet-stream' : 'text/plain'),
                            isToolsPayload: isBinaryExt,
                        };

                        setAttachedFiles((prevFiles) => [...prevFiles, fileData]);
                    };
                    reader.readAsArrayBuffer(file);
                }
            }

            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
        }
    };

    return (
        <Box className="files-input-container">
            <Box sx={{display: 'flex', alignItems: 'center', mb: 1}}>
                <div ref={tabsRef} style={{overflow: 'auto', flex: 1}}>
                    <Tabs
                        value={tab}
                        onChange={(_e, v) => setTab(v)}
                        sx={{minHeight: 32, height: '100%'}}
                        variant="scrollable"
                        scrollButtons="auto"
                    >
                        <Tab label="User Input" />
                        {attachedFiles.map((file, idx) => {
                            const fileExt = file.name.split('.').pop()?.toLowerCase() || "";
                            const isBinaryExt = BINARY_FILE_EXTENSIONS.has(fileExt);
                            const isToolsPayload = file.isToolsPayload ?? isBinaryExt;

                            return (
                                <Tab
                                    key={file.name + idx}
                                    label={
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
                                                        onChange={() => toggleIsToolsPayload(idx)}
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
                                                    removeFile(idx);
                                                }}
                                            />
                                        </Box>
                                    }
                                />
                            );
                        })}
                    </Tabs>
                </div>
                <IconButton sx={{ml: 1}} size="small" onClick={()=> {
                    fileInputRef.current?.click();
                }}>
                    <Attachment />
                </IconButton>
                <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept={Array.from(SUPPORTED_FILE_EXTENSIONS).map(ext => `.${ext}`).join(',')}
                    style={{display: "none"}}
                    onChange={handleFileChange}
                />
            </Box>
            {/* Tab 0: User Input, Tabs 1+: Attached Files */}
            {tab === 0 ? (
                <CodeEditor
                    mode={"markdown"}
                    value={userInput}
                    onChange={setUserInput}
                    showLineNumbers={true}
                />
            ) : (
                attachedFiles[tab - 1] && (() => {
                    const file = attachedFiles[tab - 1];
                    const ext = file.name.split('.').pop()?.toLowerCase() || "";
                    const isBinaryExt = BINARY_FILE_EXTENSIONS.has(ext);
                    const isToolsPayload = file.isToolsPayload ?? isBinaryExt;

                    if (isToolsPayload) {
                        return (
                            <Box sx={{p: 2, color: 'text.secondary', fontStyle: 'italic'}}>
                                {isBinaryExt
                                    ? "Binary file — passed to tools only (bypasses LLM context)."
                                    : "Bypass mode — passed to tools only (bypasses LLM context)."}
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

                    return (
                        <CodeEditor
                            mode={getEditorMode(file.name)}
                            value={extractFromMarkdown(file.content, EXTRACTION_TYPE.CODE_BLOCK)[0]}
                            showLineNumbers={true}
                            readOnly={true}
                        />
                    );
                })()
            )}
        </Box>
    );
};