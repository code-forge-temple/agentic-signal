/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

export const typeDefs = /* GraphQL */ `
type CommandRequestEvent {
    type: String!
    id: String!
    command: String
    input: String
}

input CommandConnectionInput {
    name: String!
    tokenHash: String!
    commands: [String!]!
}

input CommandErrorInput {
    code: String!
    message: String!
    node: String
}

type CommandsNetworkAccess {
    enabled: Boolean!
    lockedBy: String
    port: Int!
    addresses: [String!]!
}
`;

export const queryDefs = /* GraphQL */ `commandsEndpoint: String!
commandsNetworkAccess: CommandsNetworkAccess!`;

export const mutationDefs = /* GraphQL */ `respondToCommand(id: String!, result: String, error: CommandErrorInput): Boolean!
setCommandsNetworkAccess(enabled: Boolean!): CommandsNetworkAccess!`;

export const subscriptionDefs = /* GraphQL */ `commandRequests(connections: [CommandConnectionInput!]!): CommandRequestEvent!`;
