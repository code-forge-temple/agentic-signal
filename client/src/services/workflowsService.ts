/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {graphqlRequest} from "../utils";
import {WorkflowFile} from "../workflows";


export type WorkflowsFolder = {
    /** The folder the backend actually used: the one from Settings, or its default. */
    path: string;
    files: WorkflowFile[];
};

/** The workflows saved in `folder` (empty: the backend's default folder), with their content. */
export async function listWorkflowsFolder (folder: string): Promise<WorkflowsFolder> {
    const data = await graphqlRequest<{workflowsFolder: WorkflowsFolder}>(
        /* GraphQL */ `
            query($folder: String) {
                workflowsFolder(folder: $folder) {
                    path
                    files { name content }
                }
            }
        `,
        {folder: folder || null}
    );

    return data.workflowsFolder;
}

/** The folder the backend saves workflows to, the one from Settings or its default, without fetching its files. */
export async function workflowsFolderPath (folder: string): Promise<string> {
    const data = await graphqlRequest<{workflowsFolder: {path: string}}>(
        /* GraphQL */ `query($folder: String) { workflowsFolder(folder: $folder) { path } }`,
        {folder: folder || null}
    );

    return data.workflowsFolder.path;
}

/** Saves a workflow into `folder`, replacing a file of the same name. Returns the file's full path. */
export async function saveWorkflowFile (folder: string, name: string, content: string): Promise<string> {
    const data = await graphqlRequest<{saveWorkflowFile: string}>(
        /* GraphQL */ `
            mutation($folder: String, $name: String!, $content: String!) {
                saveWorkflowFile(folder: $folder, name: $name, content: $content)
            }
        `,
        {folder: folder || null, name, content}
    );

    return data.saveWorkflowFile;
}
