/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {CodeEditor, getEditorMode} from '../../../../CodeEditor';
import {Box, IconButton, Tabs, Tab} from '@mui/material';
import {Attachment, Xmark} from 'iconoir-react';
import './style.scss';
import {useRef, useEffect, useState} from 'react';
import {FileData, FilesDataSource} from '../../types/workflow';
import {extractFromMarkdown, EXTRACTION_TYPE, fileExtensionToCodeBlockLang} from '../../../../MarkdownRenderer';
import {IMAGE_EXTENSIONS, TRIPLE_BACKTICK} from '../../constants';


type FilesInputProps = {
    value?: FilesDataSource["value"];
    onChange: (value: FilesDataSource["value"]) => void;
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

                if (IMAGE_EXTENSIONS.includes(ext || "")) {
                    reader.onload = (e) => {
                        const base64 = (e.target?.result as string).split(',')[1];
                        const mime = file.type || `image/${ext}`;
                        const markdown = `![${file.name}](data:${mime};base64,${base64})`;
                        const fileData: FileData = {
                            name: file.name,
                            content: markdown,
                        };

                        setAttachedFiles((prevFiles) => [...prevFiles, fileData]);
                    };
                    reader.readAsDataURL(file);
                } else {
                    reader.onload = (e) => {
                        const fileContent = e.target?.result as string;
                        const lang = fileExtensionToCodeBlockLang(ext);
                        const markdown = `${TRIPLE_BACKTICK}${lang}\n${fileContent}\n${TRIPLE_BACKTICK}`;
                        const fileData: FileData = {
                            name: file.name,
                            content: markdown,
                        };

                        setAttachedFiles((prevFiles) => [...prevFiles, fileData]);
                    };
                    reader.readAsText(file);
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
                        sx={{minHeight: 32}}
                        variant="scrollable"
                        scrollButtons="auto"
                    >
                        <Tab label="User Input" />
                        {attachedFiles.map((file, idx) => (
                            <Tab
                                key={file.name + idx}
                                label={
                                    <Box sx={{display: 'flex', alignItems: 'center'}}>
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
                        ))}
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
                    // eslint-disable-next-line max-len
                    accept=".txt,.md,.html,.css,.scss,.js,.ts,.tsx,.json,.xml,.csv,.yaml,.yml,.ini,.log,.sh,.sql,.py,.java,.c,.cpp,.h,.bat,.env,.png,.jpg,.jpeg,.gif,.bmp,.webp,.svg"
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
                attachedFiles[tab - 1] && (
                    IMAGE_EXTENSIONS.includes(
                        attachedFiles[tab - 1].name.split('.').pop()?.toLowerCase() || ""
                    ) ? (
                            <img
                                src={extractFromMarkdown(attachedFiles[tab - 1].content, EXTRACTION_TYPE.IMAGE)[0]}
                                alt={attachedFiles[tab - 1].name}
                            />
                        ) : (
                            <CodeEditor
                                mode={getEditorMode(attachedFiles[tab - 1].name)}
                                value={extractFromMarkdown(attachedFiles[tab - 1].content, EXTRACTION_TYPE.CODE_BLOCK)[0]}
                                showLineNumbers={true}
                                readOnly={true}
                            />
                        )
                )
            )}
        </Box>
    );
};