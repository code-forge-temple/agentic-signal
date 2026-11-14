/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {CodeEditor} from '../../../../CodeEditor';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import {Attachment} from 'iconoir-react';
import './FilesInput.scss';
import {useRef, useState} from 'react';
import {FileData, MarkdownAndFilesDataSource} from '../../types/workflow';
import {SUPPORTED_FILE_EXTENSIONS} from '@shared/constants';
import {arrayBufferToBase64} from '@shared/utils';
import {fileDataFromBytes} from '../../utils';
import {useDebouncedReport, useWheelScrollsTabs} from './hooks';
import {tabAfterRemoval} from './utils';
import {FilePreview, FileTabLabel} from './parts';


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

    useDebouncedReport(userInput, attachedFiles, onChange);
    useWheelScrollsTabs(tabsRef);

    const toggleIsToolsPayload = (idx: number) => {
        setAttachedFiles(prev =>
            prev.map((f, i) => i === idx ? {...f, isToolsPayload: !f.isToolsPayload} : f)
        );
    };

    const removeFile = (idx: number) => {
        setTab(tabAfterRemoval(tab, idx));
        setAttachedFiles(prev => prev.filter((_, i) => i !== idx));
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;

        if (!files) return;

        if (files.length > 0) {
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const reader = new FileReader();

                // Every file as bytes, so base64 is always there whatever the tools-only toggle says; the
                // stored form comes from the converter Workflow Input uses for files sent from outside.
                reader.onload = (e) => {
                    const base64 = arrayBufferToBase64(e.target?.result as ArrayBuffer);
                    const fileData = fileDataFromBytes({name: file.name, base64, mimeType: file.type || undefined});

                    setAttachedFiles((prevFiles) => [...prevFiles, fileData]);
                };
                reader.readAsArrayBuffer(file);
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
                        {attachedFiles.map((file, idx) => (
                            <Tab
                                key={file.name + idx}
                                label={<FileTabLabel file={file} onToggleToolsPayload={() => toggleIsToolsPayload(idx)} onRemove={() => removeFile(idx)} />}
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
                attachedFiles[tab - 1] && <FilePreview file={attachedFiles[tab - 1]} />
            )}
        </Box>
    );

};