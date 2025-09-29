/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {createYoga} from "npm:graphql-yoga";
import {schema} from "./graphql/schema.ts";
import * as browserServices from "./services/browserService.ts";
import * as emailServices from "./services/emailService.ts";
import * as cloudStorageServices from "./services/cloudStorageService.ts";
import * as calendarServices from "./services/calendarService.ts";
import * as timezoneServices from "./services/timezoneService.ts";
import {BACKEND_PORT} from "../shared/constants.ts";


const yoga = createYoga({
    schema,
    cors: {
        origin: [
            'http://localhost:5173',
            'http://127.0.0.1:5173',
            'http://tauri.localhost',
        ],
        credentials: true,
    },
    context: (request) => ({
        services: {
            ...browserServices,
            ...emailServices,
            ...cloudStorageServices,
            ...calendarServices,
            ...timezoneServices,
        },
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