/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {GraphQLContext} from "../../graphql/types.ts";
import {timerService} from "./service.ts";
import {TimerConfig, TimerTriggerEvent} from "./types.ts";
import {eventStream} from "../../utils/eventStream.ts";

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
            subscribe: (
                _parent: unknown,
                {nodeId}: {nodeId: string},
                _context: GraphQLContext
            ) => eventStream<TimerTriggerEvent>(onEvent => timerService.subscribe(nodeId, onEvent)),
            // Each payload is the event itself.
            resolve: (event: TimerTriggerEvent): TimerTriggerEvent => event,
        }
    }
};