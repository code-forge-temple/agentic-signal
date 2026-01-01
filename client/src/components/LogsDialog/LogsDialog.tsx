/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {BaseDialog} from "../BaseDialog";
import {MarkdownRenderer} from "../MarkdownRenderer";

interface LogsDialogProps {
    open: boolean;
    onClose: () => void;
    title: string;
    error: string | string[] | null;
}

const NO_LOGS_AVAILABLE = "No logs available";

export function LogsDialog ({open, onClose, title, error}: LogsDialogProps) {
    const errorContent = Array.isArray(error)
        ? (error.length > 0 ? error.join('\n\n---\n\n') : NO_LOGS_AVAILABLE)
        : (error || NO_LOGS_AVAILABLE);

    return (
        <BaseDialog
            open={open}
            onClose={onClose}
            title={title}
        >
            <MarkdownRenderer content={errorContent} />
        </BaseDialog>
    );
}