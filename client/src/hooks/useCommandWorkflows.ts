/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {useEffect, useState} from "react";
import {useSettings} from "./useSettings";
import {listWorkflowsFolder} from "../services/workflowsService";
import {BUILTIN_COMMAND_WORKFLOWS, CommandWorkflow, commandWorkflowsFrom, WORKFLOWS_CHANGED_EVENT} from "../workflows";


/** The commands the chat can run: the built-ins and the saved workflows, kept up to date as workflows are saved. */
export function useCommandWorkflows (): CommandWorkflow[] {
    const {settings} = useSettings();
    const [commandWorkflows, setCommandWorkflows] = useState<CommandWorkflow[]>(BUILTIN_COMMAND_WORKFLOWS);

    useEffect(() => {
        let cancelled = false;

        const refresh = async () => {
            try {
                const {files} = await listWorkflowsFolder(settings.workflowsFolder);

                if (!cancelled) setCommandWorkflows(commandWorkflowsFrom(files));
            } catch {
                // Without the backend or the folder, the built-ins still work.
                if (!cancelled) setCommandWorkflows(BUILTIN_COMMAND_WORKFLOWS);
            }
        };
        const onChanged = () => {
            void refresh();
        };

        onChanged();
        window.addEventListener(WORKFLOWS_CHANGED_EVENT, onChanged);

        return () => {
            cancelled = true;
            window.removeEventListener(WORKFLOWS_CHANGED_EVENT, onChanged);
        };
    }, [settings.workflowsFolder]);

    return commandWorkflows;
}
