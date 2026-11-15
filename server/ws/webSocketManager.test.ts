/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {webSocketManager} from "./webSocketManager.ts";

// Hand-rolled, like keyedLock.test.ts: the server has no test dependencies.
function assertEquals<T> (actual: T, expected: T): void {
    const a = JSON.stringify(actual);
    const b = JSON.stringify(expected);

    if (a !== b) throw new Error(`Expected ${b}, got ${a}`);
}

/** A socket that records what's sent to it, with the handlers the manager sets on it. */
class FakeSocket extends EventTarget {
    readyState: number = WebSocket.OPEN;
    sent: unknown[] = [];
    onmessage: ((event: {data: string}) => Promise<void>) | null = null;
    onclose: (() => void) | null = null;
    onerror: ((error: unknown) => void) | null = null;
    onopen: (() => void) | null = null;

    send (data: string): void {
        this.sent.push(JSON.parse(data));
    }

    receive (message: unknown): Promise<void> {
        return this.onmessage!({data: JSON.stringify(message)});
    }

    close (): void {
        this.readyState = WebSocket.CLOSED;
        this.onclose?.();
        this.dispatchEvent(new Event("close"));
    }
}

type Handler = (event: unknown) => void;

// The node-scoped "ticks" and the app-wide "news" subscriptions, keeping each subscriber's handler and teardown.
const subscribers: {
    nodeId: string;
    handler: Handler;
    variables: Record<string, unknown>;
    unsubscribed: boolean;
    socket?: number;
    endedBy?: string;
}[] = [];

webSocketManager.registerSubscriptionType("ticks", (nodeId, handler, variables) => {
    const subscriber = {nodeId, handler, variables, unsubscribed: false};

    subscribers.push(subscriber);

    return () => {
        subscriber.unsubscribed = true;
    };
});
// A subscription that can't start, as a timer's can't before the timer does.
webSocketManager.registerSubscriptionType("stopped", (nodeId) => {
    throw new Error(`Timer ${nodeId} not found. Start the timer before subscribing.`);
});
webSocketManager.registerSubscriptionType("news", (nodeId, handler, variables, {socket}) => {
    const subscriber = {nodeId, handler, variables, unsubscribed: false, socket, endedBy: ""};

    subscribers.push(subscriber);

    return (reason) => {
        subscriber.unsubscribed = true;
        subscriber.endedBy = reason;
    };
}, {nodeScoped: false});

function connect (): FakeSocket {
    const socket = new FakeSocket();

    (webSocketManager as unknown as {setupSocketHandlers: (socket: unknown) => void}).setupSocketHandlers(socket);

    return socket;
}

const subscribe = (socket: FakeSocket, id: string, query: string, variables?: Record<string, unknown>) =>
    socket.receive({type: "subscribe", id, payload: {query, variables}});

Deno.test("WebSocket: acknowledges a connection and answers a ping", async () => {
    const socket = connect();

    await socket.receive({type: "connection_init"});
    await socket.receive({type: "ping"});

    assertEquals(socket.sent, [{type: "connection_ack"}, {type: "pong"}]);
    socket.close();
});

Deno.test("WebSocket: turns down a query it can't read, an unknown type, and a node subscription without a node", async () => {
    const socket = connect();

    await subscribe(socket, "1", "query { nothing }");
    await subscribe(socket, "2", "subscription { unknownThing(x: 1) { a } }");
    await subscribe(socket, "3", "subscription { ticks(interval: 5) { at } }");

    assertEquals(socket.sent, [
        {id: "1", type: "error", payload: [{message: "Invalid subscription query"}]},
        {id: "2", type: "error", payload: [{message: "Unknown subscription type: unknownThing"}]},
        {id: "3", type: "error", payload: [{message: "Missing nodeId in subscription"}]},
    ]);
    socket.close();
});

Deno.test("WebSocket: passes a subscription's events on while open, and ends it when the socket closes", async () => {
    const socket = connect();
    const before = subscribers.length;

    await subscribe(socket, "7", "subscription($nodeId: String!) { ticks(nodeId: $nodeId) { at } }", {nodeId: "n1"});

    const subscriber = subscribers[before];

    assertEquals([subscriber.nodeId, subscriber.variables], ["n1", {nodeId: "n1"}]);

    subscriber.handler({at: 1});
    assertEquals(socket.sent, [{id: "7", type: "next", payload: {data: {ticks: {at: 1}}}}]);

    socket.close();
    subscriber.handler({at: 2});

    assertEquals(subscriber.unsubscribed, true);
    assertEquals(socket.sent.length, 1);
});

Deno.test("WebSocket: reads the node from the query when there's no variable; an app-wide one needs none", async () => {
    const socket = connect();
    const before = subscribers.length;

    await subscribe(socket, "8", "subscription { ticks(nodeId: \"n2\") { at } }");
    await subscribe(socket, "9", "subscription { news(topic: \"x\") { text } }");

    assertEquals(subscribers.slice(before).map(s => s.nodeId), ["n2", ""]);
    socket.close();
});

Deno.test("WebSocket: the client's own complete unsubscribes at once", async () => {
    const socket = connect();
    const before = subscribers.length;

    await subscribe(socket, "10", "subscription { news(topic: \"x\") { text } }");
    await socket.receive({type: "complete", id: "10"});

    assertEquals(subscribers[before].unsubscribed, true);

    // Closing later sends no "complete" for it: it's over already.
    socket.close();
    assertEquals(socket.sent, []);
});

Deno.test("WebSocket: a subscription learns its socket's number, and whether the client or the socket ended it", async () => {
    const first = connect();
    const second = connect();
    const before = subscribers.length;

    await subscribe(first, "11", "subscription { news(topic: \"x\") { text } }");
    await subscribe(second, "12", "subscription { news(topic: \"y\") { text } }");
    await first.receive({type: "complete", id: "11"});
    second.close();

    const [unsubscribed, closed] = subscribers.slice(before);

    assertEquals([unsubscribed.endedBy, closed.endedBy], ["unsubscribed", "connection closed"]);
    assertEquals(typeof unsubscribed.socket === "number" && unsubscribed.socket !== closed.socket, true);
    first.close();
});

Deno.test("WebSocket: a message that isn't JSON is logged, not thrown", async () => {
    const socket = connect();
    const errors: unknown[] = [];
    const realError = console.error;

    console.error = (...args: unknown[]) => errors.push(args);

    try {
        await socket.onmessage!({data: "not json"});
    } finally {
        console.error = realError;
    }

    assertEquals(errors.length, 1);
    socket.close();
});

Deno.test("WebSocket: a subscription that can't start tells the client why, under its id", async () => {
    const socket = connect();

    await subscribe(socket, "11", "subscription { stopped(nodeId: \"t9\") { at } }");
    await socket.receive({type: "subscribe", id: "12", payload: {}});

    assertEquals(socket.sent, [
        {id: "11", type: "error", payload: [{message: "Timer t9 not found. Start the timer before subscribing."}]},
        {id: "12", type: "error", payload: [{message: "Invalid subscription query"}]},
    ]);
    socket.close();
});
