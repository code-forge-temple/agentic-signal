/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {generateGraphQLType} from "../../utils/graphqlUtils.ts";
import {TimerTriggerEventFields} from "./types.ts";

export const graphqlTypeName = "TimerTriggerEvent";

export const typeDefs = /* GraphQL */ `
${generateGraphQLType(graphqlTypeName, TimerTriggerEventFields)}

input IntervalTimerConfigInput {
    mode: String!
    interval: Int!
    immediate: Boolean!
    runOnce: Boolean!
}

input ScheduledTimerConfigInput {
    mode: String!
    scheduledDateTime: String!
    repeat: String!
    timezone: String
}

input TimerConfigInput {
    mode: String!
    interval: Int
    immediate: Boolean
    runOnce: Boolean
    scheduledDateTime: String
    repeat: String
    timezone: String
}
`;

export const queryDefs = /* GraphQL */ `
    getActiveTimers: [String]
`;

export const mutationDefs = /* GraphQL */ `
    startTimer(nodeId: String!, config: TimerConfigInput!): Boolean
    stopTimer(nodeId: String!): Boolean
`;

export const subscriptionDefs = /* GraphQL */ `
    timerTrigger(nodeId: String!): ${graphqlTypeName}
`;