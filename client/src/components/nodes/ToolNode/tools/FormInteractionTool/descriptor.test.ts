/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {afterEach, beforeEach, describe, expect, it, MockInstance, vi} from 'vitest';
import {FormInteractionToolDescriptor} from './descriptor';
import {FormInteractionQueryResult, GraphQLService} from './services/graphqlService';


const RESULT: FormInteractionQueryResult = {success: true, currentUrl: 'http://form', pageTitle: 'Form', submitted: false, formFields: [], actionButtons: []};
const FILE = {name: 'cv.pdf', base64: 'AAAA', mimeType: 'application/pdf'};

const handler = FormInteractionToolDescriptor.handlerFactory({typingDelay: 0, browserPath: 'C:/chrome.exe'});

let formInteraction: MockInstance<typeof GraphQLService.formInteraction>;

beforeEach(() => {
    formInteraction = vi.spyOn(GraphQLService, 'formInteraction').mockResolvedValue(RESULT);
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('Form Interaction tool', () => {
    it('needs a url and well-formed actions before calling the server', async () => {
        expect(await handler({sessionId: 's'})).toEqual({error: '`url` parameter is required.'});
        expect(await handler({url: 'http://form', actions: [{actionType: 'fill'}], sessionId: 's'}))
            .toMatchObject({error: expect.stringMatching(/^Invalid `actions`: 0\.selector/) as string});
        expect(formInteraction).not.toHaveBeenCalled();
    });

    it('sends the converted actions with the settings, and defaults for those unset', async () => {
        await handler({url: 'http://form', actions: [{selector: '#cv', actionType: 'upload', value: 'cv.pdf'}], submitSelector: '#go', sessionId: 's1'});
        await FormInteractionToolDescriptor.handlerFactory({})({url: 'http://form', sessionId: 's2'});

        expect(formInteraction.mock.calls).toEqual([
            [{
                url: 'http://form', actions: [{selector: '#cv', actionType: 'upload', value: 'cv.pdf', fileKey: 'cv.pdf'}], submitSelector: '#go',
                attachedFiles: [], typingDelay: 0, browserPath: 'C:/chrome.exe', interactionTimeoutSeconds: 300, sessionId: 's1', toolName: 'form-interaction',
            }],
            [{
                url: 'http://form', actions: [], submitSelector: undefined,
                attachedFiles: [], typingDelay: 1, browserPath: undefined, interactionTimeoutSeconds: 300, sessionId: 's2', toolName: 'form-interaction',
            }],
        ]);
    });

    it('attaches the files among the tools payload and tells the LLM their names', async () => {
        const result: unknown = await handler({url: 'http://form', toolsPayload: [FILE, {note: 'not a file'}], sessionId: 's'});

        expect(formInteraction.mock.calls[0][0].attachedFiles).toEqual([FILE]);
        expect(result).toEqual({...RESULT, availableFiles: ['cv.pdf']});
    });

    it('reports a call that fails', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        formInteraction.mockRejectedValue(new Error('Browser closed'));

        expect(await handler({url: 'http://form', sessionId: 's'})).toEqual({error: 'Browser closed'});
    });
});
