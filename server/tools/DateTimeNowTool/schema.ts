/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {generateGraphQLType} from "../../utils/graphqlUtils.ts";
import {TimezoneResultFields} from "./types.ts";


export const graphqlMethodName = "getTimezoneForCity";

export const graphqlResultTypeName = "TimezoneResult"

export const typeDefs = `${generateGraphQLType(graphqlResultTypeName, TimezoneResultFields)}`;

export const queryDefs = /* GraphQL */ `${graphqlMethodName}(city: String!): ${graphqlResultTypeName}`;