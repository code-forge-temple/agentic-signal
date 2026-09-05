/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {type NodeProps} from "@xyflow/react";
import {useCallback, useEffect, useState} from "react";
import {assertIsDelayedSnapshotNodeData} from "./types/workflow";
import {BaseNode} from "../BaseNode";
import {BaseDialog} from "../../BaseDialog";
import {LogsDialog} from "../../LogsDialog";
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


export function DelayedSnapshotNode ({id, data}: NodeProps<AppNode>) {
    assertIsEnhancedNodeData(data);
    assertIsDelayedSnapshotNodeData(data);

    const [openOutput, setOpenOutput] = useState(false);
    const [openSettings, setOpenSettings] = useState(false);
    const [openLogs, setOpenLogs] = useState(false);
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

        onConfigChange(id, {isDelayPending: true});
        await graphQLService.startTimer(id, {
            mode: TIMER_NODE_MODES.INTERVAL,
            interval: delaySeconds,
            immediate: false,
            runOnce: true,
        });
    }, [id, delaySeconds, onConfigChange, onResultUpdate]);

    useEffect(() => {
        if (!isDelayPending) return;

        const unsubscribe = graphQLService.subscribeToTimer(
            id,
            () => {
                onConfigChange(id, {isDelayPending: false});
                emitSnapshot();
            },
            () => {
                onConfigChange(id, {isDelayPending: false});
                emitSnapshot();
            }
        );

        return () => { unsubscribe(); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isDelayPending, id]);

    useAutoRunOnInputChange({
        clearError: () => setError(null),
        clearOutput: () => { onResultUpdate(id); },
        runCallback: () => {
            runTask(async () => {
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
            runTask(async () => {
                onConfigChange(id, {isDelayPending: false});
                await graphQLService.stopTimer(id);
            }, setIsRunning);

            return;
        }

        runTask(async () => {
            await scheduleForward(persistedPayload, persistedToolsPayload);
        }, setIsRunning);
    }, [id, isDelayPending, onConfigChange, scheduleForward, persistedPayload, persistedToolsPayload]);

    const hasSnapshot = persistedPayload !== undefined || persistedToolsPayload !== undefined;

    return (
        <>
            <BaseNode
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
                logs={{callback: () => setOpenLogs(true), highlight: error !== null}}
            />

            <LogsDialog
                open={openLogs}
                onClose={() => setOpenLogs(false)}
                title={title}
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
