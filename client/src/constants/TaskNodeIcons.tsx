/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {CodeBrackets, Database, DataTransferDown, Eye, GraphUp, ScanBarcode, Www} from "iconoir-react";
import AiIcon from '../assets/ai.svg';
import AiTools from '../assets/ai-tools.svg';
import {TaskNodeType} from "./constants";

export const TaskNodeIcons: Record<TaskNodeType, React.ReactElement<{className?: string}>> = {
    [TaskNodeType.GET_DATA]: <DataTransferDown />,
    [TaskNodeType.HTTP_DATA]: <Www />,
    [TaskNodeType.LLM_PROCESS]: <AiIcon />,
    [TaskNodeType.CHART]: <GraphUp />,
    [TaskNodeType.DATA_SOURCE]: <Database />,
    [TaskNodeType.JSON_REFORMATTER]: <CodeBrackets />,
    [TaskNodeType.DATA_FLOW_SPY]: <Eye />,
    [TaskNodeType.AI_TOOL]: <AiTools />,
    [TaskNodeType.DATA_VALIDATION]: <ScanBarcode />
};