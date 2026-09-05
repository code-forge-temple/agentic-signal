/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {useMemo, useState} from "react";
import {formatContentForDisplay} from "../../utils";
import {MarkdownRenderer} from "../MarkdownRenderer";
import {reformatContent} from "./utils/contentParser";
import {IconButton, Tooltip} from "@mui/material";
import {Copy} from "iconoir-react";
import {NodeEnvelope} from "../../types/workflow";


const NO_OUTPUT_AVAILABLE = "No output available";

export function PayloadView (
    {value, onError}: {value: NodeEnvelope['payload'] | NodeEnvelope['toolsPayload']; onError: (message: string) => void}
) {
    const [copied, setCopied] = useState(false);

    let displayedValue: string | undefined = undefined;

    try {
        displayedValue = formatContentForDisplay(value);
    }
    catch (err) {
        onError(`Error formatting content: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }

    const formattedValue = useMemo(
        () => reformatContent(displayedValue || NO_OUTPUT_AVAILABLE),
        [displayedValue]
    );

    return (
        <div style={{position: "relative", flex: 1, minHeight: 0, display: "flex", flexDirection: "column"}}>
            <Tooltip title={copied ? "Copied!" : "Copy raw value"} placement="left">
                <IconButton
                    size="small"
                    onClick={() => {
                        const textToCopy = typeof value === 'string' ? value : JSON.stringify(value, null, 4);

                        navigator.clipboard.writeText(textToCopy);

                        setCopied(true);

                        setTimeout(() => setCopied(false), 2000);
                    }}
                    sx={{position: "absolute", top: 4, right: 4, zIndex: 1}}
                >
                    <Copy width={28} height={28} />
                </IconButton>
            </Tooltip>
            <MarkdownRenderer content={formattedValue} disableLoadingDelay />
        </div>
    );
}
