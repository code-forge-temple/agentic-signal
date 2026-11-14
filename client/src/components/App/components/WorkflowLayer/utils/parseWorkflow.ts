/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {v4 as uuidv4} from 'uuid';
import {z} from 'zod';
import {errorMessage} from '@shared/utils';
import {DEFAULT_EDGE_TYPE} from '../../../../edges';
import {AppNode} from '../../../../nodes/workflow.gen';
import {NodeDescriptor} from '../../../../nodes/types';
import {toolRegistry} from '../../../../nodes/ToolNode/tools/toolRegistry.gen';
import {nodeRegistry} from '../../../../nodes/nodeRegistry.gen';
import {NODE_TYPE as TOOL_NODE_TYPE} from '../../../../nodes/ToolNode/constants';
import {assertValidWorkflowEdges} from '../../../utils/workflowUtils';
import {getDefaultUserConfigValues} from '../../../../../types/tool.types';
import {Workflow} from '../types';
import {isRecord} from '../../../../../utils';
import {zodIssues} from '../../../../../utils/zodIssues';


// Zod problems in load errors name their path with arrows: data→title.
const ZOD_PATH_SEPARATOR = '→';

function remapNodeAndEdgeIds<
    N extends { id: string },
    E extends { source: string; target: string; sourceHandle?: string | null; targetHandle?: string | null }
> (nodes: N[], edges: E[]) {
    const idMap = new Map<string, string>(
        nodes.map(node => [node.id, uuidv4()])
    );

    const remappedNodes = nodes.map(node => ({
        ...node,
        id: idMap.get(node.id)!
    }));

    const remappedEdges = edges.map(edge => {
        const newSource = idMap.get(edge.source) ?? edge.source;
        const newTarget = idMap.get(edge.target) ?? edge.target;
        const newId = `xy-edge__${newSource}${edge.sourceHandle ?? ''}-${newTarget}${edge.targetHandle ?? ''}`;

        return {
            ...edge,
            source: newSource,
            target: newTarget,
            id: newId
        };
    });

    return {remappedNodes, remappedEdges};
}

type LoadableNodeDescriptor = NodeDescriptor<string, { data: { title?: string; toSanitize?: string[] } }>;

const descriptorMap: Record<string, LoadableNodeDescriptor | undefined> = Object.fromEntries(
    nodeRegistry.map(desc => [desc.type, desc])
);

const NodeSchema = z.object({
    id: z.string().min(1, '"id" must be a non-empty string'),
    type: z.string().min(1, '"type" must be a non-empty string'),
    data: z.record(z.unknown()),
    position: z.object({x: z.number(), y: z.number()}, {required_error: '"position" with {x, y} is required'}),
}).passthrough();

const EdgeSchema = z.object({
    source: z.string().min(1, '"source" must be a non-empty string'),
    target: z.string().min(1, '"target" must be a non-empty string'),
}).passthrough().refine(edge => edge.source !== edge.target, {
    // As the editor refuses to draw one: whatever the port, a node fed its own output.
    message: "an edge can't connect a node to itself",
    path: ['target'],
});

const WorkflowSchema = z.object({
    nodes: z.array(NodeSchema),
    edges: z.array(EdgeSchema).optional().default([]),
});

type ParsedNode = z.infer<typeof NodeSchema>;
type NodeData = Record<string, unknown>;
type NodeDefaults = LoadableNodeDescriptor['defaultData'];

// Spacing for nodes placed side by side when the file gives no position.
const MISSING_POSITION_SPACING = 300;

type RawNode = {position?: {x?: unknown; y?: unknown}};

const positionOf = (node: RawNode, index: number) => ({
    x: typeof node.position?.x === 'number' ? node.position.x : index * MISSING_POSITION_SPACING,
    y: typeof node.position?.y === 'number' ? node.position.y : 0,
});

// Models often leave positions out: a missing coordinate is filled in, so the file still loads. Anything that isn't
// an object is left for the schema to report.
function withPositions (raw: unknown) {
    if (!isRecord(raw) || !Array.isArray(raw.nodes)) return raw;

    return {...raw, nodes: raw.nodes.map((node: unknown, index) => (isRecord(node) ? {...node, position: positionOf(node as RawNode, index)} : node))};
}

function descriptorFor (type: string): LoadableNodeDescriptor {
    const descriptor = descriptorMap[type];

    if (!descriptor) throw new Error(`unknown node type "${type}". Valid types are: ${Object.keys(descriptorMap).join(', ')}`);

    return descriptor;
}

// A tool node takes its schema, title and default settings from the tool it names. A tool the app no longer has
// loads with an empty schema, under the node's own defaults.
function toolNodeData (data: NodeData, nodeDefaults: NodeDefaults): NodeData {
    const tool = toolRegistry.find(entry => entry.toolSubtype === data.toolSubtype);
    const nodeToSanitize = nodeDefaults.toSanitize || [];

    if (!tool) return {...data, toolSchema: {}, title: nodeDefaults.title || data.title, handler: undefined, toSanitize: [...nodeToSanitize]};

    return {
        ...data,
        toolSchema: tool.toolSchema,
        userConfigSchema: tool.userConfigSchema,
        userConfig: {...getDefaultUserConfigValues(tool.userConfigSchema || {}), ...(data.userConfig as NodeData | undefined)},
        title: tool.title,
        handler: undefined,
        toSanitize: [...nodeToSanitize, ...tool.toSanitize],
    };
}

// The title and the paths to sanitize come from the code, not the file: a node renamed in an update loads under its
// new name.
const hydratedData = (type: string, data: NodeData, defaults: NodeDefaults): NodeData => (type === TOOL_NODE_TYPE
    ? toolNodeData(data, defaults)
    : {...data, title: defaults.title || data.title, toSanitize: defaults.toSanitize});

// The node type's own check, its zod problems listed after `where` (which node it is).
function assertNodeData (descriptor: LoadableNodeDescriptor, data: NodeData, where: string): void {
    try {
        descriptor.assertion(data);
    } catch (error) {
        if (!(error instanceof z.ZodError)) throw error;

        throw new Error(`${where}: ${zodIssues(error, {separator: ZOD_PATH_SEPARATOR, prefix: ['data']})}`);
    }
}

function hydrateNode (node: ParsedNode, index: number): AppNode {
    const descriptor = descriptorFor(node.type);
    const data = descriptor.migrate ? descriptor.migrate(node.data) : node.data;
    const hydrated = {...node, data: hydratedData(node.type, data, descriptor.defaultData)};

    assertNodeData(descriptor, hydrated.data, `nodes[${index}] (type "${node.type}")`);

    // The descriptor's assertion has just validated this node's data.
    return hydrated as AppNode;
}

/** Validates and hydrates a workflow JSON into nodes and edges with fresh ids. Throws on anything invalid. */
export function parseWorkflowJson (jsonString: string): Workflow {
    const {nodes, edges: rawEdges} = WorkflowSchema.parse(withPositions(JSON.parse(jsonString)));
    const edges = rawEdges.map(edge => ({...edge, type: DEFAULT_EDGE_TYPE}));

    assertValidWorkflowEdges(nodes, edges);

    const {remappedNodes, remappedEdges} = remapNodeAndEdgeIds(nodes.map(hydrateNode), edges);

    return {nodes: remappedNodes, edges: remappedEdges};
}

export function describeLoadError (error: unknown): string {
    return error instanceof z.ZodError ? zodIssues(error, {separator: ZOD_PATH_SEPARATOR}) : errorMessage(error);
}
