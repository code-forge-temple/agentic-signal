/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {makeExecutableSchema} from "npm:@graphql-tools/schema";
import {generateTypeDefs} from "./schema-generator.ts";
import {toolResolvers} from "../tools/toolsRegistry.gen.ts";
import {nodeResolvers} from "../nodes/nodesRegistry.gen.ts";

const typeDefs = generateTypeDefs();
const allResolvers = [...toolResolvers, ...nodeResolvers];

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