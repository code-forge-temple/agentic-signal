/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {graphqlRequest} from "../utils";
import {CommandError} from "./commandRouter";
import {errorMessage} from "@shared/utils";


export type OutsideCommandError = {
    code: string;
    message: string;
    node?: string | null;
};

/**
 * What an outside caller is told about a command that failed: the router's error code and the node that failed (any
 * other error is node_failed), or unknown_command when nothing listens for it and no saved or built-in workflow has it
 * (with a workflow, it's just not running now).
 */
export function outsideCommandFailure (error: unknown, command: string, knownCommands: Set<string>): OutsideCommandError {
    const commandError = error instanceof CommandError ? error : null;

    if (commandError?.code === "no_listener" && !knownCommands.has(command)) {
        return {code: "unknown_command", message: `No workflow answers to /${command}.`};
    }

    return {
        code: commandError?.code ?? "node_failed",
        message: errorMessage(error),
        node: commandError?.node?.nodeTitle ?? null,
    };
}

/** Where outside apps call commands, e.g. "http://127.0.0.1:8001/workflows/". */
export async function fetchCommandsEndpoint (): Promise<string> {
    const data = await graphqlRequest<{commandsEndpoint: string}>(/* GraphQL */ `query { commandsEndpoint }`, {});

    return data.commandsEndpoint;
}

/** Whether other computers may call commands, and on which of this one's addresses. */
export type CommandsNetworkAccess = {
    enabled: boolean;
    /** The variable the backend was started with that decides it instead of the switch, if any. */
    lockedBy: string | null;
    port: number;
    addresses: string[];
};

const NETWORK_ACCESS_FIELDS = "enabled lockedBy port addresses";

export async function fetchCommandsNetworkAccess (): Promise<CommandsNetworkAccess> {
    const data = await graphqlRequest<{commandsNetworkAccess: CommandsNetworkAccess}>(
        /* GraphQL */ `query { commandsNetworkAccess { ${NETWORK_ACCESS_FIELDS} } }`,
        {}
    );

    return data.commandsNetworkAccess;
}

/** Opens the commands port to the network, or closes it to this computer only; the backend remembers it. */
export async function setCommandsNetworkAccess (enabled: boolean): Promise<CommandsNetworkAccess> {
    const data = await graphqlRequest<{setCommandsNetworkAccess: CommandsNetworkAccess}>(
        /* GraphQL */ `mutation($enabled: Boolean!) { setCommandsNetworkAccess(enabled: $enabled) { ${NETWORK_ACCESS_FIELDS} } }`,
        {enabled}
    );

    return data.setCommandsNetworkAccess;
}

/** The app's answer to an outside call: the result's payload (JSON-encoded), or why there is none. */
export async function respondToCommand (id: string, answer: {result: string} | {error: OutsideCommandError}): Promise<void> {
    await graphqlRequest<{respondToCommand: boolean}>(
        /* GraphQL */ `
            mutation($id: String!, $result: String, $error: CommandErrorInput) {
                respondToCommand(id: $id, result: $result, error: $error)
            }
        `,
        {id, result: "result" in answer ? answer.result : null, error: "error" in answer ? answer.error : null}
    );
}
