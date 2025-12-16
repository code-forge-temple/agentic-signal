/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {useCallback, useEffect, useState, useRef} from "react";
import {Handle, Position, type NodeProps} from "@xyflow/react";
import {BaseNode} from "../BaseNode";
import {assertIsTimerNodeData} from "./types/workflow";
import {TIMER_TRIGGER_PORT_COLOR, TIMER_TRIGGER_PORT_ID} from "../../../constants";
import {BaseDialog} from "../../BaseDialog";
import {FormControlLabel, Switch} from "@mui/material";
import {DebouncedTextField} from "../../DebouncedTextField";
import {Icon} from "./constants";
import {AppNode} from "../workflow.gen";
import {assertIsEnhancedNodeData} from "../../../types/workflow";


export function TimerNode ({data, id}: NodeProps<AppNode>) {
    assertIsEnhancedNodeData(data);
    assertIsTimerNodeData(data);

    const [openSettings, setOpenSettings] = useState(false);
    const [isRunning, setIsRunning] = useState(false);
    const {title, interval, immediate, onResultUpdate, onConfigChange} = data;
    const intervalRef = useRef<number | null>(null);

    useEffect(() => {
        if (intervalRef.current !== null) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }

        if (!isRunning) {
            return;
        }

        const trigger = () => {
            onResultUpdate(id, {timerTrigger: Date.now()});
        };

        if (immediate) {
            trigger();
        }

        intervalRef.current = window.setInterval(trigger, Math.max(1, interval) * 1000);

        return () => {
            if (intervalRef.current !== null) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isRunning, interval, immediate, id]);

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

            <BaseDialog open={openSettings} onClose={() => setOpenSettings(false)} title={title}>
                <DebouncedTextField
                    label="Interval (s)"
                    type="number"
                    value={interval}
                    onChange={value => onConfigChange(id, {interval: Number(value)})}
                    fullWidth
                    sx={{mb: 2}}
                />
                <FormControlLabel
                    label="Trigger immediately, then repeat"
                    labelPlacement="start"
                    sx={{ml: 0}}
                    control={
                        <Switch
                            checked={immediate}
                            onChange={e => onConfigChange(id, {immediate: e.target.checked})}
                        />
                    }
                />
            </BaseDialog>
        </>
    );
}