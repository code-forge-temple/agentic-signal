/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {TabContext, TabList} from '@mui/lab';
import {Tab, Box} from '@mui/material';
import {useState, useEffect} from 'react';
import './Tabs.scss';


type BasicTabsProps = {
    // `title` stays the stable key driving tab selection; `label` is what's actually
    // rendered in the tab pill (e.g. a title plus an inline Switch) and falls back to
    // `title` when omitted, so existing string-only callers are unaffected.
    tabs: { title: string; label?: React.ReactNode; content: React.ReactNode }[];
}

export function BasicTabs ({tabs}: BasicTabsProps) {
    const [value, setValue] = useState(tabs[0].title);

    useEffect(() => {
        if (tabs.length > 0 && !tabs.find(tab => tab.title === value)) {
            setValue(tabs[0].title);
        }
    }, [tabs, value]);

    return (
        <TabContext value={value}>
            <Box className="basic-tabs-container">
                <Box className="tabs-titles">
                    <TabList onChange={(_e, newValue) => setValue(newValue)}>
                        {tabs.map(tab => (
                            <Tab key={tab.title} label={tab.label ?? tab.title} value={tab.title} />
                        ))}
                    </TabList>
                </Box>
                <Box className="tabs-content">
                    {tabs.find(tab => tab.title === value)?.content}
                </Box>
            </Box>
        </TabContext>
    );
}