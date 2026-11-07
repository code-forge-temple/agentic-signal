import {createClient, Client, SubscribePayload} from "graphql-ws";
import {graphqlBaseUrl} from "../utils/utils";

export class GraphQLSocketManager {
    private static instance: GraphQLSocketManager | null = null;
    private client: Client | null = null;

    private constructor () {}

    static getInstance (): GraphQLSocketManager {
        if (!GraphQLSocketManager.instance) {
            GraphQLSocketManager.instance = new GraphQLSocketManager();
        }

        return GraphQLSocketManager.instance;
    }

    connect (): Client {
        if (this.client) return this.client;

        let wsUrl = graphqlBaseUrl;

        // The page's own host, the way its requests go: the dev server passes the connection on to the backend.
        // "localhost" would be the computer the browser runs on, which isn't the backend's when the app is
        // opened from another one (the backend on a Jetson, the browser on a PC).
        if (wsUrl.startsWith("/")) {
            wsUrl = `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}${wsUrl}`;
        } else {
            wsUrl = wsUrl.replace(/^http/, "ws");
        }

        this.client = createClient({
            url: wsUrl,
            keepAlive: 12000,
        });

        return this.client;
    }

    subscribe<T = any> (
        payload: SubscribePayload,
        next: (data: T) => void,
        error?: (err: unknown) => void,
        complete?: () => void
    ): () => void {
        const client = this.connect();
        const unsubscribe = client.subscribe<T>(payload, {
            next: (result) => {
                if (result.data) {
                    next(result.data);
                }

                if (result.errors) {
                    error?.(result.errors);
                }
            },
            error: (err) => error?.(err),
            complete: () => complete?.(),
        });

        return typeof unsubscribe === "function" ? unsubscribe : () => {};
    }

    dispose () {
        if (this.client) {
            // dispose() may throw or return a promise that rejects; ignore both
            try { Promise.resolve(this.client.dispose()).catch(() => { /* Ignore */ }); } catch { /* Ignore */ }

            this.client = null;
        }
    }
}