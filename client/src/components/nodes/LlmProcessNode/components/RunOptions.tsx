/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {Box, FormControlLabel, Slider, Switch, Typography} from "@mui/material";
import {DebouncedTextField} from "../../../DebouncedTextField";
import {ChangeLlmProcessNodeData, LlmProcessNodeData} from "../types/workflow";
import {runSettings} from "../utils/runSettings";
import {saveCountWithin} from "../../../../utils/countWithin";


function SettingSwitch ({label, checked, onChange}: {label: string; checked: boolean | undefined; onChange: (checked: boolean) => void}) {
    return (
        <Box sx={{display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1, ml: 1.5}}>
            <FormControlLabel
                control={<Switch size="small" checked={checked} onChange={event => onChange(event.target.checked)} />}
                label={<Typography variant="body2">{label}</Typography>}
            />
        </Box>
    );
}

/** Feedback loops, tool retries, orchestration, thinking and temperature. */
export function RunOptions ({data, change, currentLoop}: {data: LlmProcessNodeData; change: ChangeLlmProcessNodeData; currentLoop: number}) {
    const settings = runSettings(data);

    return (
        <>
            <DebouncedTextField
                label="Max Feedback Loops"
                type="number"
                fullWidth
                size="small"
                value={settings.maxFeedbackLoops}
                onChange={value => saveCountWithin(value, 0, 10, count => change({maxFeedbackLoops: count}))}
                sx={{mb: 2}}
                helperText={`Current loop: ${Math.min(currentLoop, settings.maxFeedbackLoops)}/${settings.maxFeedbackLoops}`}
            />
            <DebouncedTextField
                label="Max Tool Retries"
                type="number"
                fullWidth
                size="small"
                value={settings.maxToolRetries}
                onChange={value => saveCountWithin(value, 3, 10, count => change({maxToolRetries: count}))}
                sx={{mb: 2}}
                helperText="Maximum number of retry attempts for each required tool"
            />
            <SettingSwitch label="AI Orchestration Mode" checked={settings.orchestrationMode} onChange={checked => change({orchestrationMode: checked})} />
            <SettingSwitch label="Thinking" checked={settings.think} onChange={checked => change({think: checked})} />
            <Box sx={{display: "flex", alignItems: "center", gap: 2, mb: 2, ml: 1.5}}>
                <FormControlLabel
                    control={<Switch size="small" checked={settings.temperatureEnabled} onChange={event => change({temperatureEnabled: event.target.checked})} />}
                    label={<Typography variant="body2">Temperature</Typography>}
                />
                <Slider
                    size="small"
                    disabled={!settings.temperatureEnabled}
                    min={0}
                    max={2}
                    step={0.1}
                    value={settings.temperature}
                    onChange={(_, value) => change({temperature: value as number})}
                    valueLabelDisplay="auto"
                    sx={{flex: 1}}
                />
                <Typography variant="body2" sx={{minWidth: 28, textAlign: "right"}}>
                    {settings.temperature.toFixed(1)}
                </Typography>
            </Box>
        </>
    );
}
