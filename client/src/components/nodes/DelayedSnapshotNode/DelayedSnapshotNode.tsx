/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {type NodeProps} from "@xyflow/react";
import {useCallback, useEffect, useState} from "react";
import {assertIsDelayedSnapshotNodeData} from "./types/workflow";
import {MonitoredNode} from "../MonitoredNode";
import {BaseDialog} from "../../BaseDialog";
import {runTask} from "../BaseNode/utils";
import {useRunOnTriggerChange as useAutoRunOnInputChange} from "../../../hooks/useRunOnTriggerChange";
import {Icon} from "./constants";
import {AppNode} from "../workflow.gen";
import {assertIsEnhancedNodeData, NodeEnvelope} from "../../../types/workflow";
import {BasicTabs} from "../../Tabs/Tabs";
import {PayloadView} from "../../PayloadView/PayloadView";
import {CalculatorTextField} from "../../CalculatorTextField/CalculatorTextField";
import {graphQLService} from "../TimerNode/services/timerService";
import {TIMER_NODE_MODES} from "@shared/types.gen";
import {errorMessage} from "@shared/utils";


export function DelayedSnapshotNode ({id, data}: NodeProps<AppNode>) {
    assertIsEnhancedNodeData(data);
    assertIsDelayedSnapshotNodeData(data);

    const [openOutput, setOpenOutput] = useState(false);
    const [openSettings, setOpenSettings] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isRunning, setIsRunning] = useState(false);

    const {
        title, input, persistedPayload, persistedToolsPayload, delaySeconds, isDelayPending,
        onResultUpdate, onConfigChange
    } = data;

    const emitSnapshot = useCallback(() => {
        onResultUpdate(id, {
            payload: persistedPayload,
            ...(persistedToolsPayload !== undefined ? {toolsPayload: persistedToolsPayload} : {}),
        });
    }, [id, onResultUpdate, persistedPayload, persistedToolsPayload]);

    // Shared by new-input auto-run and manual Run: forwards immediately if no delay is
    // configured, otherwise starts the same server-side timer — so Run mirrors TimerNode's
    // own Run button, which starts the scheduled wait rather than bypassing it.
    const scheduleForward = useCallback(async (
        payloadToForward: NodeEnvelope['payload'],
        toolsPayloadToForward: NodeEnvelope['toolsPayload']
    ) => {
        if (!delaySeconds || delaySeconds <= 0) {
            onConfigChange(id, {isDelayPending: false});
            onResultUpdate(id, {
                payload: payloadToForward,
                ...(toolsPayloadToForward !== undefined ? {toolsPayload: toolsPayloadToForward} : {}),
            });

            return;
        }

        // The timer first, then pending: pending subscribes to the timer, and the server turns away a subscription to a
        // timer it hasn't started.
        try {
            await graphQLService.startTimer(id, {
                mode: TIMER_NODE_MODES.INTERVAL,
                interval: delaySeconds,
                immediate: false,
                runOnce: true,
            });
        } catch (startError) {
            setError(`The delay couldn't start, so nothing was forwarded: ${errorMessage(startError)}`);

            return;
        }

        onConfigChange(id, {isDelayPending: true});
    }, [id, delaySeconds, onConfigChange, onResultUpdate]);

    useEffect(() => {
        if (!isDelayPending) return;

        const unsubscribe = graphQLService.subscribeToTimer(
            id,
            () => {
                onConfigChange(id, {isDelayPending: false});
                emitSnapshot();
            },
            // No timer to wait on (the backend restarted, or a workflow saved while waiting was loaded): the delay is
            // gone. Forwarding now would skip it and run the nodes after this one unasked, so it says so instead.
            (subscriptionError: unknown) => {
                onConfigChange(id, {isDelayPending: false});
                setError(`The delay's timer is gone, so nothing was forwarded; run the node to wait again (${errorMessage(subscriptionError)}).`);
            }
        );

        return () => { unsubscribe(); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isDelayPending, id]);

    useAutoRunOnInputChange({
        clearError: () => setError(null),
        clearOutput: () => { onResultUpdate(id); },
        runCallback: () => {
            void runTask(async () => {
                const newPayload = input?.payload;
                const newToolsPayload = input?.toolsPayload;

                onConfigChange(id, {
                    persistedPayload: newPayload,
                    ...(newToolsPayload !== undefined ? {persistedToolsPayload: newToolsPayload} : {}),
                });

                await scheduleForward(newPayload, newToolsPayload);
            }, setIsRunning);
        }
    }, [input]);

    const handleRun = useCallback(() => {
        setError(null);

        if (isDelayPending) {
            void runTask(async () => {
                onConfigChange(id, {isDelayPending: false});
                await graphQLService.stopTimer(id);
            }, setIsRunning);

            return;
        }

        void runTask(async () => {
            await scheduleForward(persistedPayload, persistedToolsPayload);
        }, setIsRunning);
    }, [id, isDelayPending, onConfigChange, scheduleForward, persistedPayload, persistedToolsPayload]);

    const hasSnapshot = persistedPayload !== undefined || persistedToolsPayload !== undefined;

    return (
        <>
            <MonitoredNode
                id={id}
                nodeIcon={Icon}
                ports={{
                    input: true,
                    output: true
                }}
                title={title}
                run={handleRun}
                running={isRunning || !!isDelayPending}
                stoppable={true}
                settings={{callback: () => setOpenSettings(true), highlight: false}}
                output={{callback: () => setOpenOutput(true), highlight: hasSnapshot}}
                error={error}
            />

            <BaseDialog open={openSettings} onClose={() => setOpenSettings(false)} title={title}>
                <CalculatorTextField
                    label="Delay (s)"
                    fullWidth
                    integer
                    value={delaySeconds ?? 0}
                    onChange={(value) => onConfigChange(id, {delaySeconds: Math.max(0, value)})}
                />
            </BaseDialog>

            <BaseDialog
                open={openOutput}
                onClose={() => setOpenOutput(false)}
                title={title}
            >
                <BasicTabs
                    tabs={[
                        {
                            title: "Payload",
                            content: <PayloadView value={persistedPayload} onError={setError} />
                        },
                        {
                            title: "Tools Payload",
                            content: <PayloadView value={persistedToolsPayload} onError={setError} />
                        }
                    ]}
                />
            </BaseDialog>
        </>
    );
}
