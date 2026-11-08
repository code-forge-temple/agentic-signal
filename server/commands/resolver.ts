/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {createGraphQLError} from "npm:graphql-yoga";
import {commandGateway, CommandConnection, CommandRequestEvent, CommandResponse} from "./service.ts";
import {commandsListener, CommandsNetworkAccess} from "./listener.ts";
import {errorMessage} from "../../shared/utils.ts";


export const resolver = {
    Query: {
        commandsEndpoint: (): string => commandsListener.endpoint(),
        commandsNetworkAccess: (): CommandsNetworkAccess => commandsListener.networkAccess(),
    },

    Mutation: {
        respondToCommand: (_parent: unknown, {id, result, error}: {id: string} & CommandResponse): boolean =>
            commandGateway.respond(id, {result, error}),
        setCommandsNetworkAccess: async (_parent: unknown, {enabled}: {enabled: boolean}): Promise<CommandsNetworkAccess> => {
            try {
                return await commandsListener.setNetworkAccess(enabled);
            } catch (error) {
                // Yoga would turn an ordinary error into "Unexpected error."; this one says why for Settings.
                throw createGraphQLError(errorMessage(error));
            }
        },
    },

    Subscription: {
        commandRequests: {
            // The app's connection list comes with its subscription, so a reconnect brings it back too.
            subscribe: async function* (_parent: unknown, {connections}: {connections: CommandConnection[]}) {
                const queue: CommandRequestEvent[] = [];
                let wake: (() => void) | null = null;

                const disconnect = commandGateway.connectApp(connections, (event) => {
                    queue.push(event);
                    wake?.();
                    wake = null;
                });

                try {
                    while (true) {
                        const event = queue.shift();

                        if (event) {
                            yield {commandRequests: event};
                        } else {
                            await new Promise<void>((resolve) => {
                                wake = resolve;
                            });
                        }
                    }
                } finally {
                    disconnect();
                }
            }
        }
    }
};
