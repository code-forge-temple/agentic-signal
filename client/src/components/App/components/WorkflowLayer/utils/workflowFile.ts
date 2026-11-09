/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {Edge} from '@xyflow/react';
import {AppNode} from '../../../../nodes/workflow.gen';
import {isRecord} from '../../../../../utils';


// Characters Windows, macOS or Linux refuse in a file name.
const FILE_NAME_FORBIDDEN_CHARS = /[\\/:*?"<>|]/g;

function deleteByPath (obj: Record<string, unknown>, path: string): void {
    const parts = path.split(".");

    if (parts.length === 1) {
        delete obj[parts[0]];
    } else {
        let current: unknown = obj;

        for (let i = 0; i < parts.length - 1; i++) {
            if (!isRecord(current)) return;

            current = current[parts[i]];
        }

        if (isRecord(current)) {
            delete current[parts[parts.length - 1]];
        }
    }
}

/** The workflow as a file holds it: each node's data without the paths it marks to sanitize, nor that list itself. */
export function workflowToJson (nodes: AppNode[], edges: Edge[]): string {
    const sanitizedNodes = nodes.map(node => {
        const nodeData = JSON.parse(JSON.stringify(node.data)) as Record<string, unknown>;
        const toSanitize = Array.isArray(nodeData.toSanitize) ? nodeData.toSanitize as string[] : [];

        for (const path of toSanitize) {
            deleteByPath(nodeData, path);
        }

        deleteByPath(nodeData, "toSanitize");

        return {...node, data: nodeData};
    });

    return JSON.stringify({nodes: sanitizedNodes, edges}, null, 4);
}

/** A file name for the workflow: `name`, with the characters a file system refuses turned into "_". */
export const workflowFileName = (name: string) => `${name.replace(FILE_NAME_FORBIDDEN_CHARS, '_')}.json`;

/** Offers the workflow JSON as a download named after `name`. */
export function downloadWorkflow (json: string, name: string): void {
    const url = URL.createObjectURL(new Blob([json], {type: "application/json"}));
    const link = document.createElement("a");

    link.href = url;
    link.download = workflowFileName(name);
    link.click();

    URL.revokeObjectURL(url);
}
