/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

/** An outside app allowed to call commands, as the app sends it: never the token itself, only its SHA-256. */
export type CommandConnection = {
    name: string;
    tokenHash: string;
    /** The commands it may call; empty means all. */
    commands: string[];
};

/** What the gateway sends the app: a call to run, the cancelling of one whose caller hung up, or a request for the command list. */
export type CommandRequestEvent = {
    type: "request" | "cancel" | "list";
    id: string;
    command?: string;
    /** The payload, JSON-encoded. */
    input?: string;
};

/** A command a caller can run now, as the app lists it. */
export type ListedCommand = {
    command: string;
    description: string;
};

export type CommandResponse = {
    /** The result's payload, JSON-encoded. */
    result?: string | null;
    error?: {code: string; message: string; node?: string | null} | null;
};

type AppListener = {
    connections: CommandConnection[];
    send: (event: CommandRequestEvent) => void;
};

type Pending = {
    app: AppListener;
    finish: (response: CommandResponse | null) => void;
};

/** Who asked: the open app the request goes to, and the caller's connection in it. */
type Caller = {app: AppListener; connection: CommandConnection};

type ForwardOptions = {
    /** Aborts when the caller hangs up. */
    signal: AbortSignal;
    timeoutMs: number;
    /** The timeout error's message. */
    timeoutMessage: string;
};

/** A call started with `Prefer: respond-async`, for a caller that can't wait on one request (a browser extension). */
type Job = {
    /** The connection that started it: only its token can check on it or cancel it. */
    tokenHash: string;
    /** Aborting it cancels the run, as a caller hanging up does. */
    controller: AbortController;
    /** What the call answered, once it has. */
    outcome?: CommandResponse;
    /** While running, cancels it when nobody checks on it; once done, forgets its outcome. */
    timer?: ReturnType<typeof setTimeout>;
};

export type CommandGatewayOptions = {
    /** How long a finished job's outcome is kept for its caller to fetch. */
    keepResultMs?: number;
    /** How long a running job may go unchecked before it counts as abandoned (its caller gone) and is cancelled. */
    abandonAfterMs?: number;
};

// The shape of a call's body, the same as a Data Source node's content; spelled out in every 400 about it.
// eslint-disable-next-line max-len
const EXPECTED_BODY = `It's a Data Source: {"type": "markdown-and-files", "value": {"text": "…", "files": [{"name": "…", "base64": "…", "mimeType": "…", "isToolsPayload": false}]}} or {"type": "json", "value": <any JSON>}.`;
const LIST_PATH = /^\/workflows\/?$/;
const COMMAND_PATH = /^\/workflows\/([a-z0-9][a-z0-9-]*)\/?$/;
const JOB_PATH = /^\/workflows\/jobs\/([0-9a-f-]+)\/?$/;
const KEEP_RESULT_MS = 10 * 60 * 1000;
const ABANDON_AFTER_MS = 2 * 60 * 1000;
// What a running job's caller is told about checking again, in seconds.
const CHECK_AGAIN_AFTER_S = "2";
const SAFETY_TIMEOUT_MS = 20 * 60 * 1000;
// Listing only reads what the app already knows.
const LIST_TIMEOUT_MS = 10 * 1000;
const STATUS_BY_CODE: Record<string, number> = {
    bad_request: 400,
    unauthorized: 401,
    forbidden: 403,
    not_found: 404,
    unknown_command: 404,
    node_failed: 500,
    no_listener: 503,
    busy: 503,
    app_not_open: 503,
    cancelled: 503,
    timeout: 504,
};
const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type, Prefer",
    // The job's address, for a browser page reading the 202.
    "Access-Control-Expose-Headers": "Location, Retry-After",
};

export async function sha256Hex (text: string): Promise<string> {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));

    return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

function json (status: number, body: unknown, headers: Record<string, string> = {}): Response {
    return new Response(JSON.stringify(body), {status, headers: {...CORS_HEADERS, "Content-Type": "application/json", ...headers}});
}

function errorResponse (code: string, message: string, node?: string | null): Response {
    // A busy layer frees up again; a caller can retry.
    const headers: Record<string, string> = code === "busy" ? {"Retry-After": "30"} : {};

    return json(STATUS_BY_CODE[code] ?? 500, {error: {code, message, ...(node ? {node} : {})}}, headers);
}

/** What a call answers: the app's result or error; null when the caller hung up, and nobody is left to read it. */
function callResponse (response: CommandResponse | null): Response {
    if (!response) return new Response(null, {status: 499, headers: CORS_HEADERS});

    if (response.error) return errorResponse(response.error.code, response.error.message, response.error.node);

    return json(200, {result: response.result ? JSON.parse(response.result) as unknown : null});
}

/** A request to the gateway: list the commands, or call one. */
type Route = {kind: "list"} | {kind: "command"; command: string};

/** What the request asks for; undefined for anything but GET /workflows and POST /workflows/<command>. */
function routeOf (method: string, pathname: string): Route | undefined {
    if (method === "GET" && LIST_PATH.test(pathname)) return {kind: "list"};

    const command = COMMAND_PATH.exec(pathname)?.[1];

    return method === "POST" && command ? {kind: "command", command} : undefined;
}

/** The input of a call: its body, a Data Source as JSON and nothing else (the app checks its shape); an error response when it isn't JSON. */
async function callInput (request: Request): Promise<string | Response> {
    const input = await request.text();

    if (!(request.headers.get("content-type") ?? "").includes("application/json")) {
        return errorResponse("bad_request", `Send the input as JSON (Content-Type: application/json). ${EXPECTED_BODY}`);
    }

    try {
        JSON.parse(input);
    } catch {
        return errorResponse("bad_request", `The body isn't valid JSON. ${EXPECTED_BODY}`);
    }

    return input;
}

/** The SHA-256 of the request's bearer token, or "" without one. */
async function bearerTokenHash (request: Request): Promise<string> {
    const token = /^Bearer\s+(\S+)$/i.exec(request.headers.get("authorization") ?? "")?.[1];

    return token ? await sha256Hex(token) : "";
}

/*
 * The door outside apps (Scribe Pal, scripts) use to list and call workflow commands. Workflows run in the app,
 * not here: the gateway checks the caller's token, hands the call to the open app through its
 * subscription, and answers the HTTP request with what the app sends back. The most recently
 * connected app gets the calls; with none open, there is nobody to answer.
 *
 * A caller that can't hold one request open for a whole run (Chrome stops an extension's background worker
 * when a response takes over 30 seconds) asks with `Prefer: respond-async`: it gets a job at once, then
 * checks on it with GET /workflows/jobs/<id> until it answers what the one call would have, or cancels it
 * with DELETE.
 */
export class CommandGateway {
    private readonly apps: AppListener[] = [];
    private readonly pending = new Map<string, Pending>();
    private readonly jobs = new Map<string, Job>();
    private readonly keepResultMs: number;
    private readonly abandonAfterMs: number;

    constructor ({keepResultMs = KEEP_RESULT_MS, abandonAfterMs = ABANDON_AFTER_MS}: CommandGatewayOptions = {}) {
        this.keepResultMs = keepResultMs;
        this.abandonAfterMs = abandonAfterMs;
    }

    /** The app subscribes with its allowed connections; it gets calls until it unsubscribes. */
    connectApp = (connections: CommandConnection[], send: (event: CommandRequestEvent) => void): (() => void) => {
        const app: AppListener = {connections, send};

        this.apps.push(app);

        return () => {
            this.apps.splice(this.apps.indexOf(app), 1);

            for (const pending of [...this.pending.values()]) {
                if (pending.app === app) pending.finish({error: {code: "app_not_open", message: "Agentic Signal closed before answering."}});
            }
        };
    };

    /** The app's answer to a call it was handed. False when that call is no longer waiting. */
    respond = (id: string, response: CommandResponse): boolean => {
        const pending = this.pending.get(id);

        if (!pending) return false;

        pending.finish(response);

        return true;
    };

    handle = async (request: Request): Promise<Response> => {
        if (request.method === "OPTIONS") return new Response(null, {status: 204, headers: CORS_HEADERS});

        const {pathname} = new URL(request.url);
        const jobId = JOB_PATH.exec(pathname)?.[1];

        // A job answers without the app: its outcome may already be here, and its token is known.
        if (jobId && (request.method === "GET" || request.method === "DELETE")) return this.handleJob(request, jobId);

        const route = routeOf(request.method, pathname);

        if (!route) {
            // eslint-disable-next-line max-len
            return errorResponse("not_found", "List the commands with GET /workflows, call one with POST /workflows/<command>, and check on one started with Prefer: respond-async with GET /workflows/jobs/<id>.");
        }

        const caller = await this.caller(request);

        if (caller instanceof Response) return caller;

        if (route.kind === "list") return this.list(caller, request.signal);

        return this.call(request, caller, route.command);
    };

    /** The open app to hand the request to, and the caller's connection in it; an error response when either is missing. */
    private async caller (request: Request): Promise<Caller | Response> {
        const app = this.apps.at(-1);

        if (!app) return errorResponse("app_not_open", "Agentic Signal isn't open, so nothing can answer.");

        const tokenHash = await bearerTokenHash(request);
        const connection = app.connections.find(candidate => candidate.tokenHash === tokenHash);

        if (!connection) {
            return errorResponse("unauthorized", "Missing or unknown token. Add a connection in Agentic Signal's Settings and send its token as: Authorization: Bearer <token>.");
        }

        return {app, connection};
    }

    /** Runs the command for the caller: at once, or as a job to check on when the caller prefers respond-async. */
    private async call (request: Request, {app, connection}: Caller, command: string): Promise<Response> {
        if (connection.commands.length > 0 && !connection.commands.includes(command)) {
            return errorResponse("forbidden", `The "${connection.name}" connection may not call /${command}.`);
        }

        const input = await callInput(request);

        if (input instanceof Response) return input;

        if (/\brespond-async\b/i.test(request.headers.get("prefer") ?? "")) return this.startJob(app, connection, command, input);

        return callResponse(await this.run(app, request.signal, command, input));
    }

    private run (app: AppListener, signal: AbortSignal, command: string, input: string): Promise<CommandResponse | null> {
        return this.forward(app, {type: "request", command, input}, {signal, timeoutMs: SAFETY_TIMEOUT_MS, timeoutMessage: `/${command} took too long and was given up.`});
    }

    /** Hands the call to the app, and answers 202 with the job to check on, at once. */
    private startJob (app: AppListener, connection: CommandConnection, command: string, input: string): Response {
        const id = crypto.randomUUID();
        const job: Job = {tokenHash: connection.tokenHash, controller: new AbortController()};

        this.jobs.set(id, job);
        this.watchForAbandon(id, job);

        void this.run(app, job.controller.signal, command, input).then((outcome) => {
            // Cancelled or abandoned: the job is gone already.
            if (!outcome || this.jobs.get(id) !== job) return;

            job.outcome = outcome;
            clearTimeout(job.timer);
            job.timer = setTimeout(() => this.jobs.delete(id), this.keepResultMs);
        });

        return json(202, {job: id, status: "running"}, {
            "Location": `/workflows/jobs/${id}`,
            "Preference-Applied": "respond-async",
            "Retry-After": CHECK_AGAIN_AFTER_S,
        });
    }

    /** A job's caller checking on it (GET) or cancelling it (DELETE). Another connection's job reads as none. */
    private async handleJob (request: Request, id: string): Promise<Response> {
        const tokenHash = await bearerTokenHash(request);

        if (!tokenHash) return errorResponse("unauthorized", "Missing token. Send the one the job was started with as: Authorization: Bearer <token>.");

        const job = this.jobs.get(id);

        if (!job || job.tokenHash !== tokenHash) {
            // eslint-disable-next-line max-len
            return errorResponse("not_found", `No job ${id}: it may have been cancelled, been left unchecked for over ${this.abandonAfterMs / 1000} s, finished over ${this.keepResultMs / 1000} s ago, or belong to another connection.`);
        }

        if (request.method === "DELETE") {
            this.dropJob(id, job);

            return new Response(null, {status: 204, headers: CORS_HEADERS});
        }

        if (!job.outcome) {
            this.watchForAbandon(id, job);

            return json(202, {status: "running"}, {"Retry-After": CHECK_AGAIN_AFTER_S});
        }

        return callResponse(job.outcome);
    }

    /** (Re)starts the wait after which a running job nobody checks on is cancelled: its caller has gone. */
    private watchForAbandon (id: string, job: Job): void {
        clearTimeout(job.timer);
        job.timer = setTimeout(() => this.dropJob(id, job), this.abandonAfterMs);
    }

    /** Forgets the job, cancelling its run in the app if it's still going. */
    private dropJob (id: string, job: Job): void {
        clearTimeout(job.timer);
        this.jobs.delete(id);

        if (!job.outcome) job.controller.abort();
    }

    /** The commands this connection may call that a layer is listening for now. */
    private async list ({app, connection}: Caller, signal: AbortSignal): Promise<Response> {
        const response = await this.forward(app, {type: "list"}, {signal, timeoutMs: LIST_TIMEOUT_MS, timeoutMessage: "Agentic Signal took too long to list its commands."});

        if (!response) return new Response(null, {status: 499, headers: CORS_HEADERS});

        if (response.error) return errorResponse(response.error.code, response.error.message);

        const parsed: unknown = response.result ? JSON.parse(response.result) : [];
        const listed = Array.isArray(parsed) ? parsed as ListedCommand[] : [];
        const allowed = connection.commands.length > 0 ? listed.filter(({command}) => connection.commands.includes(command)) : listed;

        return json(200, {commands: allowed});
    }

    /**
     * Hands the event to the app and waits for its answer: null when the caller hangs up (the app is told to cancel),
     * a timeout error when the app takes longer than `timeoutMs` (told to cancel too).
     */
    private forward (app: AppListener, event: Omit<CommandRequestEvent, "id">, {signal, timeoutMs, timeoutMessage}: ForwardOptions): Promise<CommandResponse | null> {
        const id = crypto.randomUUID();

        return new Promise((resolve) => {
            const cancelInApp = () => app.send({type: "cancel", id});
            const onHangUp = () => {
                cancelInApp();
                finish(null);
            };
            const timer = setTimeout(() => {
                cancelInApp();
                finish({error: {code: "timeout", message: timeoutMessage}});
            }, timeoutMs);
            const finish = (response: CommandResponse | null) => {
                if (!this.pending.has(id)) return;

                this.pending.delete(id);
                clearTimeout(timer);
                signal.removeEventListener("abort", onHangUp);
                resolve(response);
            };

            this.pending.set(id, {app, finish});
            signal.addEventListener("abort", onHangUp);
            app.send({...event, id});
        });
    }
}

export const commandGateway = new CommandGateway();
