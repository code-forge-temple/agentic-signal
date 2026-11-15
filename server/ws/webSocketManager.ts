/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {errorMessage} from "../../shared/utils.ts";


type SubscriptionHandler = (event: any) => void;

/** Why a subscription ended: the client's own "complete", or its socket closing. */
export type SubscriptionEndReason = "unsubscribed" | "connection closed";

type UnsubscribeFunction = (reason: SubscriptionEndReason) => void;

/** Where a subscription came from: its socket's number, as the log's "WebSocket N opened" names it. */
export type SubscriptionContext = {socket: number};

type SubscriptionFactory = (
    nodeId: string,
    handler: SubscriptionHandler,
    variables: Record<string, unknown>,
    context: SubscriptionContext
) => UnsubscribeFunction;

/** "code 1000: bye", or "code 1006" with no reason; a socket closed without an event just "closed". */
function describeClose (event?: CloseEvent): string {
    if (!event) return "closed";

    return event.reason ? `code ${event.code}: ${event.reason}` : `code ${event.code}`;
}

/**
 * What a subscribe message's payload names: the subscription type (the field its query subscribes to, with arguments)
 * and the node (from the variables, else the query). A payload without a query names neither.
 */
function subscriptionFields (payload: any): {type?: string; nodeId?: string} {
    const query: string = typeof payload?.query === "string" ? payload.query : "";

    return {
        type: query.match(/subscription[^{]*\{\s*(\w+)\s*\(/)?.[1],
        nodeId: payload?.variables?.nodeId || query.match(/nodeId:\s*"([^"]+)"/)?.[1],
    };
}

type SubscriptionTypeOptions = {
    /** False for an app-wide subscription, which needs no nodeId (e.g. outside workflow commands). */
    nodeScoped?: boolean;
};

export class WebSocketManager {
    private static instance: WebSocketManager | null = null;

    private subscriptionFactories = new Map<string, {factory: SubscriptionFactory; nodeScoped: boolean}>();

    // Per socket, each subscription id's teardown, so a client's "complete" really unsubscribes.
    private subscriptionCleanups = new Map<WebSocket, Map<string, () => void>>();

    private pingIntervals = new Map<WebSocket, ReturnType<typeof setInterval>>();

    // Numbers the sockets in the log, so a subscription's lines can be matched to its socket's.
    private nextSocketNumber = 1;

    private yogaHandler: ((request: Request) => Promise<Response>) | null = null;

    private constructor () {
        this.handleRequest = this.handleRequest.bind(this);
        this.handleUpgrade = this.handleUpgrade.bind(this);
    }

    static getInstance (): WebSocketManager {
        if (!WebSocketManager.instance) {
            WebSocketManager.instance = new WebSocketManager();
        }

        return WebSocketManager.instance;
    }

    setYogaHandler (handler: (request: Request) => Promise<Response>): void {
        this.yogaHandler = handler;
    }

    registerSubscriptionType (type: string, factory: SubscriptionFactory, {nodeScoped = true}: SubscriptionTypeOptions = {}): void {
        this.subscriptionFactories.set(type, {factory, nodeScoped});
    }

    async handleRequest (request: Request): Promise<Response> {
        const upgrade = request.headers.get("upgrade")?.toLowerCase();

        if (upgrade === "websocket") {

            try {
                return this.handleUpgrade(request);
            } catch (error) {
                console.error('[Backend] ❌ Failed to upgrade WebSocket:', error);

                return new Response('Failed to upgrade WebSocket', {status: 500});
            }
        }

        if (!this.yogaHandler) {
            throw new Error('Yoga handler not set');
        }

        return await this.yogaHandler(request);
    }

    handleUpgrade (request: Request): Response {
        try {
            const protocol = request.headers.get("sec-websocket-protocol");
            // Read now: the request's headers are gone once it's upgraded. It tells the desktop app
            // (http://tauri.localhost) from a browser tab.
            const origin = request.headers.get("origin");
            const {socket, response} = Deno.upgradeWebSocket(request, {
                protocol: protocol || undefined
            });

            this.setupSocketHandlers(socket, origin);

            return response;
        } catch (error) {
            console.error('[WebSocketManager] ❌ Failed to upgrade WebSocket:', error);

            throw error;
        }
    }

    private setupSocketHandlers (socket: WebSocket, origin: string | null = null): void {
        const number = this.nextSocketNumber++;

        this.subscriptionCleanups.set(socket, new Map());

        socket.onopen = () => console.log(`WebSocket ${number} opened (${origin ?? "no origin"})`);

        const pingInterval = setInterval(() => {
            if (socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({type: 'ping'}));
            } else {
                clearInterval(pingInterval);
                this.pingIntervals.delete(socket);
            }
        }, 30_000);

        this.pingIntervals.set(socket, pingInterval);

        socket.onmessage = async (event) => {
            try {
                const message = JSON.parse(event.data);

                switch (message.type) {
                    case 'connection_init':
                        socket.send(JSON.stringify({type: 'connection_ack'}));

                        break;

                    case 'subscribe':
                        this.handleSubscribe(socket, message, {socket: number});

                        break;

                    case 'complete':
                        this.subscriptionCleanups.get(socket)?.get(message.id)?.();

                        break;

                    case 'ping':
                        socket.send(JSON.stringify({type: 'pong'}));

                        break;
                }
            } catch (error) {
                // A message that isn't JSON, or a reply that couldn't be sent (the socket closing): nothing to answer under.
                console.error('[WebSocketManager] ⚠️ Could not handle a message:', error);
            }
        };

        socket.onclose = (event?: CloseEvent) => {
            console.log(`WebSocket ${number} closed (${describeClose(event)})`);
            this.cleanupSocket(socket);
        };

        socket.onerror = (error) => {
            console.error('[WebSocketManager] ❌ Socket error:', error);
            this.clearPingInterval(socket);
        };
    }

    private handleSubscribe (socket: WebSocket, message: any, context: SubscriptionContext): void {
        const {id, payload} = message;
        const subscription = this.readSubscription(payload);

        if (typeof subscription === "string") {
            socket.send(JSON.stringify({id, type: 'error', payload: [{message: subscription}]}));

            return;
        }

        const {type, nodeId, factory} = subscription;
        let unsubscribe: UnsubscribeFunction;

        try {
            unsubscribe = factory(nodeId, (event) => {
                if (socket.readyState !== WebSocket.OPEN) {
                    return;
                }

                socket.send(JSON.stringify({
                    id,
                    type: 'next',
                    payload: {
                        data: {
                            [type]: event
                        }
                    }
                }));
            }, payload.variables ?? {}, context);
        } catch (error) {
            // It couldn't start (a timer not started yet, say): the client hears why, under its id, instead of waiting.
            socket.send(JSON.stringify({id, type: 'error', payload: [{message: errorMessage(error)}]}));

            return;
        }

        this.endWithSocketOrClient(socket, id, unsubscribe);
    }

    /**
     * The subscription a subscribe message asks for: its type (the field the query subscribes to), its node (from the
     * variables, else the query) and the factory that starts it; why it can't be served, otherwise.
     */
    private readSubscription (payload: any): {type: string; nodeId: string; factory: SubscriptionFactory} | string {
        const {type, nodeId: nodeIdMatch} = subscriptionFields(payload);

        if (!type) return 'Invalid subscription query';

        const registered = this.subscriptionFactories.get(type);

        if (!registered) return `Unknown subscription type: ${type}`;

        if (!nodeIdMatch && registered.nodeScoped) return 'Missing nodeId in subscription';

        return {type, nodeId: nodeIdMatch ?? "", factory: registered.factory};
    }

    /** Unsubscribes when the socket closes (telling the client, if it still can, that it's complete), or on the client's own "complete". */
    private endWithSocketOrClient (socket: WebSocket, id: string, unsubscribe: UnsubscribeFunction): void {
        const closeHandler = () => {
            unsubscribe("connection closed");

            if (socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({
                    id,
                    type: 'complete'
                }));
            }
        };

        socket.addEventListener('close', closeHandler, {once: true});

        // The client's own "complete": stop now rather than when the socket closes.
        this.subscriptionCleanups.get(socket)?.set(id, () => {
            socket.removeEventListener('close', closeHandler);
            this.subscriptionCleanups.get(socket)?.delete(id);
            unsubscribe("unsubscribed");
        });
    }

    private clearPingInterval (socket: WebSocket): void {
        const interval = this.pingIntervals.get(socket);

        if (interval !== undefined) {
            clearInterval(interval);
            this.pingIntervals.delete(socket);
        }
    }

    private cleanupSocket (socket: WebSocket): void {
        this.clearPingInterval(socket);
        this.subscriptionCleanups.delete(socket);
    }
}

export const webSocketManager = WebSocketManager.getInstance();