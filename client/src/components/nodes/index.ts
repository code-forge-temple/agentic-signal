/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {GetDataNode} from './GetDataNode';
import {TaskNodeTitles, TaskNodeType} from '../../constants';
import type {Edge, NodeTypes} from '@xyflow/react';
import {AppNode} from '../../types/workflow';
import {LLMProcessNode} from './LLMProcessNode/LLMProcessNode';
import {ChartNode} from './ChartNode/ChartNode';
import {JsonReformatterNode} from './JsonReformatterNode';
import {DataFlowSpyNode} from './DataFlowSpyNode';
import type {ComponentType} from 'react';
import type {NodeProps} from '@xyflow/react';
import {DataSourceNode} from './DataSourceNode';
import {HttpNode} from './HttpNode';
import {ToolNode} from './ToolNode';
import {DataValidationNode} from './DataValidationNode';
import {TimerNode} from './TimerNode/TimerNode';


// Node type registry
export const nodeTypes: NodeTypes = {
    [TaskNodeType.GET_DATA]: GetDataNode as ComponentType<NodeProps>,
    [TaskNodeType.HTTP_DATA]: HttpNode as ComponentType<NodeProps>,
    [TaskNodeType.LLM_PROCESS]: LLMProcessNode as ComponentType<NodeProps>,
    [TaskNodeType.CHART]: ChartNode as ComponentType<NodeProps>,
    [TaskNodeType.DATA_SOURCE]: DataSourceNode as ComponentType<NodeProps>,
    [TaskNodeType.JSON_REFORMATTER]: JsonReformatterNode as ComponentType<NodeProps>,
    [TaskNodeType.DATA_FLOW_SPY]: DataFlowSpyNode as ComponentType<NodeProps>,
    [TaskNodeType.AI_TOOL]: ToolNode as ComponentType<NodeProps>,
    [TaskNodeType.DATA_VALIDATION]: DataValidationNode as ComponentType<NodeProps>,
    [TaskNodeType.TIMER]: TimerNode as ComponentType<NodeProps>,
};


export const nodeFactory = (nodeType: TaskNodeType, id: string, position: { x: number; y: number }): AppNode => {
    let newNode: AppNode | undefined;

    switch (nodeType) {
        case TaskNodeType.GET_DATA:
            newNode = {
                id,
                type: nodeType,
                position,
                data: {
                    title: TaskNodeTitles[TaskNodeType.GET_DATA],
                    url: '',
                    dataType: 'json',
                },
            };
            break;
        case TaskNodeType.HTTP_DATA:
            newNode = {
                id,
                type: nodeType,
                position,
                data: {
                    title: TaskNodeTitles[TaskNodeType.HTTP_DATA],
                    url: '',
                },
            };
            break;
        case TaskNodeType.DATA_SOURCE:
            newNode = {
                id,
                type: nodeType,
                position,
                data: {
                    title: TaskNodeTitles[TaskNodeType.DATA_SOURCE],
                    dataSource: {
                        value: '',
                        type: 'text'
                    }
                },
            };
            break;
        case TaskNodeType.LLM_PROCESS:
            newNode = {
                id,
                type: nodeType,
                position,
                data: {
                    title: TaskNodeTitles[TaskNodeType.LLM_PROCESS],
                    prompt: '',
                    model: '',
                    maxFeedbackLoops: 0,
                },
            };
            break;
        case TaskNodeType.JSON_REFORMATTER:
            newNode = {
                id,
                type: nodeType,
                position,
                data: {
                    title: TaskNodeTitles[TaskNodeType.JSON_REFORMATTER],
                    jsonataExpression: '',
                },
            };
            break;
        case TaskNodeType.DATA_VALIDATION:
            newNode = {
                id,
                type: nodeType,
                position,
                data: {
                    title: TaskNodeTitles[TaskNodeType.DATA_VALIDATION],
                    schema: '',
                },
            };
            break;
        case TaskNodeType.CHART:
            newNode = {
                id,
                type: nodeType,
                position,
                data: {
                    title: TaskNodeTitles[TaskNodeType.CHART],
                },
            };
            break;
        case TaskNodeType.DATA_FLOW_SPY:
            newNode = {
                id,
                type: nodeType,
                position,
                data: {
                    title: TaskNodeTitles[TaskNodeType.DATA_FLOW_SPY],
                },
            };
            break;
        case TaskNodeType.AI_TOOL:
            newNode = {
                id,
                type: nodeType,
                position,
                data: {
                    title: TaskNodeTitles[TaskNodeType.AI_TOOL],
                    toolSubtype: "",
                    toolSchema: {} as any,
                    userConfig: {},
                    handler: undefined
                }
            };
            break;
        case TaskNodeType.TIMER:
            newNode = {
                id,
                type: nodeType,
                position,
                data: {
                    title: TaskNodeTitles[TaskNodeType.TIMER],
                    interval: 0,
                    immediate: false
                }
            };
            break;
        default:
            throw new Error(`Unsupported node type: ${nodeType}`);
    }

    if (!newNode) {
        throw new Error(`Failed to create node of type: ${nodeType}`);
    }

    return newNode;
};


export const initialNodes: AppNode[] = [];

export const initialEdges: Edge[] = [];