/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

type SubscriptionHandler = (event: any) => void;

type UnsubscribeFunction = () => void;

type SubscriptionFactory = (nodeId: string, handler: SubscriptionHandler) => UnsubscribeFunction;

export class WebSocketManager {
    private static instance: WebSocketManager | null = null;

    private activeSubscriptions = new Map<string, Set<WebSocket>>();

    private subscriptionFactories = new Map<string, SubscriptionFactory>();

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

    registerSubscriptionType (type: string, factory: SubscriptionFactory): void {
        this.subscriptionFactories.set(type, factory);
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
        };
    }

    private handleSubscribe (socket: WebSocket, message: any): void {
        const {id, payload} = message;
        const subscriptionMatch = payload.query.match(/subscription[^{]*\{\s*(\w+)\s*\(/);
        const subscriptionType = subscriptionMatch?.[1];
        const nodeIdMatch = payload.variables?.nodeId || payload.query.match(/nodeId:\s*"([^"]+)"/)?.[1];

        if (!subscriptionType) {
            socket.send(JSON.stringify({
                id,
                type: 'error',
                payload: [{message: 'Invalid subscription query'}]
            }));

            return;
        }

        if (!nodeIdMatch) {
            socket.send(JSON.stringify({
                id,
                type: 'error',
                payload: [{message: 'Missing nodeId in subscription'}]
            }));

            return;
        }

        const nodeId = nodeIdMatch;
        const factory = this.subscriptionFactories.get(subscriptionType);

        if (!factory) {
            socket.send(JSON.stringify({
                id,
                type: 'error',
                payload: [{message: `Unknown subscription type: ${subscriptionType}`}]
            }));

            return;
        }

        const subscriptionKey = `${subscriptionType}:${nodeId}`;

        if (!this.activeSubscriptions.has(subscriptionKey)) {
            this.activeSubscriptions.set(subscriptionKey, new Set());
        }

        this.activeSubscriptions.get(subscriptionKey)!.add(socket);

        const socketSubs = this.socketSubscriptions.get(socket);

        if (socketSubs) {
            socketSubs.set(subscriptionKey, id);
        }

        const unsubscribe = factory(nodeId, (event) => {
            if (socket.readyState !== WebSocket.OPEN) {
                return;
            }

            socket.send(JSON.stringify({
                id,
                type: 'next',
                payload: {
                    data: {
                        [subscriptionType]: event
                    }
                }
            }));
        });

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
    }

    private cleanupSocket (socket: WebSocket): void {
        for (const [key, sockets] of this.activeSubscriptions.entries()) {
            sockets.delete(socket);

            if (sockets.size === 0) {
                this.activeSubscriptions.delete(key);
            }
        }

        this.socketSubscriptions.delete(socket);
    }

    getActiveSubscriptions (): Map<string, Set<WebSocket>> {
        return this.activeSubscriptions;
    }
}

export const webSocketManager = WebSocketManager.getInstance();