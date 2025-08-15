/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {useState, useEffect} from 'react';
import './style.scss';
import {useSettings} from '../../../../../../hooks/useSettings';
import {useDebouncedState} from '../../../../../../hooks/useDebouncedState';
import {TextField, IconButton, InputAdornment, Box, LinearProgress, List, ListItem, ListItemText} from '@mui/material';
import {Plus, Trash} from 'iconoir-react';
import {OllamaService} from '../../../../../../services/ollamaService';

export const Settings = () => {
    const {settings, setSetting} = useSettings();
    const [hoveredOllamaListItemIdx, setHoveredOllamaListItemIdx] = useState<number | null>(null);

    const [debouncedOllamaHost, setDebouncedOllamaHost] = useDebouncedState({
        callback: (value: string) => {
            setSetting("ollamaHost", value);
        },
        delay: 300,
        initialValue: settings.ollamaHost
    });

    const [modelInput, setModelInput] = useState('');
    const [isPulling, setIsPulling] = useState(false);
    const [progress, setProgress] = useState<number | null>(null);
    const [models, setModels] = useState<string[]>([]);
    const [isOllamaHostValid, setIsOllamaHostValid] = useState(false);

    const fetchModels = async () => {
        const res = await OllamaService.getInstance().fetchModels();

        if (res.success) {
            setModels(res.models.map(m => m.name));
            setIsOllamaHostValid(true);
        } else {
            setModels([]);
            setIsOllamaHostValid(false);
        }
    };

    useEffect(() => {
        setModels([]);
        fetchModels();
    }, [settings.ollamaHost]);

    const pollForModel = async (modelName: string, maxAttempts = 5, interval = 1000) => {
        let attempts = 0;

        return new Promise<void>((resolve) => {
            const poll = setInterval(async () => {
                await fetchModels();

                if (models.includes(modelName) || attempts >= maxAttempts) {
                    clearInterval(poll);
                    resolve();
                }

                attempts++;
            }, interval);
        });
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
            <TextField
                label="Ollama Host"
                variant="outlined"
                fullWidth
                value={debouncedOllamaHost}
                onChange={(e) => setDebouncedOllamaHost(e.target.value)}
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
                    onChange={e => setModelInput(e.target.value)}
                    disabled={isPulling || !isOllamaHostValid}
                    fullWidth
                    helperText={!isOllamaHostValid ? "Invalid Ollama host - cannot add models" : ""}
                    error={!isOllamaHostValid}
                    slotProps={{
                        input: {
                            endAdornment: (
                                <InputAdornment position="end">
                                    <IconButton
                                        onClick={handlePullModel}
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
            <Box sx={{mt: 3, maxHeight: 240, overflowY: 'auto'}}>
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
                                        onClick={() => handleDeleteModel(model)}
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