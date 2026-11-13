/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

type SubscriptionHandler = (event: any) => void;

type UnsubscribeFunction = () => void;

type SubscriptionFactory = (nodeId: string, handler: SubscriptionHandler, variables: Record<string, unknown>) => UnsubscribeFunction;

type SubscriptionTypeOptions = {
    /** False for an app-wide subscription, which needs no nodeId (e.g. outside workflow commands). */
    nodeScoped?: boolean;
};

export class WebSocketManager {
    private static instance: WebSocketManager | null = null;

    private activeSubscriptions = new Map<string, Set<WebSocket>>();

    private subscriptionFactories = new Map<string, {factory: SubscriptionFactory; nodeScoped: boolean}>();

    // Per socket, each subscription id's teardown, so a client's "complete" really unsubscribes.
    private subscriptionCleanups = new Map<WebSocket, Map<string, () => void>>();

    private pingIntervals = new Map<WebSocket, ReturnType<typeof setInterval>>();

    private yogaHandler: ((request: Request) => Promise<Response>) | null = null;

    private socketSubscriptions = new Map<WebSocket, Map<string, string>>();

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
            const {socket, response} = Deno.upgradeWebSocket(request, {
                protocol: protocol || undefined
            });

            this.setupSocketHandlers(socket);

            return response;
        } catch (error) {
            console.error('[WebSocketManager] ❌ Failed to upgrade WebSocket:', error);

            throw error;
        }
    }

    private setupSocketHandlers (socket: WebSocket): void {
        this.socketSubscriptions.set(socket, new Map());
        this.subscriptionCleanups.set(socket, new Map());

        const pingInterval = setInterval(() => {
            if (socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({type: 'ping'}));
            } else {
                clearInterval(pingInterval);
                this.pingIntervals.delete(socket);
            }
        }, 30_000);

        this.pingIntervals.set(socket, pingInterval);

        socket.onopen = () => { };

        socket.onmessage = async (event) => {
            try {
                const message = JSON.parse(event.data);

                switch (message.type) {
                    case 'connection_init':
                        socket.send(JSON.stringify({type: 'connection_ack'}));

                        break;

                    case 'subscribe':
                        this.handleSubscribe(socket, message);

                        break;

                    case 'complete':{
                        const subscriptions = this.socketSubscriptions.get(socket);

                        if (subscriptions) {
                            subscriptions.delete(message.id);
                        }

                        this.subscriptionCleanups.get(socket)?.get(message.id)?.();

                        break;
                    }

                    case 'ping':
                        socket.send(JSON.stringify({type: 'pong'}));

                        break;
                }
            } catch {
                console.error('[WebSocketManager] ⚠️ Cannot send error - no subscription ID available');
            }
        };

        socket.onclose = () => {
            this.cleanupSocket(socket);
        };

        socket.onerror = (error) => {
            console.error('[WebSocketManager] ❌ Socket error:', error);
            this.clearPingInterval(socket);
        };
    }

    private handleSubscribe (socket: WebSocket, message: any): void {
        const {id, payload} = message;
        const subscription = this.readSubscription(payload);

        if (typeof subscription === "string") {
            socket.send(JSON.stringify({id, type: 'error', payload: [{message: subscription}]}));

            return;
        }

        const {type, nodeId, factory} = subscription;

        this.trackSubscription(socket, `${type}:${nodeId}`, id);

        const unsubscribe = factory(nodeId, (event) => {
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
        }, payload.variables ?? {});

        this.endWithSocketOrClient(socket, id, unsubscribe);
    }

    /**
     * The subscription a subscribe message asks for: its type (the field the query subscribes to), its node (from the
     * variables, else the query) and the factory that starts it; why it can't be served, otherwise.
     */
    private readSubscription (payload: any): {type: string; nodeId: string; factory: SubscriptionFactory} | string {
        const type = payload.query.match(/subscription[^{]*\{\s*(\w+)\s*\(/)?.[1];
        const nodeIdMatch = payload.variables?.nodeId || payload.query.match(/nodeId:\s*"([^"]+)"/)?.[1];

        if (!type) return 'Invalid subscription query';

        const registered = this.subscriptionFactories.get(type);

        if (!registered) return `Unknown subscription type: ${type}`;

        if (!nodeIdMatch && registered.nodeScoped) return 'Missing nodeId in subscription';

        return {type, nodeId: nodeIdMatch ?? "", factory: registered.factory};
    }

    /** Notes the socket as a subscriber of `key`, under the client's subscription id. */
    private trackSubscription (socket: WebSocket, key: string, id: string): void {
        if (!this.activeSubscriptions.has(key)) {
            this.activeSubscriptions.set(key, new Set());
        }

        this.activeSubscriptions.get(key)!.add(socket);
        this.socketSubscriptions.get(socket)?.set(key, id);
    }

    /** Unsubscribes when the socket closes (telling the client, if it still can, that it's complete), or on the client's own "complete". */
    private endWithSocketOrClient (socket: WebSocket, id: string, unsubscribe: UnsubscribeFunction): void {
        const closeHandler = () => {
            unsubscribe();

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
            unsubscribe();
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

        for (const [key, sockets] of this.activeSubscriptions.entries()) {
            sockets.delete(socket);

            if (sockets.size === 0) {
                this.activeSubscriptions.delete(key);
            }
        }

        this.socketSubscriptions.delete(socket);
        this.subscriptionCleanups.delete(socket);
    }

    getActiveSubscriptions (): Map<string, Set<WebSocket>> {
        return this.activeSubscriptions;
    }
}

export const webSocketManager = WebSocketManager.getInstance();