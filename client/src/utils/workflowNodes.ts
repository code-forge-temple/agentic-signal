/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {Edge} from "@xyflow/react";
import {AppNode, AppNodeType} from "../components/nodes/workflow.gen";
import {NODE_TYPE as LLM_NODE_TYPE} from "../components/nodes/LlmProcessNode/constants";
import {NODE_TYPE as AGGREGATOR_NODE_TYPE} from "../components/nodes/AsyncDataAggregatorNode/constants";
import {NodeEnvelope} from "../types/workflow";


/** An edge as far as data goes: which node feeds which. */
export type Feed = Pick<Edge, "source" | "target">;

export type NodeAssertions = Record<AppNodeType, (data: unknown) => void>;

/**
 * How data moves through a workflow's nodes, as pure functions of the node list: each returns a new list, and every
 * node whose data changes is checked with its descriptor's assertion.
 */
export function workflowNodes (assertions: NodeAssertions) {
    const update = <T extends AppNode>(node: T, data: Partial<T["data"]>): T => {
        const merged = {...node.data, ...data};

        assertions[node.type]?.(merged);

        return {...node, data: merged};
    };

    // What `source` sent the node goes: the aggregator drops that source's entry, any other node its whole input.
    const withoutInputFrom = (node: AppNode, source: string): AppNode => {
        if (node.type !== AGGREGATOR_NODE_TYPE) return update(node, {input: undefined});

        return update(node, {input: Object.fromEntries(Object.entries(node.data.input ?? {}).filter(([from]) => from !== source))});
    };

    // The aggregator collects one input per source; any other node takes the latest and drops pending feedback.
    const receive = (node: AppNode, source: string, input: NodeEnvelope | undefined): AppNode => {
        if (node.type !== AGGREGATOR_NODE_TYPE) return update(node, {input, feedback: undefined});

        return input === undefined ? withoutInputFrom(node, source) : update(node, {input: {...node.data.input, [source]: input}});
    };

    const fedBy = (feeds: Feed[], source: string) => new Set(feeds.filter(feed => feed.source === source).map(feed => feed.target));

    return {
        update,

        configure: (nodes: AppNode[], id: string, data: Record<string, any>) => nodes.map(node => (node.id === id ? update(node, data) : node)),

        /** Every node fed through one of `cut` (deleted edges, or the edges of deleted nodes) loses what came through it. */
        cut: (nodes: AppNode[], cut: Feed[]) =>
            nodes.map(node => cut.filter(feed => feed.target === node.id).reduce((updated, feed) => withoutInputFrom(updated, feed.source), node)),

        /** `source`'s output reaches every node it feeds; undefined takes it back. */
        deliver: (nodes: AppNode[], feeds: Feed[], source: string, input?: NodeEnvelope) => {
            const fed = fedBy(feeds, source);

            return nodes.map(node => (fed.has(node.id) ? receive(node, source, input) : node));
        },

        /** Feedback from `from` reaches the LLM nodes that feed it. */
        sendFeedback: (nodes: AppNode[], feeds: Feed[], from: string, feedback: string) => {
            const feeding = new Set(feeds.filter(feed => feed.target === from).map(feed => feed.source));

            return nodes.map(node => (feeding.has(node.id) && node.type === LLM_NODE_TYPE ? update(node, {feedback}) : node));
        },
    };
}
