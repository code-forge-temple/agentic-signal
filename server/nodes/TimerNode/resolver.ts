/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {GraphQLContext} from "../../graphql/types.ts";
import {timerService} from "./service.ts";
import {TimerConfig, TimerTriggerEvent} from "./types.ts";

export const resolver = {
    Query: {
        getActiveTimers: (
            _parent: unknown,
            _args: unknown,
            _context: GraphQLContext
        ): string[] => {
            return timerService.getActiveTimers();
        }
    },

    Mutation: {
        startTimer: (
            _parent: unknown,
            {nodeId, config}: {nodeId: string; config: TimerConfig},
            _context: GraphQLContext
        ): boolean => {
            timerService.startTimer(nodeId, config);

            return true;
        },

        stopTimer: (
            _parent: unknown,
            {nodeId}: {nodeId: string},
            _context: GraphQLContext
        ): boolean => {
            timerService.stopTimer(nodeId);

            return true;
        }
    },

    Subscription: {
        timerTrigger: {
            subscribe: async function* (
                _parent: unknown,
                {nodeId}: {nodeId: string},
                _context: GraphQLContext
            ) {
                const eventQueue: TimerTriggerEvent[] = [];
                let resolveNext: ((value: IteratorResult<{timerTrigger: TimerTriggerEvent}>) => void) | null = null;

                const unsubscribe = timerService.subscribe(nodeId, (event: TimerTriggerEvent) => {
                    if (resolveNext) {
                        resolveNext({value: {timerTrigger: event}, done: false});
                        resolveNext = null;
                    } else {
                        eventQueue.push(event);
                    }
                });

                try {
                    while (true) {
                        if (eventQueue.length > 0) {
                            const event = eventQueue.shift()!;

                            yield {timerTrigger: event};
                        } else {
                            await new Promise<IteratorResult<{timerTrigger: TimerTriggerEvent}>>((resolve) => {
                                resolveNext = resolve;
                            });
                        }
                    }
                } finally {
                    unsubscribe();
                }
            }
        }
    }
};