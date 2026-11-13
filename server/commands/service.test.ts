/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {CommandGateway, CommandGatewayOptions, CommandRequestEvent, sha256Hex} from "./service.ts";

// Hand-rolled, like keyedLock.test.ts: the server has no test dependencies.
function assertEquals<T> (actual: T, expected: T): void {
    const a = JSON.stringify(actual);
    const b = JSON.stringify(expected);

    if (a !== b) throw new Error(`Expected ${b}, got ${a}`);
}

const TOKEN = "as_test_token";

/** A gateway with one app connected, allowed `commands` (empty: all); `events` collects what the app is sent. */
async function connectedGateway (commands: string[] = [], options: CommandGatewayOptions = {}) {
    const gateway = new CommandGateway(options);
    const events: CommandRequestEvent[] = [];
    const disconnect = gateway.connectApp([{name: "Scribe Pal", tokenHash: await sha256Hex(TOKEN), commands}], event => events.push(event));

    return {gateway, events, disconnect};
}

type CallOptions = {token?: string | null; body?: string; type?: string; signal?: AbortSignal};

function call (command: string, {token = TOKEN, body = "\"hi\"", type = "application/json", signal}: CallOptions = {}) {
    return new Request(`http://localhost:8001/workflows/${command}`, {
        method: "POST",
        headers: {"Content-Type": type, ...(token ? {Authorization: `Bearer ${token}`} : {})},
        body,
        signal,
    });
}

function list (token: string | null = TOKEN) {
    return new Request("http://localhost:8001/workflows", {method: "GET", headers: token ? {Authorization: `Bearer ${token}`} : {}});
}

/** Waits until the app has been sent `count` events. */
async function sent (events: CommandRequestEvent[], count: number): Promise<void> {
    for (let i = 0; i < 100 && events.length < count; i++) await new Promise(resolve => setTimeout(resolve, 5));
}

Deno.test("answers 503 app_not_open when no app is connected", async () => {
    const response = await new CommandGateway().handle(call("echo"));

    assertEquals(response.status, 503);
    assertEquals((await response.json()).error.code, "app_not_open");
});

Deno.test("answers 401 without a token or with an unknown one", async () => {
    const {gateway} = await connectedGateway();

    assertEquals((await gateway.handle(call("echo", {token: null}))).status, 401);
    assertEquals((await gateway.handle(call("echo", {token: "as_wrong"}))).status, 401);
});

Deno.test("answers 403 for a command the connection may not call", async () => {
    const {gateway} = await connectedGateway(["research"]);
    const response = await gateway.handle(call("echo"));

    assertEquals(response.status, 403);
    assertEquals((await response.json()).error.code, "forbidden");
});

Deno.test("hands the call to the app and answers 200 with its result", async () => {
    const {gateway, events} = await connectedGateway();
    const pending = gateway.handle(call("echo", {body: "{\"text\":\"hi\"}"}));

    await sent(events, 1);
    assertEquals(events[0].type, "request");
    assertEquals(events[0].command, "echo");
    assertEquals(events[0].input, "{\"text\":\"hi\"}");

    gateway.respond(events[0].id, {result: "\"HI\""});

    const response = await pending;

    assertEquals(response.status, 200);
    assertEquals(response.headers.get("access-control-allow-origin"), "*");
    assertEquals(await response.json(), {result: "HI"});
});

Deno.test("refuses a body that isn't JSON (a Data Source as JSON is the only input), without asking the app", async () => {
    const {gateway, events} = await connectedGateway();
    const response = await gateway.handle(call("echo", {body: "just text", type: "text/plain"}));
    const body = await response.json();

    assertEquals(response.status, 400);
    assertEquals(body.error.code, "bad_request");

    if (!body.error.message.includes('"markdown-and-files"')) throw new Error(`The error should show the expected shape: ${body.error.message}`);

    assertEquals(events.length, 0);
});

Deno.test("maps the app's errors to HTTP statuses, naming the failed node", async () => {
    const cases: [string, number][] = [["unknown_command", 404], ["no_listener", 503], ["busy", 503], ["node_failed", 500], ["timeout", 504]];

    for (const [code, status] of cases) {
        const {gateway, events} = await connectedGateway();
        const pending = gateway.handle(call("echo"));

        await sent(events, 1);
        gateway.respond(events[0].id, {error: {code, message: "nope", node: code === "node_failed" ? "HTTP Request" : null}});

        const response = await pending;
        const body = await response.json();

        assertEquals(response.status, status);
        assertEquals(body.error.code, code);

        if (code === "node_failed") assertEquals(body.error.node, "HTTP Request");

        if (code === "busy") assertEquals(response.headers.get("retry-after"), "30");
    }
});

Deno.test("answers 400 for a JSON body that isn't JSON", async () => {
    const {gateway} = await connectedGateway();

    assertEquals((await gateway.handle(call("echo", {body: "{oops"}))).status, 400);
});

Deno.test("lists the commands the app's layers listen for, only those the connection may call", async () => {
    const {gateway, events} = await connectedGateway(["research", "summarize"]);
    const pending = gateway.handle(list());

    await sent(events, 1);
    assertEquals(events[0].type, "list");
    gateway.respond(events[0].id, {result: JSON.stringify([
        {command: "echo", description: "Shouts back."},
        {command: "research", description: "Researches a topic."},
    ])});

    const response = await pending;

    assertEquals(response.status, 200);
    assertEquals(await response.json(), {commands: [{command: "research", description: "Researches a topic."}]});
});

Deno.test("listing needs a known token too", async () => {
    const {gateway, events} = await connectedGateway();

    assertEquals((await gateway.handle(list(null))).status, 401);
    assertEquals((await gateway.handle(list("as_wrong"))).status, 401);
    assertEquals(events.length, 0);
});

Deno.test("answers 404 for anything but GET /workflows and POST /workflows/<command>, and 204 to a preflight", async () => {
    const {gateway} = await connectedGateway();

    assertEquals((await gateway.handle(new Request("http://localhost:8001/other", {method: "POST"}))).status, 404);
    assertEquals((await gateway.handle(new Request("http://localhost:8001/workflows/echo", {method: "GET"}))).status, 404);
    assertEquals((await gateway.handle(new Request("http://localhost:8001/workflows", {method: "POST"}))).status, 404);
    assertEquals((await gateway.handle(new Request("http://localhost:8001/workflows/echo", {method: "OPTIONS"}))).status, 204);
});

Deno.test("hands nothing to the app when the caller hung up before the call got to it", async () => {
    const {gateway, events} = await connectedGateway();
    const hangUp = new AbortController();

    hangUp.abort();

    const response = await gateway.handle(call("echo", {signal: hangUp.signal}));

    assertEquals(response.status, 499);
    assertEquals(events, []);

    // Asked as a job too: no job is started for a caller who can't check on it.
    const job = new Request("http://localhost:8001/workflows/echo", {
        method: "POST",
        headers: {"Content-Type": "application/json", "Authorization": `Bearer ${TOKEN}`, "Prefer": "respond-async"},
        body: "\"hi\"",
        signal: hangUp.signal,
    });

    assertEquals((await gateway.handle(job)).status, 499);
    assertEquals(events, []);
});

Deno.test("answers 499 to a caller who drops while sending the body, and hands the app nothing", async () => {
    const {gateway, events} = await connectedGateway();
    const dropped = new Request("http://localhost:8001/workflows/echo", {
        method: "POST",
        headers: {"Content-Type": "application/json", "Authorization": `Bearer ${TOKEN}`},
        body: new ReadableStream({start: controller => controller.error(new Error("connection reset"))}),
    });

    assertEquals((await gateway.handle(dropped)).status, 499);
    assertEquals(events, []);
});

Deno.test("tells the app to cancel when the caller hangs up", async () => {
    const {gateway, events} = await connectedGateway();
    const hangUp = new AbortController();
    const pending = gateway.handle(call("echo", {signal: hangUp.signal}));

    await sent(events, 1);
    hangUp.abort();
    await pending;

    assertEquals(events.map(e => e.type), ["request", "cancel"]);
    assertEquals(events[1].id, events[0].id);
    assertEquals(gateway.respond(events[0].id, {result: "\"late\""}), false);
});

Deno.test("answers 503 app_not_open when the app closes before answering", async () => {
    const {gateway, events, disconnect} = await connectedGateway();
    const pending = gateway.handle(call("echo"));

    await sent(events, 1);
    disconnect();

    const response = await pending;

    assertEquals(response.status, 503);
    assertEquals((await response.json()).error.code, "app_not_open");
});

// Jobs: a call started with Prefer: respond-async, then checked on (GET) or cancelled (DELETE).

function startJob (command = "echo", token = TOKEN) {
    const request = call(command, {token, body: "{\"text\":\"hi\"}"});

    request.headers.set("Prefer", "respond-async");

    return request;
}

function job (id: string, method: "GET" | "DELETE" = "GET", token: string | null = TOKEN) {
    return new Request(`http://localhost:8001/workflows/jobs/${id}`, {method, headers: token ? {Authorization: `Bearer ${token}`} : {}});
}

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

Deno.test("Prefer: respond-async answers 202 with a job at once, running until the app answers, then what the one call would have", async () => {
    const {gateway, events} = await connectedGateway();
    const started = await gateway.handle(startJob());
    const {job: id} = await started.json();

    assertEquals(started.status, 202);
    assertEquals(started.headers.get("location"), `/workflows/jobs/${id}`);
    assertEquals(started.headers.get("preference-applied"), "respond-async");
    assertEquals([events.length, events[0].type, events[0].command, events[0].input], [1, "request", "echo", "{\"text\":\"hi\"}"]);

    const running = await gateway.handle(job(id));

    assertEquals([running.status, await running.json(), running.headers.get("retry-after")], [202, {status: "running"}, "2"]);

    gateway.respond(events[0].id, {result: "\"HI\""});
    await wait(0);

    const done = await gateway.handle(job(id));

    assertEquals([done.status, await done.json()], [200, {result: "HI"}]);
    // Kept, should the answer to a check get lost on the way.
    assertEquals((await gateway.handle(job(id))).status, 200);
    // Done: forgetting it tells the app nothing.
    assertEquals((await gateway.handle(job(id, "DELETE"))).status, 204);
    assertEquals(events.length, 1);
});

Deno.test("a job that fails answers the same error the one call would have", async () => {
    const {gateway, events} = await connectedGateway();
    const {job: id} = await (await gateway.handle(startJob())).json();

    gateway.respond(events[0].id, {error: {code: "node_failed", message: "HTTP 404", node: "GET Data"}});
    await wait(0);

    const failed = await gateway.handle(job(id));

    assertEquals([failed.status, await failed.json()], [500, {error: {code: "node_failed", message: "HTTP 404", node: "GET Data"}}]);
    await gateway.handle(job(id, "DELETE"));
});

Deno.test("DELETE cancels a running job: the app is told, and the job is gone", async () => {
    const {gateway, events} = await connectedGateway();
    const {job: id} = await (await gateway.handle(startJob())).json();

    assertEquals((await gateway.handle(job(id, "DELETE"))).status, 204);
    assertEquals([events[1]?.type, events[1]?.id], ["cancel", events[0].id]);
    assertEquals((await gateway.handle(job(id))).status, 404);
    // The app answering late changes nothing.
    assertEquals(gateway.respond(events[0].id, {result: "\"late\""}), false);
});

Deno.test("only the token that started a job can check on it or cancel it", async () => {
    const gateway = new CommandGateway();
    const events: CommandRequestEvent[] = [];

    gateway.connectApp([
        {name: "Scribe Pal", tokenHash: await sha256Hex(TOKEN), commands: []},
        {name: "Script", tokenHash: await sha256Hex("as_other"), commands: []},
    ], event => events.push(event));

    const {job: id} = await (await gateway.handle(startJob())).json();

    assertEquals((await gateway.handle(job(id, "GET", "as_other"))).status, 404);
    assertEquals((await gateway.handle(job(id, "DELETE", "as_other"))).status, 404);
    assertEquals((await gateway.handle(job(id, "GET", null))).status, 401);
    assertEquals(events.length, 1);
    assertEquals((await gateway.handle(job(id, "DELETE"))).status, 204);
});

Deno.test("a running job nobody checks on is cancelled: its caller has gone", async () => {
    const {gateway, events} = await connectedGateway([], {abandonAfterMs: 30});
    const {job: id} = await (await gateway.handle(startJob())).json();

    await wait(80);
    assertEquals(events[1]?.type, "cancel");
    assertEquals((await gateway.handle(job(id))).status, 404);
});

Deno.test("checking on a job keeps it going", async () => {
    const {gateway, events} = await connectedGateway([], {abandonAfterMs: 60});
    const {job: id} = await (await gateway.handle(startJob())).json();

    for (let i = 0; i < 5; i++) {
        await wait(25);
        assertEquals((await gateway.handle(job(id))).status, 202);
    }

    assertEquals(events.length, 1);
    await gateway.handle(job(id, "DELETE"));
});

Deno.test("a finished job is forgotten after a while", async () => {
    const {gateway, events} = await connectedGateway([], {keepResultMs: 30});
    const {job: id} = await (await gateway.handle(startJob())).json();

    gateway.respond(events[0].id, {result: "\"HI\""});
    await wait(80);
    assertEquals((await gateway.handle(job(id))).status, 404);
});

Deno.test("the app closing ends a running job with app_not_open, still there to be read", async () => {
    const {gateway, disconnect} = await connectedGateway();
    const {job: id} = await (await gateway.handle(startJob())).json();

    disconnect();
    await wait(0);

    const closed = await gateway.handle(job(id));

    assertEquals([closed.status, (await closed.json()).error.code], [503, "app_not_open"]);
    await gateway.handle(job(id, "DELETE"));
});

Deno.test("browsers may cancel jobs and ask for them, and read where the job is", async () => {
    const {gateway} = await connectedGateway();
    const preflight = await gateway.handle(new Request("http://localhost:8001/workflows/jobs/abc", {method: "OPTIONS"}));

    assertEquals(preflight.headers.get("access-control-allow-methods")?.includes("DELETE"), true);
    assertEquals(preflight.headers.get("access-control-allow-headers")?.includes("Prefer"), true);
    assertEquals(preflight.headers.get("access-control-expose-headers")?.includes("Location"), true);
});
