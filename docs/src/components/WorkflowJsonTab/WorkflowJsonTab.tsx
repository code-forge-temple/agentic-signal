/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import React from 'react';
import {Download} from 'iconoir-react';
import CodeBlock from '@theme/CodeBlock';
import './style.css';

interface WorkflowJsonTabProps {
    downloadUrl: string;
    children: React.ReactNode;
}

export function WorkflowJsonTab ({downloadUrl, children}: WorkflowJsonTabProps) {
    return (
        <div className="workflow-json-tab">
            <div className="actions">
                <a
                    href={downloadUrl}
                    download
                    className="download-btn"
                    title="Download JSON"
                >
                    <Download width="20" height="20" />
                </a>
            </div>
            <CodeBlock language="json">
                {children}
            </CodeBlock>

        </div>
    );
}