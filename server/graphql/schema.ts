/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {makeExecutableSchema} from "npm:@graphql-tools/schema";
import {generateTypeDefs} from "./schema-generator.ts";
import {toolResolvers} from "../tools/toolsRegistry.gen.ts";
import {nodeResolvers} from "../nodes/nodesRegistry.gen.ts";
import {resolver as workflowsResolver} from "../workflows/mod.ts";
import {resolver as commandsResolver} from "../commands/mod.ts";
import {resolver as browserResolver} from "../browser/mod.ts";

const typeDefs = generateTypeDefs();
const allResolvers = [...toolResolvers, ...nodeResolvers, workflowsResolver, commandsResolver, browserResolver];

const resolvers = {
    Query: Object.assign(
        {},
        ...allResolvers.map(r => r.Query || {})
    ),
    Mutation: Object.assign(
        {},
        ...allResolvers.map(r => 'Mutation' in r ? r.Mutation : {})
    ),
    Subscription: Object.assign(
        {},
        ...allResolvers.map(r => 'Subscription' in r ? r.Subscription : {})
    )
};

export const schema = makeExecutableSchema({
    typeDefs,
    resolvers
});