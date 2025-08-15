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
    error: string | null;
}

export function LogsDialog ({open, onClose, title, error}: LogsDialogProps) {
    return (
        <BaseDialog
            open={open}
            onClose={onClose}
            title={title}
        >
            <MarkdownRenderer content={error || "No logs available"} />
        </BaseDialog>
    );
}