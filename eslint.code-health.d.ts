/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import type {Linter} from "eslint";


export declare const LIMITS: {
    complexity: number;
    cognitiveComplexity: number;
    depth: number;
    params: number;
    nestedCallbacks: number;
    expressionOperators: number;
    functionLines: number;
    componentLines: number;
    fileLines: number;
};

export declare const codeHealthConfig: Linter.Config[];
