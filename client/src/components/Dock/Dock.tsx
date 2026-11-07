/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {forwardRef} from 'react';
import {ActionsDock} from "./components/ActionsDock";
import {NodesDock} from "./components/NodesDock";
import {AIAssistantDock} from "./components/AIAssistantDock";
import './Dock.scss';

type DockProps = {
    /** The active layer is the AI layer: nodes can't be added, and Clear and Load are off (Save stays on). */
    readOnly: boolean;
    onSave: () => void;
    onSaveToFolder: () => void;
    onClear: () => void;
    onLoad: (event: React.ChangeEvent<HTMLInputElement>) => void;
    onLoadWorkflow: (json: string, onError?: (error: string) => void) => void;
    /** A workflow file the desktop app's own dialog picked. */
    onLoadWorkflowFile: (json: string, fileName: string) => void;
    getWorkflowJson: () => string;
};

export const Dock = forwardRef<HTMLDivElement, DockProps>(({readOnly, onSave, onSaveToFolder, onLoad, onClear, onLoadWorkflow, onLoadWorkflowFile, getWorkflowJson}, ref) => {
    return (
        <>
            <div className="dock" ref={ref}>
                <AIAssistantDock onLoadWorkflow={onLoadWorkflow} getWorkflowJson={getWorkflowJson} />
                <ActionsDock
                    readOnly={readOnly}
                    onSave={onSave}
                    onSaveToFolder={onSaveToFolder}
                    onLoad={onLoad}
                    onLoadWorkflow={onLoadWorkflowFile}
                    onClear={onClear}
                />
                <NodesDock readOnly={readOnly} />
            </div>
        </>
    );
});

Dock.displayName = 'Dock';
