/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {ActionsDock} from "./components/ActionsDock";
import {NodesDock} from "./components/NodesDock";
import {AIAssistantDock} from "./components/AIAssistantDock";
import './Dock.scss';

type DockProps = {
    onSave: () => void;
    onClear: () => void;
    onLoad: (event: React.ChangeEvent<HTMLInputElement>) => void;
    onLoadWorkflow: (json: string, onError?: (error: string) => void) => void;
    getWorkflowJson: () => string;
};

export const Dock = ({onSave, onLoad, onClear, onLoadWorkflow, getWorkflowJson}: DockProps) => {
    return (
        <>
            <div className="dock">
                <AIAssistantDock onLoadWorkflow={onLoadWorkflow} getWorkflowJson={getWorkflowJson} />
                <ActionsDock onSave={onSave} onLoad={onLoad} onClear={onClear} />
                <NodesDock />
            </div>
        </>
    );
};
