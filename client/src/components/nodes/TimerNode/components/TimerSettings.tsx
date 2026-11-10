/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {FormControl, FormControlLabel, InputLabel, MenuItem, Select, Stack, Switch, TextField} from "@mui/material";
import {BaseDialog} from "../../../BaseDialog";
import {CalculatorTextField} from "../../../CalculatorTextField/CalculatorTextField";
import {isoToLocalDatetime, localDatetimeToIso} from "../../../../utils";
import {defaultTimerNodeData, IntervalTimerConfig, SCHEDULED_TIMER_REPEATS, ScheduledTimerConfig, TIMER_NODE_MODES, TimerNodeData} from "../types/workflow";


type ChangeData = (data: Partial<TimerNodeData>) => void;

function IntervalFields ({data, change}: {data: IntervalTimerConfig; change: ChangeData}) {
    return (
        <>
            <CalculatorTextField
                label="Interval (s)"
                integer
                value={data.interval}
                onChange={value => change({interval: value})}
                fullWidth
                sx={{mb: 2}}
            />
            <Stack spacing={2} sx={{alignItems: 'flex-start'}}>
                <FormControlLabel
                    label="Run once"
                    labelPlacement="end"
                    sx={{ml: 0, mb: 2}}
                    control={
                        <Switch
                            checked={data.runOnce || false}
                            // A run-once timer has no "then repeat".
                            onChange={event => change({runOnce: event.target.checked, immediate: event.target.checked ? false : data.immediate})}
                        />
                    }
                />
                <FormControlLabel
                    label="Trigger immediately, then repeat"
                    labelPlacement="end"
                    sx={{ml: 0}}
                    control={
                        <Switch
                            checked={data.immediate || false}
                            disabled={data.runOnce}
                            onChange={event => change({immediate: event.target.checked})}
                        />
                    }
                />
            </Stack>
        </>
    );
}

function ScheduledFields ({data, change}: {data: ScheduledTimerConfig; change: ChangeData}) {
    return (
        <>
            <TextField
                label="Scheduled Date & Time"
                type="datetime-local"
                value={isoToLocalDatetime(data.scheduledDateTime)}
                onChange={event => change({scheduledDateTime: localDatetimeToIso(event.target.value)})}
                fullWidth
                sx={{mb: 2}}
                slotProps={{inputLabel: {shrink: true}}}
            />
            <FormControl fullWidth size="small" sx={{mb: 2}}>
                <InputLabel id="repeat-label">Repeat</InputLabel>
                <Select
                    labelId="repeat-label"
                    label="Repeat"
                    value={data.repeat}
                    onChange={event => change({repeat: event.target.value})}
                >
                    <MenuItem value={SCHEDULED_TIMER_REPEATS.ONCE}>Once</MenuItem>
                    <MenuItem value={SCHEDULED_TIMER_REPEATS.DAILY}>Daily</MenuItem>
                    <MenuItem value={SCHEDULED_TIMER_REPEATS.WEEKLY}>Weekly</MenuItem>
                    <MenuItem value={SCHEDULED_TIMER_REPEATS.MONTHLY}>Monthly</MenuItem>
                </Select>
            </FormControl>
        </>
    );
}

type TimerSettingsProps = {
    open: boolean;
    onClose: () => void;
    title: string;
    data: TimerNodeData;
    change: ChangeData;
};

/** The Timer node's settings dialog: a mode, then that mode's settings. Switching modes starts from its defaults. */
export function TimerSettings ({open, onClose, title, data, change}: TimerSettingsProps) {
    return (
        <BaseDialog open={open} onClose={onClose} title={title}>
            <FormControl fullWidth size="small" sx={{mb: 2}}>
                <InputLabel id="timer-mode-label">Timer Mode</InputLabel>
                <Select
                    labelId="timer-mode-label"
                    label="Timer Mode"
                    value={data.mode}
                    onChange={event => change(defaultTimerNodeData[event.target.value])}
                >
                    <MenuItem value={TIMER_NODE_MODES.INTERVAL}>Interval</MenuItem>
                    <MenuItem value={TIMER_NODE_MODES.SCHEDULED}>Scheduled</MenuItem>
                </Select>
            </FormControl>
            {data.mode === TIMER_NODE_MODES.INTERVAL
                ? <IntervalFields data={data} change={change} />
                : <ScheduledFields data={data} change={change} />}
        </BaseDialog>
    );
}
