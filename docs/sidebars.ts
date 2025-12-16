/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
    gettingStartedSidebar: [
        {
            type: 'category',
            label: 'Run as Windows App',
            items: [
                'getting-started/windows-app/quick-start',
            ],
        },
        {
            type: 'category',
            label: 'Run as Web App',
            items: [
                'getting-started/web-app/installation',
                'getting-started/web-app/quick-start',
            ],
        },
        'getting-started/configuration',
        'getting-started/google-oauth-client',
        'getting-started/reddit-oauth-client',
    ],

    nodesSidebar: [
        {
            type: 'category',
            label: 'Nodes Reference',
            items: [
                'nodes/overview',
                {
                    type: 'category',
                    label: 'Input Nodes',
                    items: [
                        'nodes/input/data-source',
                        'nodes/input/http-data',
                        'nodes/input/get-data',
                        'nodes/input/timer-node',
                    ],
                },
                {
                    type: 'category',
                    label: 'AI Processing Nodes',
                    items: [
                        'nodes/ai/llm-process',
                        {
                            type: 'category',
                            label: 'AI Tool Node',
                            items: [
                                'nodes/ai/ai-tool',
                                'nodes/ai/tools/fetch-weather-data',
                                'nodes/ai/tools/duckduckgo-search',
                                'nodes/ai/tools/brave-search',
                                'nodes/ai/tools/date-time-now',
                                'nodes/ai/tools/gmail-fetch-emails',
                                'nodes/ai/tools/gdrive-fetch-files',
                                'nodes/ai/tools/gcalendar-fetch-events',
                            ],
                        },
                    ],
                },
                {
                    type: 'category',
                    label: 'Data Processing Nodes',
                    items: [
                        'nodes/data/json-reformatter',
                        'nodes/data/data-validation',
                    ],
                },
                {
                    type: 'category',
                    label: 'Output Nodes',
                    items: [
                        'nodes/output/chart',
                        'nodes/output/data-flow-spy',
                        'nodes/output/reddit-post',
                    ],
                },
            ],
        },
    ],

    workflowsSidebar: [
        {
            type: 'category',
            label: 'Workflow Examples',
            items: [
                'workflows/overview',
                {
                    type: 'category',
                    label: 'Data Analysis',
                    items: [
                        'workflows/data/current-time',
                        'workflows/data/weather-dashboard',
                        'workflows/data/gdrive-listing',
                        'workflows/data/gcalendar-listing',
                        'workflows/data/timeseries-chart',
                        'workflows/data/product-data-validation-and-visualization',
                        'workflows/data/ai-data-processing-overseer',

                    ],
                },
                {
                    type: 'category',
                    label: 'Email Management',
                    items: [
                        'workflows/email/gmail-summarizer',
                    ],
                },
            ],
        },
    ],
};

// eslint-disable-next-line no-restricted-exports
export default sidebars;