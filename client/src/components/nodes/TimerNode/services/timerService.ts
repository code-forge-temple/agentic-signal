/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {graphqlBaseUrl} from "../../../../utils";
import {GraphQLSocketManager} from "../../../../services/graphQLSocketManager";
import {isTimerTriggerEvent, TimerNodeData, TimerTriggerEvent} from "../types/workflow";


class GraphQLService {
    async startTimer (
        nodeId: string,
        config: TimerNodeData
    ): Promise<void> {
        const response = await fetch(graphqlBaseUrl, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                query: /* GraphQL */ `
                        mutation($nodeId: String!, $config: TimerConfigInput!) {
                            startTimer(nodeId: $nodeId, config: $config)
                        }
                    `,
                variables: {nodeId, config}
            })
        });
        const {errors} = await response.json();

        if (errors) {
            throw new Error(errors.map((e: any) => e.message).join('\n'));
        }
    }

    async stopTimer (nodeId: string): Promise<void> {
        const response = await fetch(graphqlBaseUrl, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                query: /* GraphQL */ `
                        mutation($nodeId: String!) {
                            stopTimer(nodeId: $nodeId)
                        }
                    `,
                variables: {nodeId}
            })
        });
        const {errors} = await response.json();

        if (errors) {
            throw new Error(errors.map((e: any) => e.message).join('\n'));
        }
    }

    subscribeToTimer (
        nodeId: string,
        onTrigger: (event: TimerTriggerEvent) => void,
        onError?: (error: any) => void
    ): () => void {
        const unsubscribe = GraphQLSocketManager.getInstance().subscribe(
            {
                query: /* GraphQL */ `
                    subscription($nodeId: String!) {
                        timerTrigger(nodeId: $nodeId) {
                            nodeId
                            timestamp
                            type
                        }
                    }
                `,
                variables: {nodeId}
            },
            (result) => {
                const {timerTrigger} = result;

                if (isTimerTriggerEvent(timerTrigger)) {
                    onTrigger(timerTrigger);
                }
            },
            (err) => {
                onError?.(err);
            },
            () => { }
        );

        return () => {
            unsubscribe();
        };
    }

    disconnect (): void {
        GraphQLSocketManager.getInstance().dispose();
    }
}

export const graphQLService = new GraphQLService();