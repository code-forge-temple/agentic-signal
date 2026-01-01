/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {useCallback, useEffect, useRef, useState} from "react";
import {Handle, Position, type NodeProps} from "@xyflow/react";
import {BaseNode} from "../BaseNode";
import {
    assertIsTimerNodeData,
    defaultTimerNodeData,
    IntervalTimerConfig,
    SCHEDULED_TIMER_REPEATS,
    ScheduledTimerConfig,
    TIMER_NODE_MODES,
    TimerNodeData
} from "./types/workflow";
import {TIMER_TRIGGER_PORT_COLOR, TIMER_TRIGGER_PORT_ID} from "../../../constants";
import {BaseDialog} from "../../BaseDialog";
import {FormControlLabel, Switch, FormControl, InputLabel, Select, MenuItem, TextField, Stack} from "@mui/material";
import {DebouncedTextField} from "../../DebouncedTextField";
import {Icon} from "./constants";
import {AppNode} from "../workflow.gen";
import {assertIsEnhancedNodeData} from "../../../types/workflow";
import {graphQLService} from "./services/timerService";
import {LogsDialog} from "../../LogsDialog";
import {isoToLocalDatetime, localDatetimeToIso} from "../../../utils";


function getIntervalData (data: TimerNodeData): IntervalTimerConfig {
    if(data.mode === TIMER_NODE_MODES.INTERVAL) {
        return {
            mode: TIMER_NODE_MODES.INTERVAL,
            interval: data.interval ?? defaultTimerNodeData[TIMER_NODE_MODES.INTERVAL].interval,
            immediate: data.immediate ?? defaultTimerNodeData[TIMER_NODE_MODES.INTERVAL].immediate,
            runOnce: data.runOnce ?? defaultTimerNodeData[TIMER_NODE_MODES.INTERVAL].runOnce
        };
    }

    return defaultTimerNodeData[TIMER_NODE_MODES.INTERVAL];
}

function getScheduledData (data: TimerNodeData): ScheduledTimerConfig {
    if(data.mode === TIMER_NODE_MODES.SCHEDULED) {
        return {
            mode: TIMER_NODE_MODES.SCHEDULED,
            scheduledDateTime: data.scheduledDateTime ?? defaultTimerNodeData[TIMER_NODE_MODES.SCHEDULED].scheduledDateTime,
            repeat: data.repeat ?? defaultTimerNodeData[TIMER_NODE_MODES.SCHEDULED].repeat,
            timezone: data.timezone
        };
    }

    return defaultTimerNodeData[TIMER_NODE_MODES.SCHEDULED];
}

export function TimerNode ({data, id}: NodeProps<AppNode>) {
    assertIsEnhancedNodeData(data);
    assertIsTimerNodeData(data);

    const [openSettings, setOpenSettings] = useState(false);
    const [openLogs, setOpenLogs] = useState(false);
    const [isRunning, setIsRunning] = useState(false);
    const [error, setError] = useState<string[] | null>(null);
    const {title, onResultUpdate, onConfigChange} = data;
    const mode = data.mode;
    const {interval, immediate, runOnce} = getIntervalData(data);
    const {scheduledDateTime, repeat, timezone} = getScheduledData(data);
    const immediateTriggeredRef = useRef(false);

    useEffect(() => {
        if (!isRunning) {
            immediateTriggeredRef.current = false;

            return;
        }

        let unsubscribe: (() => void) | undefined;

        if (mode === TIMER_NODE_MODES.INTERVAL && !runOnce && immediate && !immediateTriggeredRef.current) {
            onResultUpdate(id, {timerTrigger: Date.now()});

            immediateTriggeredRef.current = true;
        }

        const config = mode === TIMER_NODE_MODES.INTERVAL
            ? {mode, interval: interval, runOnce: runOnce, immediate: immediate}
            : {mode, scheduledDateTime: scheduledDateTime, repeat: repeat, timezone};

        graphQLService.startTimer(id, config)
            .then(() => {
                unsubscribe = graphQLService.subscribeToTimer(
                    id,
                    (event) => {
                        onResultUpdate(id, {timerTrigger: event.timestamp});

                        // Auto-stop if run once
                        if ((mode === TIMER_NODE_MODES.INTERVAL && runOnce) || (mode === TIMER_NODE_MODES.SCHEDULED && repeat === SCHEDULED_TIMER_REPEATS.ONCE)) {
                            setIsRunning(false);
                        }
                    },
                    (err) => {
                        const newErrorMessage = `Subscription error: ${err.message || err.toString()}`;

                        setError(prevErrors => prevErrors ? [...prevErrors, newErrorMessage] : [newErrorMessage]);
                    }
                );
            })
            .catch((err) => {
                const newErrorMessage = `Failed to start timer: ${err.message || err.toString()}`;

                setError(prevErrors => prevErrors ? [...prevErrors, newErrorMessage] : [newErrorMessage]);
            });

        return () => {
            unsubscribe?.();

            graphQLService.stopTimer(id).catch(err => {
                const newErrorMessage = `Failed to stop timer: ${err.message || err.toString()}`;

                setError(prevErrors => prevErrors ? [...prevErrors, newErrorMessage] : [newErrorMessage]);
            });
        };
    }, [
        isRunning,
        id,
        onResultUpdate,
        mode,
        interval,
        immediate,
        runOnce,
        scheduledDateTime,
        repeat,
        timezone
    ]);

    const handleRun = useCallback(() => {
        setIsRunning(running => !running);
    }, []);

    return (
        <>
            <BaseNode
                id={id}
                nodeIcon={Icon}
                title={title}
                ports={{}}
                run={handleRun}
                running={isRunning}
                stoppable={true}
                settings={{callback: () => setOpenSettings(true), highlight: false}}
                logs={{callback: () => setOpenLogs(true), highlight: error !== null}}
                extraPorts={
                    <Handle
                        type="source"
                        id={TIMER_TRIGGER_PORT_ID}
                        position={Position.Right}
                        style={{background: TIMER_TRIGGER_PORT_COLOR}}
                        isValidConnection={({targetHandle}) => targetHandle === TIMER_TRIGGER_PORT_ID}
                    />
                }
            />

            <LogsDialog
                open={openLogs}
                onClose={() => setOpenLogs(false)}
                title={title}
                error={error}
            />

            <BaseDialog open={openSettings} onClose={() => setOpenSettings(false)} title={title}>
                <FormControl fullWidth size="small" sx={{mb: 2}}>
                    <InputLabel id="timer-mode-label">Timer Mode</InputLabel>
                    <Select
                        labelId="timer-mode-label"
                        label="Timer Mode"
                        value={data.mode}
                        onChange={(e) => {
                            const newMode = e.target.value;

                            onConfigChange(id, defaultTimerNodeData[newMode]);
                        }}
                    >
                        <MenuItem value={TIMER_NODE_MODES.INTERVAL}>Interval</MenuItem>
                        <MenuItem value={TIMER_NODE_MODES.SCHEDULED}>Scheduled</MenuItem>
                    </Select>
                </FormControl>

                {data.mode === TIMER_NODE_MODES.INTERVAL ? (
                    <>
                        <DebouncedTextField
                            label="Interval (s)"
                            type="number"
                            value={data.interval}
                            onChange={value => onConfigChange(id, {...data, interval: Number(value)})}
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
                                        onChange={e => {
                                            const newRunOnce = e.target.checked;

                                            onConfigChange(id, {
                                                ...data,
                                                runOnce: newRunOnce,
                                                immediate: newRunOnce ? false : data.immediate
                                            });
                                        }}
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
                                        onChange={e => onConfigChange(id, {...data, immediate: e.target.checked})}
                                    />
                                }
                            />
                        </Stack>
                    </>
                ) : (
                    <>
                        <TextField
                            label="Scheduled Date & Time"
                            type="datetime-local"
                            value={isoToLocalDatetime(data.scheduledDateTime)}
                            onChange={e => {
                                const isoString = localDatetimeToIso(e.target.value);

                                onConfigChange(id, {...data, scheduledDateTime: isoString});
                            }}
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
                                onChange={e => onConfigChange(id, {...data, repeat: e.target.value})}
                            >
                                <MenuItem value={SCHEDULED_TIMER_REPEATS.ONCE}>Once</MenuItem>
                                <MenuItem value={SCHEDULED_TIMER_REPEATS.DAILY}>Daily</MenuItem>
                                <MenuItem value={SCHEDULED_TIMER_REPEATS.WEEKLY}>Weekly</MenuItem>
                                <MenuItem value={SCHEDULED_TIMER_REPEATS.MONTHLY}>Monthly</MenuItem>
                            </Select>
                        </FormControl>
                    </>
                )}
            </BaseDialog>
        </>
    );
}