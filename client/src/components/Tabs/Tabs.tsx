/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {TabContext, TabList, TabPanel} from '@mui/lab';
import {Tab, Box} from '@mui/material';
import {useState} from 'react';

type BasicTabsProps = {
    tabs: { title: string; content: React.ReactNode }[];
}

export function BasicTabs ({tabs}: BasicTabsProps) {
    const [value, setValue] = useState(tabs[0].title);

    return (
        <TabContext value={value}>
            <Box sx={{borderBottom: 1, borderColor: 'divider'}}>
                <TabList onChange={(_e, newValue) => setValue(newValue)}>
                    {tabs.map(tab => (
                        <Tab key={tab.title} label={tab.title} value={tab.title} />
                    ))}
                </TabList>
            </Box>
            {tabs.map(tab => (
                <TabPanel key={tab.title} value={tab.title}>
                    {tab.content}
                </TabPanel>
            ))}
        </TabContext>
    );
}