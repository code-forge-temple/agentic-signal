/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {useEffect, useState} from 'react';
import {TextField, TextFieldProps} from '@mui/material';
import jsonata from 'jsonata';

type CalculatorTextFieldProps = Omit<TextFieldProps, 'onChange' | 'value' | 'type' | 'error'> & {
    value: number;
    onChange: (value: number) => void;
    integer?: boolean;
};

const DEFAULT_HELPER_TEXT = "Supports expressions (e.g. 60*60*12) — press Enter or click away to calculate";

export function CalculatorTextField ({
    value,
    onChange,
    integer = false,
    helperText = DEFAULT_HELPER_TEXT,
    ...textFieldProps
}: CalculatorTextFieldProps) {
    const [text, setText] = useState(String(value));
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setText(String(value));
        setError(null);
    }, [value]);

    const evaluate = async () => {
        if (text.trim() === String(value)) return;

        try {
            const rawResult = await jsonata(text).evaluate({});

            if (typeof rawResult !== 'number' || !isFinite(rawResult)) {
                throw new Error("Expression did not evaluate to a number");
            }

            const result = integer ? Math.round(rawResult) : rawResult;

            setText(String(result));
            setError(null);
            onChange(result);
        } catch {
            setError("Not a valid number or expression");
        }
    };

    return (
        <TextField
            {...textFieldProps}
            type="text"
            value={text}
            error={!!error}
            helperText={error || helperText}
            onChange={(e) => setText(e.target.value)}
            onBlur={evaluate}
            onKeyDown={(e) => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    evaluate();
                }
            }}
        />
    );
}
