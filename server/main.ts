/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {createYoga} from "npm:graphql-yoga";
import {schema} from "./graphql/schema.ts";
import {BACKEND_PORT} from "../shared/constants.ts";
import {webSocketManager} from "./ws/webSocketManager.ts";


const yoga = createYoga({
    schema,
    cors: {
        origin: [
            'http://localhost:8080',
            'http://127.0.0.1:8080',
            'http://tauri.localhost',
        ],
        credentials: true,
    },
    context: (request) => ({
        request: request.request
    }),
    graphiql: true
});

const port = BACKEND_PORT;
const hostname = "0.0.0.0";

// Set the yoga handler in WebSocketManager
webSocketManager.setYogaHandler(async (request) => await yoga.fetch(request));

Deno.serve({
    hostname,
    port,
    handler: webSocketManager.handleRequest,
    onListen: ({hostname, port}) => {
        console.log(`Deno server running on http://${hostname}:${port}`);
        console.log(`GraphQL HTTP: http://${hostname}:${port}/graphql`);
        console.log(`GraphQL WS: ws://${hostname}:${port}/graphql`);
    }
});