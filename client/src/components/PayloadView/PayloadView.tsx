/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {useEffect, useMemo, useState} from "react";
import {formatContentForDisplay} from "../../utils";
import {copyText} from "../../utils/clipboard";
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

    // Once per payload: the node redraws for other reasons too, and a large payload is slow to stringify.
    const {formattedValue, formatError} = useMemo(() => {
        try {
            return {formattedValue: reformatContent(formatContentForDisplay(value) || NO_OUTPUT_AVAILABLE)};
        } catch (err) {
            return {formattedValue: NO_OUTPUT_AVAILABLE, formatError: `Error formatting content: ${err instanceof Error ? err.message : 'Unknown error'}`};
        }
    }, [value]);

    // Reported after rendering: the callback sets the node's state.
    useEffect(() => {
        if (formatError) onError(formatError);
    }, [formatError, onError]);

    return (
        <div style={{position: "relative", flex: 1, minHeight: 0, display: "flex", flexDirection: "column"}}>
            <Tooltip title={copied ? "Copied!" : "Copy raw value"} placement="left">
                <IconButton
                    size="small"
                    onClick={() => {
                        const textToCopy = typeof value === 'string' ? value : JSON.stringify(value, null, 4);

                        // only claim "Copied!" once the write succeeds (it can be denied by the browser)
                        copyText(textToCopy).then(() => {
                            setCopied(true);

                            setTimeout(() => setCopied(false), 2000);
                        }).catch(() => { /* Ignore */ });
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
