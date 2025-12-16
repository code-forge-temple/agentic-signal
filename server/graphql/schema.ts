/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {createSchema} from "npm:graphql-yoga";
import {typeDefs} from "./typeDefs.ts";
import {toolResolvers} from "../tools/toolsRegistry.gen.ts";
import {nodeResolvers} from "../nodes/nodesRegistry.gen.ts";

export const resolvers = {
    Query: {
        ...Object.assign({}, ...toolResolvers, ...nodeResolvers),
    },
};

export const schema = createSchema({
    typeDefs,
    resolvers,
});