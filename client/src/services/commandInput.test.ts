/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {describe, expect, it} from 'vitest';
import {commandInputEnvelope} from './commandInput';
import {buildDataSourceEnvelope, fileDataFromBytes} from '../components/nodes/DataSourceNode/utils';


const encode = (text: string) => btoa(String.fromCharCode(...new TextEncoder().encode(text)));
const markdown = (text: string, files: object[] = []) => ({type: 'markdown-and-files', value: {text, files}});

describe('commandInputEnvelope', () => {
    it('passes text on as the payload', () => {
        expect(commandInputEnvelope(markdown('bees'))).toEqual({payload: 'bees'});
    });

    it('takes a JSON value as JSON, not as text', () => {
        expect(commandInputEnvelope({type: 'json', value: {city: 'Paris'}})).toEqual({payload: {city: 'Paris'}});
        expect(commandInputEnvelope({type: 'json', value: null})).toEqual({payload: null});
    });

    it('puts out what Data Source puts out for the same files attached', () => {
        const sent = [
            {name: 'notes.md', base64: encode('# Notes')},
            {name: 'pic.png', base64: 'AAAA', mimeType: 'image/png'},
            {name: 'cv.pdf', base64: 'AAAA', mimeType: 'application/pdf', isToolsPayload: true},
        ];
        const attached = sent.map(file => fileDataFromBytes(file));

        expect(commandInputEnvelope(markdown('Read these', sent)))
            .toEqual(buildDataSourceEnvelope({type: 'markdown-and-files', value: {text: 'Read these', files: attached}}));
        expect(commandInputEnvelope(markdown('Read these', sent)).toolsPayload).toEqual([{name: 'cv.pdf', base64: 'AAAA', mimeType: 'application/pdf'}]);
    });

    it.each([
        ['plain text', 'just text', /body:/],
        ['a bare object', {text: 'hi'}, /type:/],
        ['an unknown type', {type: 'xml', value: '<a/>'}, /type:/],
        ['JSON without a value', {type: 'json'}, /value: Required/],
        ['text without files', {type: 'markdown-and-files', value: {text: 'hi'}}, /value\.files: Required/],
        ['a file without its bytes', markdown('hi', [{name: 'a.txt'}]), /value\.files\.0\.base64: Required/],
    ])('refuses %s, saying what is wrong and what to send', (_case, body, problem) => {
        expect(() => commandInputEnvelope(body)).toThrow(problem);
        expect(() => commandInputEnvelope(body)).toThrow(/"markdown-and-files"/);
    });

    it('names a file whose base64 isn\'t', () => {
        expect(() => commandInputEnvelope(markdown('hi', [{name: 'cv.pdf', base64: 'not base64!'}]))).toThrow('File "cv.pdf": its base64 isn\'t valid.');
    });
});
