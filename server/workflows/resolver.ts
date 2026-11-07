/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {createGraphQLError} from "npm:graphql-yoga";
import {listWorkflows, saveWorkflow, WorkflowsFolder} from "./service.ts";


// Yoga replaces an ordinary error's message with "Unexpected error."; these ("the folder doesn't
// exist", "not a workflow file name") are for the user to read, so they go out as GraphQL errors.
async function withReadableErrors<T> (work: () => Promise<T>): Promise<T> {
    try {
        return await work();
    } catch (error) {
        throw createGraphQLError(error instanceof Error ? error.message : String(error));
    }
}

export const resolver = {
    Query: {
        workflowsFolder: (_parent: unknown, {folder}: {folder?: string | null}): Promise<WorkflowsFolder> =>
            withReadableErrors(() => listWorkflows(folder)),
    },
    Mutation: {
        saveWorkflowFile: (_parent: unknown, {folder, name, content}: {folder?: string | null; name: string; content: string}): Promise<string> =>
            withReadableErrors(() => saveWorkflow(folder, name, content)),
    },
};
