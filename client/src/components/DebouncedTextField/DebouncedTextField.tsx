/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {TextField, TextFieldProps} from '@mui/material';
import {useDebouncedState} from '../../hooks/useDebouncedState';
import {useEffect} from 'react';

type DebouncedTextFieldProps = Omit<TextFieldProps, 'onChange'> & {
    value: string | number;
    /**
     * Saves the typed text. It may give back the text of what it saved instead (a number kept within its range, say):
     * the field then shows that, even when `value` stays the same.
     */
    onChange: (value: string) => string | void;
    delay?: number;
};

export function DebouncedTextField ({
    value,
    onChange,
    delay = 300,
    type = 'text',
    ...textFieldProps
}: DebouncedTextFieldProps) {
    const [debouncedValue, setDebouncedValue, replaceValue] = useDebouncedState({
        callback: (typed: string) => {
            const saved = onChange(typed);

            if (typeof saved === 'string' && saved !== typed) replaceValue(saved);
        },
        delay,
        initialValue: String(value)
    });

    useEffect(() => {
        if (String(value) !== debouncedValue) {
            replaceValue(String(value));
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value]);

    return (
        <TextField
            {...textFieldProps}
            type={type}
            value={debouncedValue}
            onChange={(e) => setDebouncedValue(e.target.value)}
        />
    );
}