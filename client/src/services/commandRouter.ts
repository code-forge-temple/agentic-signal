/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {NodeEnvelope} from "../types/workflow";
import {AI_LAYER} from "../context/LayersContextBase";


/** Who called: the AI Buddy chat runs on the AI Buddy layer only; outside callers on the user's layers only. */
export type CommandSource = "chat" | "outside";

export type CommandNodeError = {
    nodeId: string;
    nodeType: string;
    nodeTitle: string;
    message: string;
};

export type CommandErrorCode = "no_listener" | "busy" | "node_failed" | "timeout" | "cancelled";

/** Why a command ended without a result. `node` is set when a node's error ended it. */
export class CommandError extends Error {
    readonly code: CommandErrorCode;
    readonly node?: CommandNodeError;

    constructor (code: CommandErrorCode, message: string, node?: CommandNodeError) {
        super(message);
        this.name = "CommandError";
        this.code = code;
        this.node = node;
    }

    get cancelled (): boolean {
        return this.code === "cancelled";
    }
}

export type LayerCommandState =
    | {status: "idle"}
    | {status: "serving"; command: string}
    | {status: "succeeded"; command: string}
    | {status: "failed"; command: string; error: CommandError};

export type CommandRequest = {
    command: string;
    input: NodeEnvelope;
    source: CommandSource;
    /** The workflow is being replaced for this request: only a Workflow Input that starts listening after the call counts. */
    awaitNewListener?: boolean;
    /** Aborting cancels the request, waiting or running (Stop in the chat, a caller hanging up). */
    signal?: AbortSignal;
    /** How long it may wait for a listening layer to be free (or, with awaitNewListener, to appear). */
    queueTimeoutMs?: number;
    /** How long it may run once a layer took it. */
    runTimeoutMs?: number;
};

/** A command a caller can reach right now, as `GET /workflows` lists it. */
export type ListedCommand = {
    command: string;
    description: string;
};

type Listener = {
    layerId: string;
    command: string;
    deliver: (input: NodeEnvelope) => void;
    // Read when listed, so editing the description doesn't restart the listening.
    describe: () => string;
    // Subscription order: lets a request wait for a listener mounted after it was made.
    order: number;
};

type Request = {
    command: string;
    input: NodeEnvelope;
    source: CommandSource;
    listenersAfter: number;
    resolve: (result: NodeEnvelope) => void;
    reject: (error: CommandError) => void;
    timer: ReturnType<typeof setTimeout>;
    runTimeoutMs: number;
    layerId?: string;
    listener?: Listener;
    detachSignal?: () => void;
};

const DEFAULT_QUEUE_TIMEOUT_MS = 5 * 60 * 1000;
const DEFAULT_RUN_TIMEOUT_MS = 10 * 60 * 1000;
const IDLE: LayerCommandState = {status: "idle"};

/*
 * Every workflow command goes through here, whoever calls it. Workflow Input nodes listen for a
 * command in their layer; a request goes to a free layer listening for its command, or waits in a
 * queue. A layer serves one request at a time, and that is how a result finds its caller: Workflow
 * Output and the nodes' error logging report through their layer, never with a request id, and the
 * router knows which request that layer is serving. Reports from a layer serving nothing are dropped.
 */
export class CommandRouter {
    private static instance: CommandRouter | null = null;

    private readonly listeners = new Set<Listener>();
    private listenerCount = 0;
    // In arrival order; a request leaves it when a layer takes it.
    private readonly waiting: Request[] = [];
    private readonly serving = new Map<string, Request>();
    private readonly layerStates = new Map<string, LayerCommandState>();
    private readonly stateListeners = new Set<() => void>();
    private dispatchScheduled = false;

    static getInstance (): CommandRouter {
        if (!CommandRouter.instance) {
            CommandRouter.instance = new CommandRouter();
        }

        return CommandRouter.instance;
    }

    /** A Workflow Input listens for `command` in `layerId` until it calls the returned function. */
    listen = (layerId: string, command: string, deliver: (input: NodeEnvelope) => void, describe: () => string = () => ""): (() => void) => {
        const listener: Listener = {layerId, command, deliver, describe, order: ++this.listenerCount};

        this.listeners.add(listener);
        this.scheduleDispatch();

        return () => {
            this.listeners.delete(listener);

            // The workflow it started can no longer answer (Stop pressed, or the layer closed).
            const request = this.serving.get(layerId);

            if (request?.listener === listener) {
                this.finish(request, new CommandError("cancelled", "The workflow stopped before it answered."));
            }
        };
    };

    /** Resolves with what reached the serving layer's Workflow Output; rejects with a CommandError. */
    request = ({
        command,
        input,
        source,
        awaitNewListener = false,
        signal,
        queueTimeoutMs = DEFAULT_QUEUE_TIMEOUT_MS,
        runTimeoutMs = DEFAULT_RUN_TIMEOUT_MS,
    }: CommandRequest): Promise<NodeEnvelope> => new Promise((resolve, reject) => {
        const request: Request = {
            command,
            input,
            source,
            // Taken now, before React mounts the replaced workflow's nodes.
            listenersAfter: awaitNewListener ? this.listenerCount : 0,
            resolve,
            reject,
            runTimeoutMs,
            timer: setTimeout(() => this.giveUpWaiting(request), queueTimeoutMs),
        };

        if (signal?.aborted) {
            clearTimeout(request.timer);
            reject(new CommandError("cancelled", "Stopped."));

            return;
        }

        // The queue is for listeners that are busy, not for ones that don't exist.
        if (!awaitNewListener && !this.hasListener(request)) {
            clearTimeout(request.timer);
            reject(new CommandError("no_listener", `No layer is listening for /${command}.`));

            return;
        }

        if (signal) {
            const abort = () => this.cancel(request);

            signal.addEventListener("abort", abort, {once: true});
            request.detachSignal = () => signal.removeEventListener("abort", abort);
        }

        this.waiting.push(request);
        this.scheduleDispatch();
    });

    /** Called by Workflow Output, through its layer. */
    reportResult = (layerId: string, result: NodeEnvelope): void => {
        const request = this.serving.get(layerId);

        if (request) this.finish(request, result);
    };

    /** Called by a node's error logging, through its layer. The first error ends the request. */
    reportError = (layerId: string, node: CommandNodeError): void => {
        const request = this.serving.get(layerId);

        if (request) this.finish(request, new CommandError("node_failed", `${node.nodeTitle}: ${node.message}`, node));
    };

    /** The commands a `source` caller can reach now, busy or not: once each, by name, with the first description found. */
    listedCommands = (source: CommandSource): ListedCommand[] => {
        const byCommand = new Map<string, ListedCommand>();

        for (const listener of this.listeners) {
            if (!this.reachableBy(listener, source)) continue;

            const listed = byCommand.get(listener.command) ?? {command: listener.command, description: ""};

            listed.description ||= listener.describe().trim();
            byCommand.set(listener.command, listed);
        }

        return [...byCommand.values()].sort((a, b) => a.command.localeCompare(b.command));
    };

    getLayerState = (layerId: string): LayerCommandState => this.layerStates.get(layerId) ?? IDLE;

    /** For useSyncExternalStore: the listener runs whenever a layer's state changes. */
    subscribe = (listener: () => void): (() => void) => {
        this.stateListeners.add(listener);

        return () => {
            this.stateListeners.delete(listener);
        };
    };

    // The two kinds of caller never meet: the chat stays on the AI Buddy layer, outside callers off it.
    private reachableBy (listener: Listener, source: CommandSource): boolean {
        return source === "chat" ? listener.layerId === AI_LAYER.id : listener.layerId !== AI_LAYER.id;
    }

    private matches (listener: Listener, request: Request): boolean {
        if (listener.command !== request.command || listener.order <= request.listenersAfter) return false;

        return this.reachableBy(listener, request.source);
    }

    private hasListener (request: Request): boolean {
        return [...this.listeners].some(listener => this.matches(listener, request));
    }

    /*
     * Requests are handed out on the next microtask, not at once: a Workflow Input that React mounts,
     * unmounts and mounts again in one go (StrictMode does, and so can a re-render) would otherwise get
     * the request on its first mount and cancel it on the unmount that follows.
     */
    private scheduleDispatch (): void {
        if (this.dispatchScheduled) return;

        this.dispatchScheduled = true;
        queueMicrotask(() => {
            this.dispatchScheduled = false;
            this.dispatch();
        });
    }

    private dispatch (): void {
        for (const request of [...this.waiting]) {
            const listener = [...this.listeners].find(candidate => this.matches(candidate, request) && !this.serving.has(candidate.layerId));

            if (listener) this.start(request, listener);
        }
    }

    private start (request: Request, listener: Listener): void {
        this.waiting.splice(this.waiting.indexOf(request), 1);
        clearTimeout(request.timer);

        request.layerId = listener.layerId;
        request.listener = listener;
        request.timer = setTimeout(
            () => this.finish(request, new CommandError("timeout", `/${request.command} took too long and was given up.`)),
            request.runTimeoutMs
        );

        this.serving.set(listener.layerId, request);
        this.setLayerState(listener.layerId, {status: "serving", command: request.command});

        listener.deliver(request.input);
    }

    private finish (request: Request, outcome: NodeEnvelope | CommandError): void {
        const layerId = request.layerId;

        if (!layerId || this.serving.get(layerId) !== request) return;

        this.serving.delete(layerId);
        clearTimeout(request.timer);
        request.detachSignal?.();

        if (outcome instanceof CommandError) {
            this.setLayerState(layerId, outcome.cancelled ? IDLE : {status: "failed", command: request.command, error: outcome});
            request.reject(outcome);
        } else {
            this.setLayerState(layerId, {status: "succeeded", command: request.command});
            request.resolve(outcome);
        }

        this.scheduleDispatch();
    }

    private cancel (request: Request): void {
        if (request.layerId) {
            this.finish(request, new CommandError("cancelled", "Stopped."));

            return;
        }

        this.dropWaiting(request, new CommandError("cancelled", "Stopped."));
    }

    private giveUpWaiting (request: Request): void {
        this.dropWaiting(request, this.hasListener(request)
            ? new CommandError("busy", `Every layer listening for /${request.command} stayed busy.`)
            : new CommandError("no_listener", `No layer started listening for /${request.command}.`));
    }

    private dropWaiting (request: Request, error: CommandError): void {
        const index = this.waiting.indexOf(request);

        if (index === -1) return;

        this.waiting.splice(index, 1);
        clearTimeout(request.timer);
        request.detachSignal?.();
        request.reject(error);
    }

    private setLayerState (layerId: string, state: LayerCommandState): void {
        this.layerStates.set(layerId, state);

        for (const listener of [...this.stateListeners]) {
            listener();
        }
    }
}
