/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {useState} from "react";
import {Box, IconButton, InputAdornment, LinearProgress, TextField} from "@mui/material";
import {Plus} from "iconoir-react";
import {OllamaService} from "../../../../../../../services/ollamaService";


type AddModelFieldProps = {
    /** Ollama answers at the host set, so models can be added. */
    enabled: boolean;
    /** Called once the model is downloaded, to wait until Ollama lists it. */
    onPulled: (model: string) => Promise<void>;
};

/*
 * A model to download, then its progress. Both stay here, so a keystroke or a progress update
 * redraws this field only, not the whole Settings dialog with its list of models.
 */
export function AddModelField ({enabled, onPulled}: AddModelFieldProps) {
    const [model, setModel] = useState("");
    // null while nothing is downloading.
    const [progress, setProgress] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);
    const isPulling = progress !== null;
    const pulled = model.trim();

    const handlePull = async () => {
        setError(null);
        setProgress(0);

        try {
            for await (const res of OllamaService.getInstance().pullModel(pulled)) {
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
                    helperText={!enabled ? "Invalid Ollama host - cannot add models" : error ?? ""}
                    error={!enabled || error !== null}
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
