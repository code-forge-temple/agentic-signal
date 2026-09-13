/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {useEffect, useState} from 'react';
import {Box, Button, FormControlLabel, MenuItem, Select, Slider, Switch, Typography} from '@mui/material';
import {BaseDialog} from '../../../../../../../../BaseDialog';
import {OllamaService} from '../../../../../../../../../services/ollamaService';
import {useLlmSettings} from '../../../../../hooks/useLlmSettings';
import {
    CONTEXT_WINDOW_FALLBACK_MAX,
    CONTEXT_WINDOW_MIN,
    CONTEXT_WINDOW_STEP,
    LlmSettingsDraft,
    TEMPERATURE_MAX,
    TEMPERATURE_MIN,
    fromDraft,
    getModelSettings,
    toDraft
} from '../../../../../utils/llmSettings';
import {isCloudModel} from '../../../../../utils/modelContext';
import {THINK_LEVELS} from '../../../../../../../../../types/ollama.types';


type LlmSettingsDialogProps = {
    open: boolean;
    model: string;
    onClose: () => void;
};

const ROW_SX = {display: 'flex', alignItems: 'center', gap: 2, mb: 1, ml: 1.5};
const LABEL_SX = {minWidth: 150};
const CAPTION_SX = {ml: 1.5, mb: 2, color: 'rgba(255, 255, 255, 0.6)'};

export const LlmSettingsDialog = ({open, model, onClose}: LlmSettingsDialogProps) => {
    const {settingsMap, contextMap, saveModelSettings, rememberModelContextLength} = useLlmSettings();
    const [draft, setDraft] = useState<LlmSettingsDraft>(() => toDraft({}));

    /*
     * Seeded from an effect rather than in the render body: getModelSettings/toDraft return a
     * fresh object every call, so using one as a dependency would reseed on every render and
     * snap the sliders back mid-drag. settingsMap is memoized by the hook, which is what makes
     * this safe.
     */
    useEffect(() => {
        if (!open) return;

        setDraft(toDraft(getModelSettings(settingsMap, model)));
    }, [open, model, settingsMap]);

    /*
     * contextMap is both read and written here, but a cached value (null included)
     * short-circuits before the request, so the re-run terminates.
     */
    useEffect(() => {
        if (!open || !model) return;

        if (model in contextMap) return;

        let cancelled = false;

        OllamaService.getInstance().fetchModelContextLength(model)
            .then(response => {
                // Nothing is recorded on failure: null is cached permanently, so a transient
                // outage must not be mistaken for "this model reports no length".
                if (cancelled || !response.success) return;

                rememberModelContextLength(model, response.contextLength);
            })
            .catch(() => { /* host unreachable — the slider keeps its fallback ceiling */ });

        return () => { cancelled = true; };
    }, [open, model, contextMap, rememberModelContextLength]);

    const modelMax = contextMap[model];
    const isCloud = isCloudModel(model);
    // Floored at CONTEXT_WINDOW_MIN, not the default: a model whose real maximum is below
    // Ollama's default must not get a slider that exceeds it.
    const contextWindowMax = Math.max(modelMax ?? CONTEXT_WINDOW_FALLBACK_MAX, CONTEXT_WINDOW_MIN);
    // MUI renders the thumb off the track and warns when value > max.
    const contextWindowValue = Math.min(draft.contextWindow, contextWindowMax);

    const handleSave = () => {
        saveModelSettings(model, fromDraft({
            ...draft,
            // Never stored for a cloud model: Ollama Cloud ignores num_ctx outright, so keeping
            // a value here would only mislead the gauge and the next person to open this dialog.
            contextWindowEnabled: isCloud ? false : draft.contextWindowEnabled,
            contextWindow: contextWindowValue,
        }));

        onClose();
    };

    return (
        <BaseDialog
            open={open}
            onClose={onClose}
            title={`Model Settings — ${model}`}
            maxWidth="sm"
            actions={
                <>
                    <Button onClick={onClose}>Cancel</Button>
                    <Button variant="contained" onClick={handleSave}>Save</Button>
                </>
            }
        >
            <Box sx={{display: 'flex', flexDirection: 'column', width: '100%'}}>
                <Box sx={ROW_SX}>
                    <FormControlLabel
                        control={
                            <Switch
                                size="small"
                                checked={draft.think}
                                onChange={e => setDraft(prev => ({...prev, think: e.target.checked}))}
                            />
                        }
                        label={<Typography variant="body2">Thinking</Typography>}
                        sx={LABEL_SX}
                    />
                    <Select
                        size="small"
                        disabled={!draft.think}
                        value={draft.thinkLevel}
                        onChange={e => setDraft(prev => ({...prev, thinkLevel: e.target.value as LlmSettingsDraft['thinkLevel']}))}
                        sx={{flex: 1}}
                    >
                        <MenuItem value="default">Model default</MenuItem>
                        {THINK_LEVELS.map(level => (
                            <MenuItem key={level} value={level}>{level}</MenuItem>
                        ))}
                    </Select>
                </Box>

                <Typography variant="caption" sx={CAPTION_SX}>
                    {/* eslint-disable-next-line max-len */}
                    {"A level tunes how long the reasoning trace runs. Not every model honours Off — some always reason and ignore the switch, and for those a level is the only control over the trace."}
                </Typography>

                <Box sx={ROW_SX}>
                    <FormControlLabel
                        control={
                            <Switch
                                size="small"
                                checked={draft.temperatureEnabled}
                                onChange={e => setDraft(prev => ({...prev, temperatureEnabled: e.target.checked}))}
                            />
                        }
                        label={<Typography variant="body2">Temperature</Typography>}
                        sx={LABEL_SX}
                    />
                    <Slider
                        size="small"
                        disabled={!draft.temperatureEnabled}
                        min={TEMPERATURE_MIN}
                        max={TEMPERATURE_MAX}
                        step={0.1}
                        value={draft.temperature}
                        onChange={(_, value) => setDraft(prev => ({...prev, temperature: value as number}))}
                        valueLabelDisplay="auto"
                        sx={{flex: 1}}
                    />
                    <Typography variant="body2" sx={{minWidth: 28, textAlign: 'right'}}>
                        {draft.temperature.toFixed(1)}
                    </Typography>
                </Box>

                {/*
                  * The context window row is omitted entirely for cloud models rather than shown
                  * disabled: the setting has no effect there at all, so offering the control —
                  * even greyed out — would imply it could be turned on.
                  */}
                {isCloud ? (
                    <Typography variant="caption" sx={CAPTION_SX}>
                        {modelMax
                            ? `Context window: fixed at this cloud model's maximum of ${modelMax.toLocaleString()} tokens.`
                            : "Context window: fixed at this cloud model's maximum."}
                        {" Cloud models run on Ollama's servers, not this machine — they always allocate the full window, and Ollama silently ignores any size set here."}
                    </Typography>
                ) : (
                    <>
                        <Box sx={{...ROW_SX, mb: 0.5}}>
                            <FormControlLabel
                                control={
                                    <Switch
                                        size="small"
                                        checked={draft.contextWindowEnabled}
                                        onChange={e => setDraft(prev => ({...prev, contextWindowEnabled: e.target.checked}))}
                                    />
                                }
                                label={<Typography variant="body2">Context Window</Typography>}
                                sx={LABEL_SX}
                            />
                            <Slider
                                size="small"
                                disabled={!draft.contextWindowEnabled}
                                min={CONTEXT_WINDOW_MIN}
                                max={contextWindowMax}
                                step={CONTEXT_WINDOW_STEP}
                                value={contextWindowValue}
                                onChange={(_, value) => setDraft(prev => ({...prev, contextWindow: value as number}))}
                                valueLabelDisplay="auto"
                                sx={{flex: 1}}
                            />
                            <Typography variant="body2" sx={{minWidth: 52, textAlign: 'right'}}>
                                {contextWindowValue.toLocaleString()}
                            </Typography>
                        </Box>

                        <Typography variant="caption" sx={CAPTION_SX}>
                            {modelMax ? `Model maximum: ${modelMax.toLocaleString()} tokens.` : 'Model maximum unknown.'}
                            {/* eslint-disable-next-line max-len */}
                            {" Left off, Ollama picks its own default from the server's free VRAM (4K below 24 GiB, 32K up to 48 GiB, 256K above). Changing this makes Ollama reload the model, so the next reply is slower."}
                        </Typography>
                    </>
                )}
            </Box>
        </BaseDialog>
    );
};
