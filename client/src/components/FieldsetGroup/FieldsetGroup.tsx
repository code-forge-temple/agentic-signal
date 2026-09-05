/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {ReactNode, useState} from 'react';
import {Box, FormControl, FormLabel, IconButton} from "@mui/material";
import {ArrowDownCircleSolid, ArrowUpCircleSolid, ExpandLines} from "iconoir-react";


type FieldsetGroupProps = {
    children: ReactNode;
    title: string;
    height?: string;
    style?: React.CSSProperties;
    collapsible?: boolean;
    defaultCollapsed?: boolean;
    fillAvailableSpace?: boolean;
};

export const FieldsetGroup = ({children, title, height, style, collapsible = false, defaultCollapsed = false, fillAvailableSpace = false}: FieldsetGroupProps) => {
    const [collapsed, setCollapsed] = useState(collapsible && defaultCollapsed);
    const isCollapsed = collapsible && collapsed;

    const toggle = () => setCollapsed(prev => !prev);

    return (
        <FormControl component="fieldset"
            sx={{
                position: 'relative',
                width: '100%',
                boxSizing: 'border-box',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 2,
                pt: 2, pb: 2, pl: 2, pr: 2,
                mb: 2,
                ...(fillAvailableSpace && !isCollapsed
                    ? {display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0}
                    : {}),
                ...style,
                height: isCollapsed ? 'auto' : (height || 'auto'),
            }}
        >
            <FormLabel
                component="legend"
                onClick={collapsible ? toggle : undefined}
                sx={{
                    color: 'text.secondary',
                    fontSize: 'small',
                    padding: '0 7px 0 7px',
                    margin: '0 -7px 0 -7px !important',
                    fontWeight: 400,
                    lineHeight: 1.4375,
                    mb: isCollapsed ? 0 : 1,
                    cursor: collapsible ? 'pointer' : 'default',
                    userSelect: collapsible ? 'none' : 'auto',
                }}
            >
                {title}
            </FormLabel>
            {collapsible && (
                <IconButton
                    size="small"
                    onClick={e => { e.stopPropagation(); toggle(); }}
                    aria-label={isCollapsed ? "Expand" : "Collapse"}
                    sx={{
                        position: 'absolute',
                        top: 0,
                        right: 8,
                        marginTop: '-22px',
                        p: 0.25,
                    }}
                >
                    {isCollapsed ? <ArrowDownCircleSolid width={24} height={24} /> : <ArrowUpCircleSolid width={24} height={24} />}
                </IconButton>
            )}
            {isCollapsed ? (
                <Box sx={{display: 'flex', justifyContent: 'center', py: 0.5, marginTop: '-25px', marginBottom: '-13px'}}>
                    <IconButton size="small" onClick={toggle} aria-label="Expand">
                        <ExpandLines width={20} height={20} />
                    </IconButton>
                </Box>
            ) : children}
        </FormControl>
    );
};
