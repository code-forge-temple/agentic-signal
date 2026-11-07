/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {afterEach, beforeAll, beforeEach, describe, expect, it, vi} from 'vitest';
import {ComponentProps} from 'react';
import {ChatLog} from './ChatLog';
import {ROLE} from '../../../../../../../../constants';
import {ChatEntry} from '../../../../constants';
import {sanitizeJsonInput} from '../../../../../../../nodes/ToolNode/tools/utils/sanitize';

// The forgiving JSON parser (dirty-json) behind sanitizeJsonInput takes about 100 ms on a 15 KB workflow:
// spied on, to see that a redraw never runs it on JSON the browser's own parser reads.
vi.mock('../../../../../../../nodes/ToolNode/tools/utils/sanitize', async (importOriginal) => {
    const original = await importOriginal<typeof import('../../../../../../../nodes/ToolNode/tools/utils/sanitize')>();

    return {...original, sanitizeJsonInput: vi.fn(original.sanitizeJsonInput)};
});

// The highlighter loads lazily: loaded once here, so each test waits for React alone.
beforeAll(async () => {
    await import('react-syntax-highlighter');
    await import('react-syntax-highlighter/dist/esm/styles/prism');
}, 30000);

// vitest runs without `globals`, so testing-library's automatic cleanup is never registered.
afterEach(() => {
    cleanup();
});

const workflowReply = (title: string) => {
    const workflow = {nodes: [{id: title, type: 'timer', position: {x: 0, y: 0}, data: {title}}], edges: []};

    return `Here is ${title}:\n\n\`\`\`json\n${JSON.stringify(workflow, null, 2)}\n\`\`\`\n`;
};

const CONVERSATION: ChatEntry[] = [
    {role: ROLE.USER, content: '@prepare-workflow a timer'},
    {role: ROLE.ASSISTANT, content: workflowReply('first')},
    {role: ROLE.USER, content: '@prepare-workflow another one'},
    {role: ROLE.ASSISTANT, content: workflowReply('second')},
    {role: ROLE.USER, content: '@prepare-workflow and a third'},
];

const props = (overrides: Partial<ComponentProps<typeof ChatLog>> = {}): ComponentProps<typeof ChatLog> => ({
    messages: CONVERSATION,
    minimumContext: 32768,
    isLoading: false,
    onLoadWorkflow: vi.fn(),
    onDeleteMessage: vi.fn(),
    commands: [],
    onRunSuggestion: vi.fn(),
    onSkipSuggestion: vi.fn(),
    ...overrides,
});

/** Each reply's coloured block, in order: a new block shows as plain text first, then gets its coloured tokens. */
async function highlightedBlocks (container: HTMLElement, count: number): Promise<HTMLElement[]> {
    await waitFor(() => expect([...container.querySelectorAll('pre')].filter(pre => pre.querySelector('.token'))).toHaveLength(count), {timeout: 5000});

    return [...container.querySelectorAll('pre')];
}

describe('ChatLog', () => {
    beforeEach(() => {
        vi.mocked(sanitizeJsonInput).mockClear();
    });

    it('keeps earlier replies\' code blocks mounted while a new reply streams in', async () => {
        const streaming = (content: string): ChatEntry[] => [...CONVERSATION, {role: ROLE.ASSISTANT, content}];
        const {container, rerender} = render(<ChatLog {...props({messages: streaming('Here'), isLoading: true})} />);
        const [first, second] = await highlightedBlocks(container, 2);

        // Each streamed chunk: a new last message, and (as from the chat panel) new callbacks.
        rerender(<ChatLog {...props({messages: streaming('Here is the third'), isLoading: true})} />);
        rerender(<ChatLog {...props({messages: streaming(workflowReply('third')), isLoading: true})} />);

        const blocks = await highlightedBlocks(container, 3);

        expect(blocks[0]).toBe(first);
        expect(blocks[1]).toBe(second);
    });

    it('keeps every code block mounted when the chat redraws for a layer switch', async () => {
        const {container, rerender} = render(<ChatLog {...props()} />);
        const before = await highlightedBlocks(container, 2);

        rerender(<ChatLog {...props({onLoadWorkflow: vi.fn()})} />);

        expect([...container.querySelectorAll('pre')]).toEqual(before);
    });

    it('checks for a workflow without the slow forgiving parser when the JSON is valid', async () => {
        const {container, rerender} = render(<ChatLog {...props()} />);

        await highlightedBlocks(container, 2);
        rerender(<ChatLog {...props({onLoadWorkflow: vi.fn()})} />);
        rerender(<ChatLog {...props({onDeleteMessage: vi.fn()})} />);

        expect(screen.getAllByRole('button', {name: 'Load Workflow'})).toHaveLength(2);
        expect(sanitizeJsonInput).not.toHaveBeenCalled();
    });

    it('still finds a workflow a model wrote with a trailing comma', async () => {
        const sloppy = 'Here:\n\n```json\n{"nodes": [{"id": "t", "type": "timer", "position": {"x": 0, "y": 0}, "data": {}},], "edges": []}\n```\n';
        const {container} = render(<ChatLog {...props({messages: [{role: ROLE.ASSISTANT, content: sloppy}]})} />);

        await highlightedBlocks(container, 1);

        expect(screen.queryByRole('button', {name: 'Load Workflow'})).not.toBeNull();
    });

    it('imports through the newest callback after a layer switch', async () => {
        const before = vi.fn();
        const after = vi.fn();
        const {container, rerender} = render(<ChatLog {...props({onLoadWorkflow: before})} />);

        await highlightedBlocks(container, 2);
        rerender(<ChatLog {...props({onLoadWorkflow: after})} />);
        fireEvent.click(screen.getAllByRole('button', {name: 'Load Workflow'})[1]);

        expect(before).not.toHaveBeenCalled();
        expect(after).toHaveBeenCalledTimes(1);
        expect(JSON.parse(after.mock.calls[0][0] as string)).toMatchObject({nodes: [{id: 'second'}]});
    });

    it('offers the Import button only once the reply has finished', async () => {
        const messages: ChatEntry[] = [{role: ROLE.ASSISTANT, content: workflowReply('streamed')}];
        const {container, rerender} = render(<ChatLog {...props({messages, isLoading: true})} />);

        await highlightedBlocks(container, 1);
        expect(screen.queryByRole('button', {name: 'Load Workflow'})).toBeNull();

        rerender(<ChatLog {...props({messages, isLoading: false})} />);

        expect(screen.queryByRole('button', {name: 'Load Workflow'})).not.toBeNull();
    });
});
