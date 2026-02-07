/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {useEffect} from 'react';
import {getCurrentWindow} from '@tauri-apps/api/window';
import {isTauri} from '../utils';


async function toggleFullscreen () {
    if (typeof window !== 'undefined' && window.__TAURI_INTERNALS__) {
        const appWindow = getCurrentWindow();
        const isFullscreen = await appWindow.isFullscreen();

        await appWindow.setFullscreen(!isFullscreen);
    }
}

export function useFullscreen () {
    useEffect(() => {
        if (!isTauri()) return;

        const handleKeyPress = async (e: KeyboardEvent) => {
            if (e.key === 'F11') {
                e.preventDefault();

                await toggleFullscreen();
            }
        };

        window.addEventListener('keydown', handleKeyPress);

        return () => window.removeEventListener('keydown', handleKeyPress);
    }, []);
}
