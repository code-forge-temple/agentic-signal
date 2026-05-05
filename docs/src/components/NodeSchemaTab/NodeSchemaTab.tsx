/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import React from 'react';
import CodeBlock from '@theme/CodeBlock';
import allSchemas from '../../data/nodeSchemas.gen.json';

interface Props {
    nodeType: string;
}

export function NodeSchemaTab ({nodeType}: Props) {
    const schema = (allSchemas as Record<string, unknown>)[nodeType];

    if (!schema) {
        return <p><em>No configuration schema available for this node.</em></p>;
    }

    return (
        <>
            <p>
                This is the full JSON Schema for the node&apos;s <code>data</code> configuration object,
                generated from the Zod schema used to validate the node at runtime.
            </p>
            <CodeBlock language="json">
                {JSON.stringify(schema, null, 2)}
            </CodeBlock>
        </>
    );
}
