/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {ReactNode} from 'react';
import {FormControl, FormLabel} from "@mui/material";


type FieldsetGroupProps = {
    children: ReactNode;
    title: string;
};

export const FieldsetGroup = ({children, title}: FieldsetGroupProps) => {
    return (
        <FormControl component="fieldset"
            sx={{
                width: '100%',
                boxSizing: 'border-box',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 2,
                pt: 2, pb: 0, pl: 2, pr: 2,
                mb: 2,
            }}
        >
            <FormLabel
                component="legend"
                sx={{
                    color: 'text.secondary',
                    fontSize: 'small',
                    padding: '0 7px 0 7px',
                    margin: '0 -7px 0 -7px !important',
                    fontWeight: 400,
                    lineHeight: 1.4375,
                    mb: 1
                }}
            >
                {title}
            </FormLabel>
            {children}
        </FormControl>
    );
};
