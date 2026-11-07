/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {describe, expect, it, vi} from 'vitest';
import {CommandError, CommandRouter} from './commandRouter';
import {AI_LAYER} from '../context/LayersContextBase';
import {NodeEnvelope} from '../types/workflow';


const nodeError = {nodeId: 'n1', nodeType: 'http', nodeTitle: 'HTTP Request', message: '404 Not Found'};

/** Lets the router hand out what is waiting: it does so on the next microtask. */
const handOut = () => new Promise(resolve => setTimeout(resolve, 0));

/** The rejection of `promise`, as a CommandError. */
async function rejectionOf (promise: Promise<unknown>): Promise<CommandError> {
    try {
        await promise;
    } catch (error) {
        if (error instanceof CommandError) return error;

        throw error;
    }

    throw new Error('expected the request to fail');
}

/** A Workflow Input listening in `layerId`; `received` collects what it was handed. */
function listener (router: CommandRouter, layerId: string, command = 'xyz') {
    const received: NodeEnvelope[] = [];
    const stop = router.listen(layerId, command, input => received.push(input));

    return {received, stop};
}

describe('CommandRouter: outside callers', () => {
    it('hands the input to a listening layer and resolves with what its Workflow Output reports', async () => {
        const router = new CommandRouter();
        const layer2 = listener(router, 'layer-2');

        const result = router.request({command: 'xyz', input: {payload: 'hi'}, source: 'outside'});

        await handOut();
        expect(layer2.received).toEqual([{payload: 'hi'}]);
        expect(router.getLayerState('layer-2')).toEqual({status: 'serving', command: 'xyz'});

        router.reportResult('layer-2', {payload: 'HI'});

        await expect(result).resolves.toEqual({payload: 'HI'});
        expect(router.getLayerState('layer-2')).toEqual({status: 'succeeded', command: 'xyz'});
    });

    it('answers no_listener at once when no layer listens for the command', async () => {
        const router = new CommandRouter();

        listener(router, 'layer-2', 'other');

        expect((await rejectionOf(router.request({command: 'xyz', input: {}, source: 'outside'}))).code).toBe('no_listener');
    });

    it('never reaches the AI Buddy layer', async () => {
        const router = new CommandRouter();
        const ai = listener(router, AI_LAYER.id, 'research');

        expect((await rejectionOf(router.request({command: 'research', input: {}, source: 'outside'}))).code).toBe('no_listener');
        expect(ai.received).toEqual([]);
    });

    it('spreads requests over the layers listening for the same command, and queues the rest', async () => {
        const router = new CommandRouter();
        const layer2 = listener(router, 'layer-2');
        const layer3 = listener(router, 'layer-3');

        const a = router.request({command: 'xyz', input: {payload: 'A'}, source: 'outside'});
        const b = router.request({command: 'xyz', input: {payload: 'B'}, source: 'outside'});
        const c = router.request({command: 'xyz', input: {payload: 'C'}, source: 'outside'});

        await handOut();
        expect(layer2.received).toEqual([{payload: 'A'}]);
        expect(layer3.received).toEqual([{payload: 'B'}]);

        router.reportResult('layer-2', {payload: 'A done'});

        // C takes the layer that freed up.
        await handOut();
        expect(layer2.received).toEqual([{payload: 'A'}, {payload: 'C'}]);

        router.reportResult('layer-3', {payload: 'B done'});
        router.reportResult('layer-2', {payload: 'C done'});

        await expect(Promise.all([a, b, c])).resolves.toEqual([{payload: 'A done'}, {payload: 'B done'}, {payload: 'C done'}]);
    });

    it('gives up a request whose listening layers all stay busy', async () => {
        const router = new CommandRouter();

        listener(router, 'layer-2');
        void router.request({command: 'xyz', input: {}, source: 'outside'}).catch(() => {});

        const error = await rejectionOf(router.request({command: 'xyz', input: {}, source: 'outside', queueTimeoutMs: 20}));

        expect(error.code).toBe('busy');
    });
});

describe('CommandRouter: the chat', () => {
    it('waits for the replaced workflow\'s own Workflow Input on the AI Buddy layer, not the old one', async () => {
        const router = new CommandRouter();
        const old = listener(router, AI_LAYER.id, 'research');

        const result = router.request({command: 'research', input: {payload: 'bees'}, source: 'chat', awaitNewListener: true});

        await handOut();
        expect(old.received).toEqual([]);

        // The new workflow mounts after the request was made.
        const fresh = listener(router, AI_LAYER.id, 'research');

        await handOut();
        expect(fresh.received).toEqual([{payload: 'bees'}]);

        router.reportResult(AI_LAYER.id, {payload: 'report'});

        await expect(result).resolves.toEqual({payload: 'report'});
    });

    it('survives a Workflow Input that React mounts, unmounts and mounts again in one go', async () => {
        const router = new CommandRouter();

        const result = router.request({command: 'research', input: {payload: 'bees'}, source: 'chat', awaitNewListener: true});

        // StrictMode in development: subscribe, unsubscribe, subscribe again, all before the next microtask.
        const first = listener(router, AI_LAYER.id, 'research');

        first.stop();

        const second = listener(router, AI_LAYER.id, 'research');

        await handOut();
        expect(first.received).toEqual([]);
        expect(second.received).toEqual([{payload: 'bees'}]);

        router.reportResult(AI_LAYER.id, {payload: 'report'});

        await expect(result).resolves.toEqual({payload: 'report'});
    });

    it('never reaches the user\'s layers, even when one listens for the command', async () => {
        const router = new CommandRouter();
        const layer2 = listener(router, 'layer-2', 'research');

        const error = await rejectionOf(router.request({command: 'research', input: {}, source: 'chat', awaitNewListener: true, queueTimeoutMs: 20}));

        expect(error.code).toBe('no_listener');
        expect(layer2.received).toEqual([]);
    });
});

describe('CommandRouter: ending a request', () => {
    it('fails on the first node error of the serving layer, naming the node, and ignores what follows', async () => {
        const router = new CommandRouter();

        listener(router, 'layer-2');

        const result = router.request({command: 'xyz', input: {}, source: 'outside'});

        await handOut();
        router.reportError('layer-2', nodeError);
        router.reportResult('layer-2', {payload: 'too late'});

        const error = await rejectionOf(result);

        expect(error.code).toBe('node_failed');
        expect(error.node).toEqual(nodeError);
        expect(error.message).toBe('HTTP Request: 404 Not Found');
        expect(router.getLayerState('layer-2')).toEqual({status: 'failed', command: 'xyz', error});
    });

    it('drops reports from a layer that serves no request', () => {
        const router = new CommandRouter();

        listener(router, 'layer-2');
        router.reportResult('layer-2', {payload: 'stray'});
        router.reportError('layer-2', nodeError);

        expect(router.getLayerState('layer-2')).toEqual({status: 'idle'});
    });

    it('gives up a run that neither answers nor fails in time', async () => {
        const router = new CommandRouter();

        listener(router, 'layer-2');

        expect((await rejectionOf(router.request({command: 'xyz', input: {}, source: 'outside', runTimeoutMs: 20}))).code).toBe('timeout');
    });

    it('cancels a running request when its signal aborts, and frees the layer for the next one', async () => {
        const router = new CommandRouter();
        const layer2 = listener(router, 'layer-2');
        const controller = new AbortController();

        const first = router.request({command: 'xyz', input: {payload: 'first'}, source: 'outside', signal: controller.signal});
        const second = router.request({command: 'xyz', input: {payload: 'second'}, source: 'outside'});

        await handOut();
        controller.abort();

        expect((await rejectionOf(first)).cancelled).toBe(true);

        await handOut();
        expect(layer2.received).toEqual([{payload: 'first'}, {payload: 'second'}]);

        router.reportResult('layer-2', {payload: 'ok'});

        await expect(second).resolves.toEqual({payload: 'ok'});
    });

    it('cancels a waiting request without ever delivering it', async () => {
        const router = new CommandRouter();
        const layer2 = listener(router, 'layer-2');
        const controller = new AbortController();

        void router.request({command: 'xyz', input: {payload: 'busy'}, source: 'outside'}).catch(() => {});

        const waiting = router.request({command: 'xyz', input: {payload: 'waiting'}, source: 'outside', signal: controller.signal});

        await handOut();
        controller.abort();

        expect((await rejectionOf(waiting)).cancelled).toBe(true);
        expect(layer2.received).toEqual([{payload: 'busy'}]);
    });

    it('cancels the request a Workflow Input was serving when it stops listening', async () => {
        const router = new CommandRouter();
        const layer2 = listener(router, 'layer-2');

        const result = router.request({command: 'xyz', input: {}, source: 'outside'});

        await handOut();
        layer2.stop();

        expect((await rejectionOf(result)).cancelled).toBe(true);
        expect(router.getLayerState('layer-2')).toEqual({status: 'idle'});
    });

    it('notifies state subscribers on every change until they unsubscribe', async () => {
        const router = new CommandRouter();
        const seen: string[] = [];
        const unsubscribe = router.subscribe(() => seen.push(router.getLayerState('layer-2').status));

        listener(router, 'layer-2');

        const result = router.request({command: 'xyz', input: {}, source: 'outside'});

        await handOut();
        router.reportResult('layer-2', {payload: 'y'});
        await result;

        unsubscribe();
        void router.request({command: 'xyz', input: {}, source: 'outside'}).catch(() => {});

        await vi.waitFor(() => expect(router.getLayerState('layer-2').status).toBe('serving'));
        expect(seen).toEqual(['serving', 'succeeded']);
    });
});

describe('CommandRouter: listing commands', () => {
    it('lists each command once, by name, with the first description found, for its own kind of caller', () => {
        const router = new CommandRouter();

        router.listen('layer-2', 'summarize', () => {}, () => '');
        router.listen('layer-3', 'summarize', () => {}, () => '  Sums up a text.  ');
        router.listen('layer-2', 'echo', () => {});
        router.listen(AI_LAYER.id, 'research', () => {}, () => 'Researches a topic.');

        expect(router.listedCommands('outside')).toEqual([
            {command: 'echo', description: ''},
            {command: 'summarize', description: 'Sums up a text.'},
        ]);
        expect(router.listedCommands('chat')).toEqual([{command: 'research', description: 'Researches a topic.'}]);
    });

    it('reads the description when listing, and drops a command once nothing listens for it', () => {
        const router = new CommandRouter();
        let description = 'Old.';
        const stop = router.listen('layer-2', 'echo', () => {}, () => description);

        description = 'Shouts back.';
        expect(router.listedCommands('outside')).toEqual([{command: 'echo', description: 'Shouts back.'}]);

        stop();
        expect(router.listedCommands('outside')).toEqual([]);
    });
});
