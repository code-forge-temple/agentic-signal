/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import React from 'react';
import Tabs from '@theme/Tabs';

export function UrlDefaultTabs ({children, defaultTab}) {
    let tabFromUrl = defaultTab;

    if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const activeTab = params.get('activeTab');

        if (activeTab) tabFromUrl = activeTab;
    }

    return (
        <Tabs defaultValue={tabFromUrl}>
            {children}
        </Tabs>
    );
}