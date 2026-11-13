/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

// @vitest-environment jsdom

import {act, cleanup, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {UserConfigFields} from './UserConfigFields';


const SCHEMA = {
    enabled: {type: 'boolean', description: 'Enabled'},
    count: {type: 'integer', description: 'Count', minimum: 3, maximum: 10, default: 5},
    ratio: {type: 'number'},
    city: {description: 'City', required: true},
    apiKey: {type: 'string', description: 'API key'},
    accessToken: {type: 'oauth', description: 'Google account'},
    authToken: {description: 'Auth token'},
    missing: undefined,
};

const typeInto = (label: string, text: string) => {
    fireEvent.change(screen.getByLabelText(label), {target: {value: text}});
    act(() => {
        vi.advanceTimersByTime(300);
    });
};

describe('UserConfigFields', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        cleanup();
        vi.useRealTimers();
    });

    it('shows nothing without a schema', () => {
        const {container} = render(<UserConfigFields userConfig={{}} onConfigChange={() => {}} />);

        expect(container.innerHTML).toBe('');
    });

    it('shows a field per setting, labelled by its description (or name), required ones starred; oauth ones left to the tool', () => {
        render(<UserConfigFields userConfigSchema={SCHEMA} userConfig={{city: 'Paris'}} onConfigChange={() => {}} />);

        const labels = Array.from(document.querySelectorAll('label')).map(label => label.textContent);

        expect(labels).toEqual(['Enabled', 'Count', 'ratio', 'City *', 'API key', 'Auth token']);
        expect(screen.queryByLabelText('Google account')).toBeNull();
    });

    it('shows the saved value, else the default, else nothing', () => {
        render(<UserConfigFields userConfigSchema={SCHEMA} userConfig={{city: 'Paris', enabled: true}} onConfigChange={() => {}} />);

        expect(screen.getByLabelText<HTMLInputElement>('City *').value).toBe('Paris');
        expect(screen.getByLabelText<HTMLInputElement>('Count').value).toBe('5');
        expect(screen.getByLabelText<HTMLInputElement>('ratio').value).toBe('');
        expect(screen.getByLabelText<HTMLInputElement>('Enabled').checked).toBe(true);
    });

    it('hides keys and tokens as passwords', () => {
        render(<UserConfigFields userConfigSchema={SCHEMA} userConfig={{}} onConfigChange={() => {}} />);

        expect(screen.getByLabelText('API key').getAttribute('type')).toBe('password');
        expect(screen.getByLabelText('Auth token').getAttribute('type')).toBe('password');
        expect(screen.getByLabelText('City *').getAttribute('type')).toBe('text');
        expect(screen.getByLabelText('Count').getAttribute('type')).toBe('number');
    });

    it('saves a switch as a boolean and text as it was typed', () => {
        const onConfigChange = vi.fn();

        render(<UserConfigFields userConfigSchema={SCHEMA} userConfig={{}} onConfigChange={onConfigChange} />);

        fireEvent.click(screen.getByLabelText('Enabled'));
        expect(onConfigChange).toHaveBeenLastCalledWith('enabled', true);

        typeInto('City *', 'Rome');
        expect(onConfigChange).toHaveBeenLastCalledWith('city', 'Rome');
    });

    it('saves numbers within their minimum and maximum', () => {
        const onConfigChange = vi.fn();

        render(<UserConfigFields userConfigSchema={SCHEMA} userConfig={{}} onConfigChange={onConfigChange} />);

        typeInto('Count', '42');
        expect(onConfigChange).toHaveBeenLastCalledWith('count', 10);
        expect(screen.getByLabelText<HTMLInputElement>('Count').value).toBe('10');

        typeInto('Count', '1');
        expect(onConfigChange).toHaveBeenLastCalledWith('count', 3);
        expect(screen.getByLabelText<HTMLInputElement>('Count').value).toBe('3');

        typeInto('Count', '7');
        expect(onConfigChange).toHaveBeenLastCalledWith('count', 7);

        typeInto('ratio', '2.5');
        expect(onConfigChange).toHaveBeenLastCalledWith('ratio', 2.5);

    });

    it('saves nothing for a cleared number field, and leaves it empty for the next number', () => {
        const onConfigChange = vi.fn();

        render(<UserConfigFields userConfigSchema={SCHEMA} userConfig={{count: 3}} onConfigChange={onConfigChange} />);

        typeInto('Count', '');
        expect(onConfigChange).not.toHaveBeenCalled();
        expect(screen.getByLabelText<HTMLInputElement>('Count').value).toBe('');

        typeInto('Count', '600');
        expect(onConfigChange).toHaveBeenLastCalledWith('count', 10);
    });

    it('shows the number saved even when the setting already had it', () => {
        // Already at the maximum: typing more saves 10 again, so the setting itself doesn't change.
        render(<UserConfigFields userConfigSchema={SCHEMA} userConfig={{count: 10}} onConfigChange={() => {}} />);

        typeInto('Count', '99');
        expect(screen.getByLabelText<HTMLInputElement>('Count').value).toBe('10');
    });

    it('gives the number inputs their range', () => {
        render(<UserConfigFields userConfigSchema={SCHEMA} userConfig={{}} onConfigChange={() => {}} />);

        const count = screen.getByLabelText('Count');

        expect([count.getAttribute('min'), count.getAttribute('max'), count.getAttribute('step')]).toEqual(['3', '10', '1']);
    });
});
