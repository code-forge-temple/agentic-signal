/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {createSchema} from "npm:graphql-yoga";
import {typeDefs} from "./typeDefs.ts";
import {resolvers} from "./resolvers/index.ts";

export const schema = createSchema({
    typeDefs,
    resolvers,
});