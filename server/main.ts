import {createYoga} from "npm:graphql-yoga";
import {schema} from "./graphql/schema.ts";
import {BACKEND_PORT} from "../shared/constants.ts";


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
    })
});

const port = BACKEND_PORT;
const hostname = "0.0.0.0";

const loggingFetch = async (request: Request) => {
    const origin = request.headers.get("origin");
    const url = request.url;
    const method = request.method;

    console.log(`[Backend] ${method} ${url} | Origin: ${origin}`);

    return await yoga.fetch(request);
};

Deno.serve({
    hostname,
    port,
}, loggingFetch);

console.log(`Deno server running on http://${hostname}:${port}`);