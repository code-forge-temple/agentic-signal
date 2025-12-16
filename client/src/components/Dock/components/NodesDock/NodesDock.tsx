/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import React from 'react';
import './NodesDock.scss';
import {ThemeProvider, Tooltip} from '@mui/material';
import {darkTheme} from '../../../../utils';
import {nodeRegistry} from '../../../nodes/nodeRegistry.gen';
import {AppNodeType} from '../../../nodes/workflow.gen';


type NodeConfig = {
    type: AppNodeType;
    label: string;
    icon: React.ReactElement<{className?: string}>;
};

const nodeConfigs: NodeConfig[] = nodeRegistry.map((desc) => ({
    type: desc.type,
    label: desc.title,
    icon: desc.icon,
}));

export function NodesDock () {
    const onDragStart = (event: React.DragEvent, nodeType: AppNodeType) => {
        event.dataTransfer.setData('application/reactflow', nodeType);
        event.dataTransfer.effectAllowed = 'move';
    };

    const onDragEnd = (event: React.DragEvent) => {
        event.currentTarget.classList.remove('dragging');
    };

    const onDragStartVisual = (event: React.DragEvent) => {
        event.currentTarget.classList.add('dragging');
    };

    return (
        <ThemeProvider theme={darkTheme}>
            <div className="nodes-dock">
                <div className="dock-items">
                    {nodeConfigs.map((config) => (
                        <Tooltip
                            key={config.type}
                            title={config.label}
                            placement="bottom"
                            arrow
                        >
                            <div
                                className="dock-item"
                                draggable
                                onDragStart={(event) => {
                                    onDragStart(event, config.type);
                                    onDragStartVisual(event);
                                }}
                                onDragEnd={onDragEnd}
                            >
                                <div className="dock-item-icon-wrapper">
                                    {React.cloneElement(config.icon, {
                                        className: `${config.icon.props.className ?? ""} dock-item-icon`.trim()
                                    })}
                                </div>
                            </div>
                        </Tooltip>
                    ))}
                </div>
            </div>
        </ThemeProvider>
    );
}