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
    onChange: (value: string) => void;
    delay?: number;
};

export function DebouncedTextField ({
    value,
    onChange,
    delay = 300,
    type = 'text',
    ...textFieldProps
}: DebouncedTextFieldProps) {
    const [debouncedValue, setDebouncedValue] = useDebouncedState({
        callback: onChange,
        delay,
        initialValue: String(value)
    });

    useEffect(() => {
        if (String(value) !== debouncedValue) {
            setDebouncedValue(String(value));
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