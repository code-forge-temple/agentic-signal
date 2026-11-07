/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

export const typeDefs = /* GraphQL */ `
type WorkflowFile {
    name: String!
    content: String!
}

type WorkflowsFolder {
    path: String!
    files: [WorkflowFile!]!
}
`;

export const queryDefs = /* GraphQL */ `workflowsFolder(folder: String): WorkflowsFolder!`;

export const mutationDefs = /* GraphQL */ `saveWorkflowFile(folder: String, name: String!, content: String!): String!`;
