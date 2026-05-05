/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {Select, MenuItem, FormControl, InputLabel, IconButton, CircularProgress} from '@mui/material';
import {Xmark, Minus, Plus} from 'iconoir-react';
import './ChatHeader.scss';
import {AI_ASSISTANT_TITLE} from '../../../../constants';


type ChatHeaderProps = {
    selectedModel: string;
    onModelChange: (model: string) => void;
    models: string[];
    isFetchingModels: boolean;
    onClose: () => void;
    onMinimize: () => void;
    isMinimized: boolean;
    onDragHandleMouseDown: (e: React.MouseEvent) => void;
};

export const ChatHeader = ({selectedModel, onModelChange, models, isFetchingModels, onClose, onMinimize, isMinimized, onDragHandleMouseDown}: ChatHeaderProps) => {
    return (
        <div className="chat-header" onMouseDown={onDragHandleMouseDown}>
            <span className="chat-header-title">{AI_ASSISTANT_TITLE}</span>
            <div className="model-select-wrapper">
                {isFetchingModels ? (
                    <CircularProgress size={18} className="chat-header-loading" />
                ) : (
                    <FormControl size="small" className="model-select" onMouseDown={(e) => e.stopPropagation()}>
                        <InputLabel>Model</InputLabel>
                        <Select
                            value={models.includes(selectedModel) ? selectedModel : ''}
                            label="Model"
                            onChange={(e) => onModelChange(e.target.value)}
                            disabled={models.length === 0}
                        >
                            {models.length === 0 && (
                                <MenuItem value="" disabled>No models available</MenuItem>
                            )}
                            {models.map(m => (
                                <MenuItem key={m} value={m}>{m}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                )}
            </div>
            <IconButton
                onClick={onMinimize}
                size="small"
                aria-label={isMinimized ? `Expand ${AI_ASSISTANT_TITLE}` : `Minimize ${AI_ASSISTANT_TITLE}`}
                className="minimize-btn"
                onMouseDown={(e) => e.stopPropagation()}
            >
                {isMinimized ? <Plus /> : <Minus />}
            </IconButton>
            <IconButton
                onClick={onClose}
                size="small"
                aria-label={`Close ${AI_ASSISTANT_TITLE}`}
                className="close-btn"
                onMouseDown={(e) => e.stopPropagation()}
            >
                <Xmark />
            </IconButton>
        </div>
    );
};
