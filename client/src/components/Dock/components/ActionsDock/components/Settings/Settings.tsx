/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {useState, useEffect} from 'react';
import {useSettings} from '../../../../../../hooks/useSettings';
import {IconButton, InputAdornment, Box, LinearProgress, List, ListItem, ListItemText, TextField} from '@mui/material';
import {Plus, Trash} from 'iconoir-react';
import {OllamaService} from '../../../../../../services/ollamaService';
import {DebouncedTextField} from '../../../../../DebouncedTextField';

export const Settings = () => {
    const {settings, setSetting} = useSettings();
    const [hoveredOllamaListItemIdx, setHoveredOllamaListItemIdx] = useState<number | null>(null);

    const [modelInput, setModelInput] = useState('');
    const [isPulling, setIsPulling] = useState(false);
    const [progress, setProgress] = useState<number | null>(null);
    const [models, setModels] = useState<string[]>([]);
    const [isOllamaHostValid, setIsOllamaHostValid] = useState(false);

    const fetchModels = async (): Promise<string[]> => {
        const res = await OllamaService.getInstance().fetchModels();
        const names = res.success ? res.models.map(m => m.name) : [];

        setModels(names);
        setIsOllamaHostValid(res.success);

        return names;
    };

    useEffect(() => {
        setModels([]);
        void fetchModels();
    }, [settings.ollamaHost]);

    // Checks the freshly fetched names, not `models` state (a closure would only ever see the old list).
    // Sequential, so a slow fetch can't overlap the next attempt.
    const pollForModel = async (modelName: string, maxAttempts = 15, interval = 1000) => {
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const names = await fetchModels();

            // an untagged pull ("llama3") is listed under Ollama's default tag ("llama3:latest")
            if (names.includes(modelName) || names.includes(`${modelName}:latest`)) return;

            await new Promise(resolve => setTimeout(resolve, interval));
        }
    };

    const handlePullModel = async () => {
        setIsPulling(true);
        setProgress(0);

        try {
            for await (const res of OllamaService.getInstance().pullModel(modelInput)) {
                if (res.success) {
                    setProgress(res.reply);
                } else {
                    setProgress(null);
                    setIsPulling(false);
                    setModelInput(res.error);

                    return;
                }
            }

            setProgress(100);
            await pollForModel(modelInput);
        } finally {
            setIsPulling(false);
            setModelInput('');
            setProgress(null);
        }
    };

    const handleDeleteModel = async (model: string) => {
        await OllamaService.getInstance().deleteModel(model);
        await fetchModels();
    };

    return (
        <>
            <DebouncedTextField
                label="Browser Executable Path *"
                variant="outlined"
                fullWidth
                value={settings.browserPath}
                onChange={value => setSetting("browserPath", value)}
                helperText="Path to your Chrome Browser executable for Playwright (required for scraping tools like 'Fetch Web Page' Node, etc.)"
            />
            <DebouncedTextField
                label="Ollama Host *"
                variant="outlined"
                fullWidth
                value={settings.ollamaHost}
                onChange={(value) => setSetting("ollamaHost", value)}
                sx={{mt: 2}}
            />
            <Box sx={{display: 'flex', alignItems: 'center', mt: 2}}>
                <TextField
                    label="Add Ollama Model"
                    variant="outlined"
                    value={
                        isPulling && progress !== null
                            ? `Downloading ${modelInput}   ${progress}%`
                            : modelInput
                    }
                    onChange={event => setModelInput(event.target.value)}
                    disabled={isPulling || !isOllamaHostValid}
                    fullWidth
                    helperText={!isOllamaHostValid ? "Invalid Ollama host - cannot add models" : ""}
                    error={!isOllamaHostValid}
                    slotProps={{
                        input: {
                            endAdornment: (
                                <InputAdornment position="end">
                                    <IconButton
                                        onClick={() => void handlePullModel()}
                                        disabled={isPulling || !modelInput.trim() || !isOllamaHostValid}
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
            {isPulling && progress !== null && (
                <Box sx={{width: '100%', mt: 1}}>
                    <LinearProgress variant="determinate" value={progress} />
                </Box>
            )}
            <Box sx={{mt: 3, maxHeight: '100%', overflowY: 'auto'}}>
                <List>
                    {
                        models.map((model, idx) => (
                            <ListItem
                                key={model}
                                onMouseEnter={() => setHoveredOllamaListItemIdx(idx)}
                                onMouseLeave={() => setHoveredOllamaListItemIdx(null)}
                                sx={{
                                    backgroundColor: hoveredOllamaListItemIdx === idx ? 'action.hover' : 'inherit',
                                    transition: 'background 0.2s'
                                }}
                                secondaryAction={
                                    <IconButton
                                        edge="end"
                                        aria-label="delete"
                                        onClick={() => void handleDeleteModel(model)}
                                        size="small"
                                    >
                                        <Trash style={{fontSize: 16}} />
                                    </IconButton>
                                }
                            >
                                <ListItemText primary={model} />
                            </ListItem>
                        ))
                    }
                </List>
            </Box>
        </>
    );
};