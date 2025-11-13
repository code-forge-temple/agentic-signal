/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {createTheme} from "@mui/material";

export const darkTheme = createTheme({
    palette: {
        mode: 'dark',
    },
    components: {
        MuiTooltip: {
            styleOverrides: {
                tooltip: {
                    backgroundColor: 'black',
                    color: 'white',
                    fontSize: '11px',
                    fontWeight: 500,
                    borderRadius: '6px',
                },
                arrow: {
                    color: 'black',
                }
            }
        }
    }
});

export const isValidJsonString = (input: any): boolean => {
    if (input === undefined || input === null) {
        return false;
    }

    if (typeof input === 'string') {
        try {
            JSON.parse(input);

            return true;
        } catch {
            return false;
        }
    }

    return false;
}

export const formatContentForDisplay = (input: any): string | undefined => {
    if (input === undefined || input === null) {
        return undefined;
    }

    if (typeof input === 'string') {
        try {
            const parsed = JSON.parse(input);

            return `\`\`\`json\n${JSON.stringify(parsed, null, 4)}\n\`\`\``;
        } catch {
            return input;
        }
    }

    return `\`\`\`json\n${JSON.stringify(input, null, 4)}\n\`\`\``;
};

export const parseUrl = (initialUrl: string): string => {
    let url = initialUrl.trim();

    if (!url.startsWith('https://') && !url.startsWith('http://')) {
        url = `https://${url}`;
    }

    let parsedUrl: URL;

    try {
        parsedUrl = new URL(url);
    } catch {
        throw new Error("Invalid URL");
    }

    if (!/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(parsedUrl.hostname)) {
        throw new Error("Invalid domain in URL");
    }

    return url;
}

export const isTauri = (): boolean => {
    return typeof window !== 'undefined' && (
        window.__TAURI_INTERNALS__ !== undefined ||
        window.location.protocol === 'tauri:' ||
        window.location.hostname === 'tauri.localhost'
    );
};