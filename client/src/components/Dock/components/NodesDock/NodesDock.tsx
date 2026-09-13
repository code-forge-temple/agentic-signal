/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import React from 'react';
import './NodesDock.scss';
import {ThemeProvider, Tooltip} from '@mui/material';
import {NavArrowLeft, NavArrowRight} from 'iconoir-react';
import {darkTheme} from '../../../../utils';
import {useWholeItemScroller} from '../../../../hooks/useWholeItemScroller';
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
    const {viewportRef, canScrollLeft, canScrollRight, isScrollable, scrollByPage} = useWholeItemScroller<HTMLDivElement>();

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
                {isScrollable && (
                    <button
                        type="button"
                        className="nodes-dock-pager"
                        aria-label="Show previous nodes"
                        disabled={!canScrollLeft}
                        onClick={() => scrollByPage(-1)}
                    >
                        <NavArrowLeft />
                    </button>
                )}
                <div className="dock-items-viewport" ref={viewportRef}>
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
                {isScrollable && (
                    <button
                        type="button"
                        className="nodes-dock-pager"
                        aria-label="Show next nodes"
                        disabled={!canScrollRight}
                        onClick={() => scrollByPage(1)}
                    >
                        <NavArrowRight />
                    </button>
                )}
            </div>
        </ThemeProvider>
    );
}