/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {type NodeProps} from "@xyflow/react";
import {useCallback, useState} from "react";
import {assertIsJobSearchNodeData, JobSearchNodeData} from "./types/workflow";
import {JobSearchService} from "./services/jobSearchService";
import {MonitoredNode} from "../MonitoredNode";
import {runTask} from "../BaseNode/utils";
import {useTimerTrigger} from "../../../hooks/useTimerTrigger";
import {useRunOnInputChange as useAutoRunOnInputChange} from "../../../hooks/useRunOnTriggerChange";
import {useLatestValue} from "../../../hooks/useLatestValue";
import {TimerTriggerPort} from "../TimerNode/TimerTriggerPort";
import {Icon} from "./constants";
import {AppNode} from "../workflow.gen";
import {assertIsEnhancedNodeData} from "../../../types/workflow";
import {hasNoCompanies, searchFields, searchRequest} from "./utils/searchFields";
import {JobSearchSettings} from "./components/JobSearchSettings";


export function JobSearchNode ({data, id}: NodeProps<AppNode>) {
    assertIsEnhancedNodeData(data);
    assertIsJobSearchNodeData(data);

    const [isRunning, setIsRunning] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [openSettings, setOpenSettings] = useState(false);
    const {input, title, seedCompanies, dataProvidedByUpstream, onResultUpdate, onConfigChange} = data;
    const dataProvidedByUpstreamRef = useLatestValue(dataProvidedByUpstream);
    const openSettingsRef = useLatestValue(openSettings);
    const fields = searchFields(data, input?.payload, dataProvidedByUpstream);
    const change = (changes: Partial<JobSearchNodeData>) => onConfigChange(id, changes);

    const runSearch = useCallback(async () => {
        setError(null);
        onResultUpdate(id);

        const runFields = searchFields(data, input?.payload, dataProvidedByUpstreamRef.current);

        if (hasNoCompanies(seedCompanies, runFields.companies)) {
            setError("Add at least one company, or select some from the built-in list, in the node settings.");
            onResultUpdate(id);

            return;
        }

        await runTask(async () => {
            try {
                const result = await JobSearchService.search(searchRequest(data, runFields));

                onResultUpdate(id, {payload: result, ...(input?.toolsPayload !== undefined ? {toolsPayload: input.toolsPayload} : {})});
            } catch (err) {
                setError(`Job search failed: ${err instanceof Error ? err.message : "Unknown error"}`);
                onResultUpdate(id);
            }
        }, setIsRunning);
    }, [id, data, input, seedCompanies, onResultUpdate, dataProvidedByUpstreamRef]);

    useAutoRunOnInputChange({
        clearError: () => setError(null),
        clearOutput: () => onResultUpdate(id),
        runCallback: () => {
            if (dataProvidedByUpstreamRef.current && !openSettingsRef.current) {
                void runSearch();
            }
        },
    }, input);

    useTimerTrigger(input?.timerTrigger, runSearch);

    const missingCompanies = hasNoCompanies(seedCompanies, fields.companies);

    return (
        <>
            <MonitoredNode
                id={id}
                nodeIcon={Icon}
                ports={{input: true, output: true}}
                extraPorts={<TimerTriggerPort />}
                title={title}
                settings={{callback: () => setOpenSettings(true), highlight: missingCompanies}}
                run={runSearch}
                running={isRunning}
                error={error}
            />
            <JobSearchSettings
                open={openSettings}
                onClose={() => setOpenSettings(false)}
                id={id}
                title={title}
                data={data}
                fields={fields}
                missingCompanies={missingCompanies}
                change={change}
            />
        </>
    );
}
