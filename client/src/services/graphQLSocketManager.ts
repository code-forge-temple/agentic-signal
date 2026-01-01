import {createClient, Client, SubscribePayload} from "graphql-ws";
import {graphqlBaseUrl} from "../utils/utils";
import {BACKEND_PORT} from "@shared/constants";

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

        if (wsUrl.startsWith("/")) {
            wsUrl = `${window.location.protocol === "https:" ? "wss:" : "ws:"}//localhost:${BACKEND_PORT}${wsUrl}`;
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
            try { this.client.dispose(); } catch { /* Ignore */ }

            this.client = null;
        }
    }
}