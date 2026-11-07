/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {type NodeProps} from "@xyflow/react";
import {useContext, useEffect, useState} from "react";
import {assertIsWorkflowInputNodeData} from "./types/workflow";
import {MonitoredNode} from "../MonitoredNode";
import {BaseDialog} from "../../BaseDialog";
import {Icon} from "./constants";
import {AppNode} from "../workflow.gen";
import {assertIsEnhancedNodeData} from "../../../types/workflow";
import {DebouncedTextField} from "../../DebouncedTextField";
import {WorkflowLayerContext} from "../../../context/WorkflowLayerContext";
import {CommandRouter} from "../../../services/commandRouter";
import {useLatestValue} from "../../../hooks/useLatestValue";
import {normalizeCommand} from "../../../workflows/commands";


export function WorkflowInputNode ({id, data}: NodeProps<AppNode>) {
    assertIsEnhancedNodeData(data);
    assertIsWorkflowInputNodeData(data);

    const {layerId, isAiLayer} = useContext(WorkflowLayerContext);
    const [isRunOn, setIsRunOn] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [openSettings, setOpenSettings] = useState(false);
    const {title, command, description, onResultUpdate, onConfigChange} = data;
    const commandName = normalizeCommand(command);
    const descriptionRef = useLatestValue(description);
    // On the AI Buddy layer it listens by itself: its Run button shows as running, and a press there
    // (the layer is read-only) couldn't change that.
    const listening = (isAiLayer || isRunOn) && commandName !== "" && layerId !== null;

    // Each call's input goes out as this node's output, which starts the workflow.
    useEffect(() => {
        if (!listening || !layerId) return;

        return CommandRouter.getInstance().listen(layerId, commandName, (input) => onResultUpdate(id, input), () => descriptionRef.current ?? "");
    }, [listening, layerId, commandName, id, onResultUpdate, descriptionRef]);

    // Run means "start listening", as on Slack Input, not "run once".
    const handleRun = () => {
        if (isRunOn) {
            setIsRunOn(false);

            return;
        }

        if (!commandName) {
            setError("Set a command in the settings first: lowercase letters, digits and hyphens, e.g. research.");

            return;
        }

        setError(null);
        setIsRunOn(true);
    };

    return (
        <>
            <MonitoredNode
                id={id}
                nodeIcon={Icon}
                ports={{
                    output: true
                }}
                title={commandName ? `${title} · /${commandName}` : title}
                run={handleRun}
                running={listening}
                stoppable={true}
                settings={() => setOpenSettings(true)}
                error={error}
            />

            <BaseDialog
                open={openSettings}
                onClose={() => setOpenSettings(false)}
                title={title}
                maxWidth="sm"
            >
                <DebouncedTextField
                    label="Command"
                    variant="outlined"
                    fullWidth
                    value={command}
                    onChange={(value) => onConfigChange(id, {command: value})}
                    error={command.trim() !== "" && !commandName}
                    helperText={commandName
                        ? `Called as /${commandName} in the AI Buddy chat (once saved), or POST /workflows/${commandName} from outside.`
                        : "Lowercase letters, digits and hyphens, e.g. research."}
                    sx={{mt: 1, mb: 2}}
                />
                <DebouncedTextField
                    label="Description"
                    variant="outlined"
                    fullWidth
                    multiline
                    minRows={2}
                    value={description ?? ""}
                    onChange={(value) => onConfigChange(id, {description: value})}
                    helperText="What the command does, shown in the AI Buddy chat's command list."
                />
            </BaseDialog>
        </>
    );
}
