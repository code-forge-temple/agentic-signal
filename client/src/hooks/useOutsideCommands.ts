/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {useEffect} from "react";
import {GraphQLSocketManager} from "../services/graphQLSocketManager";
import {CommandError, CommandRouter} from "../services/commandRouter";
import {respondToCommand} from "../services/outsideCommandsService";
import {sha256Hex} from "../services/commandConnections";
import {commandInputEnvelope} from "../services/commandInput";
import {NodeEnvelope} from "../types/workflow";
import {useCommandConnections} from "./useCommandConnections";
import {useCommandWorkflows} from "./useCommandWorkflows";
import {useLatestValue} from "./useLatestValue";
import {errorMessage} from "@shared/utils";


type CommandRequestEvent = {
    type: "request" | "cancel" | "list";
    id: string;
    command: string | null;
    input: string | null;
};

const COMMAND_REQUESTS = /* GraphQL */ `
    subscription($connections: [CommandConnectionInput!]!) {
        commandRequests(connections: $connections) { type id command input }
    }
`;

/*
 * Serves outside apps' calls (POST /workflows/<command> on the backend) while the app is open: each
 * one goes through the command router as an outside call, to a free layer of the user's listening for
 * it, and the answer goes back to the backend, which replies to the caller. GET /workflows gets the
 * commands those layers listen for. Mounted once, for the app.
 */
export function useOutsideCommands (): void {
    const {connections} = useCommandConnections();
    const commandWorkflows = useCommandWorkflows();
    // A command with no listener but a saved or built-in workflow is "not running now" (503); otherwise "unknown" (404).
    const knownCommandsRef = useLatestValue(new Set(commandWorkflows.map(w => w.command)));

    useEffect(() => {
        let cancelled = false;
        let unsubscribe = () => {};
        const running = new Map<string, AbortController>();

        const serve = async (id: string, command: string, input: string) => {
            const controller = new AbortController();

            running.set(id, controller);

            try {
                // The caller sends a Data Source; Workflow Input passes on what a Data Source with that
                // content would put out. A body that isn't one is refused before any layer is taken.
                let envelope: NodeEnvelope;

                try {
                    envelope = commandInputEnvelope(JSON.parse(input));
                } catch (error) {
                    await respondToCommand(id, {error: {code: "bad_request", message: errorMessage(error)}}).catch(() => {});

                    return;
                }

                const result = await CommandRouter.getInstance().request({
                    command,
                    input: envelope,
                    source: "outside",
                    signal: controller.signal,
                });

                await respondToCommand(id, {result: JSON.stringify(result.payload ?? null)});
            } catch (error) {
                // The caller hung up: nobody is left to tell.
                if (controller.signal.aborted) return;

                const commandError = error instanceof CommandError ? error : null;
                const unknown = commandError?.code === "no_listener" && !knownCommandsRef.current.has(command);

                await respondToCommand(id, {error: unknown
                    ? {code: "unknown_command", message: `No workflow answers to /${command}.`}
                    : {
                        code: commandError?.code ?? "node_failed",
                        message: errorMessage(error),
                        node: commandError?.node?.nodeTitle ?? null,
                    }}).catch(() => {});
            } finally {
                running.delete(id);
            }
        };

        void (async () => {
            // Only the tokens' hashes leave the app.
            // A connection saved before there was a vault still holds its token: its hash is computed here until the vault takes it.
            const hashed = await Promise.all(connections.map(async ({name, token, tokenHash, commands}) => ({
                name, tokenHash: tokenHash ?? await sha256Hex(token ?? ""), commands,
            })));

            if (cancelled) return;

            unsubscribe = GraphQLSocketManager.getInstance().subscribe<{commandRequests: CommandRequestEvent}>(
                {query: COMMAND_REQUESTS, variables: {connections: hashed}},
                ({commandRequests: event}) => {
                    if (event.type === "cancel") {
                        running.get(event.id)?.abort();
                    } else if (event.type === "list") {
                        const listed = CommandRouter.getInstance().listedCommands("outside");

                        respondToCommand(event.id, {result: JSON.stringify(listed)}).catch(() => {});
                    } else if (event.command && event.input !== null) {
                        void serve(event.id, event.command, event.input);
                    }
                },
                (error) => console.error("[useOutsideCommands] subscription error:", error),
            );
        })();

        return () => {
            cancelled = true;
            unsubscribe();

            for (const controller of running.values()) controller.abort();
        };
    }, [connections, knownCommandsRef]);
}
