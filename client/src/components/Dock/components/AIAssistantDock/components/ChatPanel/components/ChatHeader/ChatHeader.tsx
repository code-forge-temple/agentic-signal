/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import IconButton from '@mui/material/IconButton';
import CircularProgress from '@mui/material/CircularProgress';
import Tooltip from '@mui/material/Tooltip';
import {Xmark, Minus, Plus, Settings, WarningTriangle} from 'iconoir-react';
import './ChatHeader.scss';
import {AI_ASSISTANT_TITLE} from '../../../../constants';
import {isCloudModel} from '../../../../utils/modelContext';


// eslint-disable-next-line max-len
const CLOUD_MODEL_WARNING = "Cloud model: your messages, and any workflow or files you add to them, are sent to Ollama's servers to be processed, not kept on this machine. Agentic Signal can't guarantee how that data is stored or used there.";


type ChatHeaderProps = {
    selectedModel: string;
    onModelChange: (model: string) => void;
    models: string[];
    isFetchingModels: boolean;
    /** A reply or command is running: the model can't be switched until it ends. */
    isModelLocked: boolean;
    /** Why the selected model's context window is too small for the AI Buddy, if it is. */
    contextWarning: string | null;
    onClose: () => void;
    onMinimize: () => void;
    isMinimized: boolean;
    onDragHandleMouseDown: (e: React.MouseEvent) => void;
    /*
     * The settings dialog is deliberately owned by ChatPanel and rendered outside the draggable
     * panel: React events bubble through the React tree rather than the DOM, so a dialog opened
     * from here but rendered here too would still hand its mousedowns to the panel's drag
     * handler and drag the whole chat box along with it.
     */
    onOpenSettings: () => void;
};

export const ChatHeader = ({
    selectedModel,
    onModelChange,
    models,
    isFetchingModels,
    isModelLocked,
    onClose,
    onMinimize,
    isMinimized,
    onDragHandleMouseDown,
    onOpenSettings,
    contextWarning
}: ChatHeaderProps) => {
    // One warning sign for whatever applies: the data leaving the machine, a window too small, or both.
    const warnings = [isCloudModel(selectedModel) ? CLOUD_MODEL_WARNING : null, contextWarning].filter((warning): warning is string => !!warning);

    return (
        <div className="chat-header" onMouseDown={onDragHandleMouseDown}>
            <span className="chat-header-title">{AI_ASSISTANT_TITLE}</span>
            <div className="chat-header-center">
                <Tooltip title={selectedModel ? `Settings for ${selectedModel}` : 'Select a model to configure it'}>
                    <span>
                        <IconButton
                            onClick={onOpenSettings}
                            size="small"
                            aria-label="Model settings"
                            className="llm-settings-btn"
                            disabled={!selectedModel}
                            onMouseDown={(e) => e.stopPropagation()}
                        >
                            <Settings />
                        </IconButton>
                    </span>
                </Tooltip>
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
                                disabled={models.length === 0 || isModelLocked}
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
                <div className="cloud-model-slot">
                    {warnings.length > 0 && (
                        <Tooltip title={<>{warnings.map(warning => <p key={warning} className="model-warning-line">{warning}</p>)}</>}>
                            <span className="cloud-model-warning" role="img" aria-label={warnings.join(" ")} tabIndex={0}>
                                <WarningTriangle />
                            </span>
                        </Tooltip>
                    )}
                </div>
            </div>
            <div className="chat-header-actions">
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
        </div>
    );
};
