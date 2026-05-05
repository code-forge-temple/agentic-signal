/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

/* eslint-disable max-len */

import {zodToJsonSchema} from 'zod-to-json-schema';
import {nodeRegistry} from '../components/nodes/nodeRegistry.gen';
import {toolRegistry} from '../components/nodes/ToolNode/tools/toolRegistry.gen';
import {TRIPLE_BACKTICK} from '@shared/constants';
import {AI_ASSISTANT_KEYWORDS, NODE_PORT_IDS} from '../constants/constants';


const WORKFLOW_FORMAT = `
## Workflow JSON format

A workflow is a JSON object with two arrays:

${TRIPLE_BACKTICK}json
{
    "nodes": [
        {
            "id": "<unique string>",
            "type": "<nodeType>",
            "position": { "x": <number>, "y": <number> },
            "data": { "title": "<label>", ...nodeConfig }
        }
    ],
    "edges": [
        {
            "id": "<unique string>",
            "source": "<sourceNodeId>",
            "target": "<targetNodeId>",
            "sourceHandle": "<sourceHandle>",
            "targetHandle": "<targetHandle>",
            // For edges from TimerNode (type: "timer") to compatible nodes, you MUST use:
            //   "sourceHandle": "trigger"
            //   "targetHandle": "trigger"
            // For edges from ToolNode (type: "ai-tool") to LLM Process node (type: "llm-process"), you MUST use:
            //   "sourceHandle": "tool"
            //   "targetHandle": "tool"
            // For edges from RagNode (type: "rag") to LLM Process node (type: "llm-process"), you MUST use:
            //   "sourceHandle": "context"
            //   "targetHandle": "context"
            // For edges connecting standard workflow nodes, you MUST use:
            //   "sourceHandle": "flow"
            //   "targetHandle": "flow"
        }
    ]
}
${TRIPLE_BACKTICK}

Rules:
- Every node must have a unique "id" (e.g. "node-1", "node-2").
- "type" must be one of the node types listed below.
- "position" spreads nodes out visually — use increments of ~250px on the x-axis.
- "data.title" is a user-friendly label for the node (can be any string).
- Edges connect nodes directionally: data flows from "source" to "target".
- Only connect ports that exist for each node (see "ports" per node type).
- Only async data aggregator nodes may receive multiple ${NODE_PORT_IDS.FLOW} inputs; all other nodes may have at most one incoming ${NODE_PORT_IDS.FLOW} edge.
- Edges MUST use \`"source"\` and \`"target"\` with string node IDs. NEVER use \`from\`/\`to\` or numeric indices.
- For edges from ToolNode (type: "ai-tool") to LLM Process node (type: "llm-process"), you MUST add \`"targetHandle": "${NODE_PORT_IDS.TOOL}"\` to the edge object.
- For edges from RagNode (type: "rag") to LLM Process node (type: "llm-process"), you MUST add \`"targetHandle": "${NODE_PORT_IDS.CONTEXT}"\` to the edge object.
`.trim();


function buildNodeTypeList (): string {
    return nodeRegistry.map(d => `- \`"${d.type}"\``).join('\n');
}

function renderPortSchema (title: string, schema: any, name: string): string[] {
    const jsonSchema = zodToJsonSchema(schema, {
        name,
        errorMessages: false,
        $refStrategy: 'none',
    }) as any;

    const resolved = jsonSchema.definitions?.[name] ?? jsonSchema;

    return [
        `\r\n**${title}:**`,
        `${TRIPLE_BACKTICK}json`,
        JSON.stringify(resolved, null, 4),
        `${TRIPLE_BACKTICK}`,
    ];
}

function buildNodeDocs (): string {
    return nodeRegistry.map((descriptor) => {
        const lines: string[] = [];

        lines.push(`### ${descriptor.title} (\`type: "${descriptor.type}"\`)`);
        lines.push(descriptor.metadata.description);

        const portList: string[] = [];
        const flowPort = descriptor.metadata.ports[NODE_PORT_IDS.FLOW];
        const hasTriggerPort = Boolean(descriptor.metadata.ports[NODE_PORT_IDS.TRIGGER]);
        const hasContextPort = Boolean(descriptor.metadata.ports[NODE_PORT_IDS.CONTEXT]);
        const hasToolPort = Boolean(descriptor.metadata.ports[NODE_PORT_IDS.TOOL]);

        if (hasTriggerPort) portList.push('trigger (trigger — no data input)');

        if (hasContextPort) portList.push('context (context — no data input)');

        if (hasToolPort) portList.push('tool (tool — no data input)');

        if (flowPort) portList.push('flow');

        if (portList.length) {
            lines.push(`\r\n**Ports:** ${portList.join(', ')}`);
        } else {
            lines.push('\r\n**Ports:** none (standalone / terminal node)');
        }

        if (flowPort?.inputSchema) {
            lines.push(...renderPortSchema('Input port schema', flowPort.inputSchema, `${descriptor.type}-input`));
        }

        if (flowPort?.outputSchema) {
            lines.push(...renderPortSchema('Output port schema', flowPort.outputSchema, `${descriptor.type}-output`));
        }

        if (descriptor.metadata.configSchema) {
            const jsonSchema = zodToJsonSchema(descriptor.metadata.configSchema, {
                name: descriptor.type,
                errorMessages: false,
                $refStrategy: 'none',
            }) as any;

            const configSchema = jsonSchema.definitions?.[descriptor.type] ?? jsonSchema;

            const hasConfigSchemaFields =
                (configSchema.properties && Object.keys(configSchema.properties).length > 0) ||
                ((configSchema.anyOf?.length ?? 0) + (configSchema.oneOf?.length ?? 0) + (configSchema.allOf?.length ?? 0) > 0);

            if (hasConfigSchemaFields) {
                lines.push('**Config fields (in `data`):**');
                lines.push(`${TRIPLE_BACKTICK}json`);
                lines.push(JSON.stringify(configSchema, null, 4));
                lines.push(`${TRIPLE_BACKTICK}`);
            } else {
                lines.push('**Config fields:** none — no additional configuration required.');
            }
        } else {
            lines.push('**Config fields:** see platform documentation.');
        }

        return lines.join('\n');
    }).join('\n\n---\n\n');
}

function buildToolDocs (): string {
    return toolRegistry.map((tool) => {
        const lines: string[] = [];

        lines.push(`### ${tool.title} (\`toolSubtype: "${tool.toolSubtype}"\`)`);
        lines.push(tool.toolSchema.description ?? tool.title);

        const userConfig = tool.userConfigSchema?.properties
            ? Object.entries(tool.userConfigSchema.properties)
                .filter(([key]) => key !== 'systemPrompt')
                .map(([key, def]: [string, any]) => {
                    const required = tool.userConfigSchema?.required?.includes(key) ? ' **(required)**' : ' (optional)';
                    const desc = def.description ? ` — ${def.description}` : '';

                    return `  - \`${key}\` (${def.type ?? 'any'})${required}${desc}`;
                })
            : [];

        if (userConfig.length) {
            lines.push('**userConfig fields:**');
            lines.push(userConfig.join('\n'));
        } else {
            lines.push('**userConfig fields:** none');
        }

        return lines.join('\n');
    }).join('\n\n---\n\n');
}

export function buildSystemPrompt (): string {
    const prompt = `You are a helpful AI Assistant.
⚠️ **STRICT RULE: ONLY generate a workflow JSON if and ONLY IF the user's message contains the special keyword \`${AI_ASSISTANT_KEYWORDS.PREPARE_WORKFLOW}\`.**

**If the keyword is NOT present, you MUST NOT generate a workflow. Respond in plain text only. This is MANDATORY.**

---

You are an AI assistant for the Agentic Signal workflow builder.

Your job is to help users design, explain, and generate workflows by composing available nodes.

${WORKFLOW_FORMAT}

---

## Available node types

Valid \`type\` values (use EXACTLY as shown, no capitalization changes, no variations):

${buildNodeTypeList()}

Detailed reference:

${buildNodeDocs()}

---

## Available tools (for ToolNode)

When using a ToolNode, set \`data.toolSubtype\` to one of the tool identifiers below.
Each tool may also require \`data.userConfig\` fields — include them when they are required.

> **Important:**
> - A ToolNode (\`type: "ai-tool"\`) always connects **to** an LLM Process node (\`type: "llm-process"\`). Tools are invoked by the LLM, so every \`ai-tool\` node must have an edge from the \`ai-tool\` node to an \`llm-process\` node. Whenever you add a tool node, you must also include an LLM Process node and connect them. For every edge from a ToolNode (\`type: "ai-tool"\`) to an LLM Process node (\`type: "llm-process"\`), you MUST set \`"sourceHandle": "${NODE_PORT_IDS.TOOL}"\` and \`"targetHandle": "${NODE_PORT_IDS.TOOL}"\` on the edge, in addition to \`source\` and \`target\`.
> - A RagNode (\`type: "rag"\`) always connects **to** an LLM Process node (\`type: "llm-process"\`). For every edge from a RagNode (\`type: "rag"\`) to an LLM Process node (\`type: "llm-process"\`), you MUST set \`"sourceHandle": "${NODE_PORT_IDS.CONTEXT}"\` and \`"targetHandle": "${NODE_PORT_IDS.CONTEXT}"\` on the edge, in addition to \`source\` and \`target\`.
> - A TimerNode (\`type: "timer"\`) always connects **to** compatible nodes via the \`trigger\` port. For every edge from a TimerNode (\`type: "timer"\`) to a compatible node, you MUST set \`"sourceHandle": "${NODE_PORT_IDS.TRIGGER}"\` and \`"targetHandle": "${NODE_PORT_IDS.TRIGGER}"\` on the edge, in addition to \`source\` and \`target\`.
> - The rest of the nodes connect via the standard \`flow\` ports, using \`"sourceHandle": "${NODE_PORT_IDS.FLOW}"\` and \`"targetHandle": "${NODE_PORT_IDS.FLOW}"\`.

${buildToolDocs()}

---

## Instructions

**MANDATORY WORKFLOW GENERATION RULE:**

- 🚨 **You MUST ONLY generate a workflow JSON when the user's message contains the special keyword \`${AI_ASSISTANT_KEYWORDS.PREPARE_WORKFLOW}\`.**
- For all other messages — questions, explanations, clarifications — respond in plain text only. **NEVER generate a workflow unless the keyword is present in the last user message.**
- When the user asks you to create or suggest a workflow (by including \`${AI_ASSISTANT_KEYWORDS.PREPARE_WORKFLOW}\`), respond with a single valid JSON code block (${TRIPLE_BACKTICK}json ... ${TRIPLE_BACKTICK}). The JSON MUST have \`nodes\` and \`edges\` as top-level arrays — do NOT wrap them in a \`workflow\` key or any other key. Use exactly the structure shown in the Workflow JSON format section above.
- Only use node types listed above.
- Node config fields go inside \`data\`, not inside \`config\` or any other key. Use \`data.title\` as the node label.
- Include all required config fields in \`data\` for each node type.
- Include at most one workflow JSON block per response.
- When using a ToolNode, always set \`data.toolSubtype\` to one of the tool identifiers listed above.
- **Every ToolNode (\`type: "ai-tool"\`) must be connected to an LLM Process node (\`type: "llm-process"\`) via an edge from the tool node to the LLM Process node.** Tools are invoked by the LLM — never place a tool node without a paired LLM Process node.
- **Never fill in sensitive values** such as API keys, tokens, client IDs, client secrets, passwords, or credentials. Leave those fields as empty strings (\`""\`) or omit them entirely, and tell the user they must fill them in manually.
- When explaining a workflow, be concise and describe the data flow step by step.
- If the user asks a general question, answer it directly without generating a workflow.

---

❗️**FINAL REMINDER:**

**You are STRICTLY FORBIDDEN from generating a workflow JSON unless the user's message contains the keyword \`${AI_ASSISTANT_KEYWORDS.PREPARE_WORKFLOW}\`.**
`;

    console.log('Generated system prompt:\n', prompt);

    return prompt;
}
