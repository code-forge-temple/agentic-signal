/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

// Code health limits: complexity, nesting and size. eslint.config.js makes them errors for new code (today's
// violations are recorded in eslint-suppressions.json); scripts/code-health.ts scores each file from the same rules.
import sonarjs from 'eslint-plugin-sonarjs';


export const LIMITS = {
    complexity: 10,
    cognitiveComplexity: 15,
    depth: 4,
    params: 4,
    nestedCallbacks: 3,
    expressionOperators: 3,
    functionLines: 70,
    componentLines: 150,
    fileLines: 400,
};

const lines = (max) => ({max, skipBlankLines: true, skipComments: true});

export const codeHealthConfig = [
    {
        files: ['**/*.{ts,tsx}'],
        plugins: {sonarjs},
        rules: {
            'complexity': ['error', LIMITS.complexity],
            'sonarjs/cognitive-complexity': ['error', LIMITS.cognitiveComplexity],
            'max-depth': ['error', LIMITS.depth],
            'max-params': ['error', LIMITS.params],
            'max-nested-callbacks': ['error', LIMITS.nestedCallbacks],
            'sonarjs/expression-complexity': ['error', {max: LIMITS.expressionOperators}],
            'max-lines-per-function': ['error', lines(LIMITS.functionLines)],
            'max-lines': ['error', lines(LIMITS.fileLines)],
            'sonarjs/no-identical-functions': 'error',
            'sonarjs/no-duplicated-branches': 'error',
        },
    },
    {
        // A component's JSX counts as lines.
        files: ['**/*.tsx'],
        rules: {'max-lines-per-function': ['error', lines(LIMITS.componentLines)]},
    },
    {
        // Nested describe/it blocks and long test bodies are normal in tests.
        files: ['**/*.test.{ts,tsx}'],
        rules: {'max-depth': 'off', 'max-nested-callbacks': 'off', 'max-lines-per-function': 'off', 'max-lines': 'off'},
    },
];
