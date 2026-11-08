/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {useCallback, useEffect, useRef} from "react";
import {useLayers} from "../../../../../hooks/useLayers";
import {AI_LAYER} from "../../../../../context/LayersContextBase";
import {CommandError, CommandRouter} from "../../../../../services/commandRouter";
import {NodeEnvelope} from "../../../../../types/workflow";
import {errorMessage} from "@shared/utils";


// The new workflow's Workflow Input should be listening well within this.
const LISTENER_WAIT_MS = 5000;

/** Runs the chat's commands on the AI Buddy layer, out of the user's sight unless they look. */
export function useAiLayerRun () {
    const {getLayerApi} = useLayers();
    const abortControllerRef = useRef<AbortController | null>(null);

    useEffect(() => () => abortControllerRef.current?.abort(), []);

    /** Puts `workflow` on the AI Buddy layer in place of what was there, and calls its `command` with `input`. */
    const run = useCallback((command: string, workflow: unknown, input: NodeEnvelope): Promise<NodeEnvelope> => {
        const layer = getLayerApi(AI_LAYER.id);

        if (!layer) return Promise.reject(new CommandError("no_listener", `The ${AI_LAYER.name} layer isn't ready.`));

        try {
            layer.replaceWorkflow(JSON.stringify(workflow));
        } catch (error) {
            return Promise.reject(new CommandError("no_listener", `The workflow couldn't be loaded: ${errorMessage(error)}`));
        }

        abortControllerRef.current?.abort();

        const controller = new AbortController();

        abortControllerRef.current = controller;

        // In the same task as the replace: React mounts the new nodes only later, so the new workflow's
        // Workflow Input starts listening after this call, and the old one still mounted is passed over.
        return CommandRouter.getInstance().request({
            command,
            input,
            source: "chat",
            awaitNewListener: true,
            signal: controller.signal,
            queueTimeoutMs: LISTENER_WAIT_MS,
        });
    }, [getLayerApi]);

    /** Ends the run and empties the AI Buddy layer: unmounting its nodes stops what they were doing. */
    const stop = useCallback(() => {
        abortControllerRef.current?.abort();
        getLayerApi(AI_LAYER.id)?.clear();
    }, [getLayerApi]);

    return {run, stop};
}
