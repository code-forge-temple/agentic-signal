/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {useState} from "react";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import LinearProgress from "@mui/material/LinearProgress";
import TextField from "@mui/material/TextField";
import {Plus} from "iconoir-react";
import {LlmService} from "../../../../../../../services/llm/llmService";


type AddModelFieldProps = {
    /** Ollama answers at the host set, so models can be added. */
    enabled: boolean;
    /** A new host hasn't answered yet (the list below says so): no "invalid host" note meanwhile. */
    checking: boolean;
    /** Called once the model is downloaded, to wait until Ollama lists it. */
    onPulled: (model: string) => Promise<void>;
};

// The line under the field: why it can't take a model, or what went wrong with the last one.
function noteFor (enabled: boolean, checking: boolean, error: string | null): {text: string; failed: boolean} {
    if (enabled) return {text: error ?? "", failed: error !== null};

    return checking ? {text: "", failed: false} : {text: "Invalid Ollama host - cannot add models", failed: true};
}

/*
 * A model to download, then its progress. Both stay here, so a keystroke or a progress update
 * redraws this field only, not the whole Settings dialog with its list of models.
 */
export function AddModelField ({enabled, checking, onPulled}: AddModelFieldProps) {
    const [model, setModel] = useState("");
    // null while nothing is downloading.
    const [progress, setProgress] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);
    const isPulling = progress !== null;
    const pulled = model.trim();
    const note = noteFor(enabled, checking, error);

    const handlePull = async () => {
        setError(null);
        setProgress(0);

        try {
            for await (const res of LlmService.getInstance().pullModel(pulled)) {
                if (!res.success) {
                    setError(res.error);

                    return;
                }

                setProgress(res.reply);
            }

            setProgress(100);
            await onPulled(pulled);
        } finally {
            setProgress(null);
            setModel("");
        }
    };

    return (
        <>
            <Box sx={{display: 'flex', alignItems: 'center', mt: 2}}>
                <TextField
                    label="Add Ollama Model"
                    variant="outlined"
                    value={isPulling ? `Downloading ${pulled}   ${progress}%` : model}
                    onChange={(event) => {
                        setModel(event.target.value);
                        setError(null);
                    }}
                    disabled={isPulling || !enabled}
                    fullWidth
                    helperText={note.text}
                    error={note.failed}
                    slotProps={{
                        input: {
                            endAdornment: (
                                <InputAdornment position="end">
                                    <IconButton
                                        onClick={() => void handlePull()}
                                        disabled={isPulling || !pulled || !enabled}
                                        aria-label="Add model"
                                    >
                                        <Plus />
                                    </IconButton>
                                </InputAdornment>
                            ),
                        }
                    }}
                />
            </Box>
            {isPulling && (
                <Box sx={{width: '100%', mt: 1}}>
                    <LinearProgress variant="determinate" value={progress} />
                </Box>
            )}
        </>
    );
}
