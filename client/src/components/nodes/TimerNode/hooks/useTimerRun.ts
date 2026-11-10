/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {useCallback, useEffect, useRef, useState} from "react";
import {TimerNodeData, TimerTriggerEvent} from "../types/workflow";
import {graphQLService} from "../services/timerService";
import {runTask} from "../../BaseNode/utils";
import {EnhancedNodeData} from "../../../../types/workflow";
import {firesOnceRightAway, stopsAfterOneTrigger, timerConfig, timerSettings, triggersAsItStarts} from "../utils/timerSettings";


const reasonOf = (error: {message?: string}) => error.message || String(error);

type TimerRunOptions = {id: string; data: TimerNodeData; onResultUpdate: EnhancedNodeData["onResultUpdate"]};

/**
 * Starting and stopping the timer: while it runs, each trigger goes out as the node's output. The backend keeps the
 * time; a run-once timer with no wait fires at once. Failures collect in `error`.
 */
export function useTimerRun ({id, data, onResultUpdate}: TimerRunOptions) {
    const [isRunning, setIsRunning] = useState(false);
    const [error, setError] = useState<string[] | null>(null);
    const triggeredAsItStartedRef = useRef(false);
    const addError = useCallback((message: string) => setError(previous => (previous ? [...previous, message] : [message])), []);
    const {mode, interval, immediate, runOnce, scheduledDateTime, repeat, timezone} = timerSettings(data);

    useEffect(() => {
        if (!isRunning) {
            triggeredAsItStartedRef.current = false;

            return;
        }

        const settings = {mode, interval, immediate, runOnce, scheduledDateTime, repeat, timezone};
        const trigger = (timestamp: number) => onResultUpdate(id, {timerTrigger: timestamp});

        if (firesOnceRightAway(settings)) {
            void runTask(async () => trigger(Date.now()), setIsRunning);

            return;
        }

        if (triggersAsItStarts(settings) && !triggeredAsItStartedRef.current) {
            trigger(Date.now());

            triggeredAsItStartedRef.current = true;
        }

        let unsubscribe: (() => void) | undefined;
        const onTrigger = (event: TimerTriggerEvent) => {
            trigger(event.timestamp);

            if (stopsAfterOneTrigger(settings)) setIsRunning(false);
        };

        graphQLService.startTimer(id, timerConfig(settings))
            .then(() => {
                unsubscribe = graphQLService.subscribeToTimer(id, onTrigger, error => addError(`Subscription error: ${reasonOf(error)}`));
            })
            .catch(error => addError(`Failed to start timer: ${reasonOf(error)}`));

        return () => {
            unsubscribe?.();

            graphQLService.stopTimer(id).catch(error => addError(`Failed to stop timer: ${reasonOf(error)}`));
        };
    }, [isRunning, id, onResultUpdate, mode, interval, immediate, runOnce, scheduledDateTime, repeat, timezone, addError]);

    const toggle = useCallback(() => setIsRunning(running => !running), []);

    return {isRunning, toggle, error};
}
