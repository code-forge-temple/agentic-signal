/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {GraphUp} from "iconoir-react";


export const Icon = <GraphUp />;

export const NODE_TYPE = "chart";

export const ERROR_PREFIX = `
This Chart Data Node only supports the following input formats of JSON objects:
1. Chart.js format: \`{title: "", labels:[], datasets:[{label, data, borderColor, backgroundColor, tension}]}\`
2. Simple format: \`{title: "", labels:[], data:[]}\`
3. Array of points format: \`[{x,y},...]\`
4. Array of numbers format: \`[1,2,3,...]\`
---
`;
