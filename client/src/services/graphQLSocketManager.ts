import {createClient, Client, SubscribePayload} from "graphql-ws";
import {graphqlBaseUrl, isRecord} from "../utils/utils";

/**
 * A subscription's failure as an Error with a readable message: graphql-ws hands the server's errors over as an array
 * of {message}, which a node showing `error.message` would print as "[object Object]". Anything else, as it is.
 */
export function subscriptionError (err: unknown): unknown {
    if (!Array.isArray(err)) return err;

    return new Error(err.map(item => (isRecord(item) && typeof item.message === "string" ? item.message : String(item))).join("; "));
}

const MAX_RECONNECT_WAIT_MS = 5_000;

/**
 * How long to wait before reconnect attempt `retries` (0 first): 1 s, 2 s, 4 s, then every 5 s, each with up to half a
 * second more (`random` in [0, 1)), so open tabs don't all knock at the same moment.
 */
export function reconnectDelayMs (retries: number, random: number = Math.random()): number {
    return Math.min(1000 * 2 ** retries, MAX_RECONNECT_WAIT_MS) + Math.floor(random * 500);
}

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
            // Keeps trying for as long as the backend isn't there: the desktop app opens its window before its
            // backend listens, and a backend can restart. By default graphql-ws gives up on a refused connection at
            // once (it counts the socket's error event as fatal, and retries only clean closes, 5 times), which left
            // the app's outside-calls subscription dead from the desktop app's start.
            retryAttempts: Infinity,
            shouldRetry: () => true,
            retryWait: (retries) => new Promise(resolve => setTimeout(resolve, reconnectDelayMs(retries))),
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
                    error?.(subscriptionError(result.errors));
                }
            },
            error: (err) => error?.(subscriptionError(err)),
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