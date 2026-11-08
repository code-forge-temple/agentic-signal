/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {type NodeProps} from "@xyflow/react";
import {useCallback, useState} from "react";
import {assertIsHttpNodeData} from "./types/workflow";
import {MonitoredNode} from "../MonitoredNode";
import {runTask} from "../BaseNode/utils";
import {BaseDialog} from "../../BaseDialog";
import {isTauri, parseUrl} from "../../../utils";
import {html as beautifyHtml} from 'js-beautify';
import {GraphQLService} from "./services/graphqlService";
import {DebouncedTextField} from "../../DebouncedTextField";
import {useTimerTrigger} from "../../../hooks/useTimerTrigger";
import {TimerTriggerPort} from "../TimerNode/TimerTriggerPort";
import {useSettings} from "../../../hooks/useSettings";
import {Icon} from "./constants";
import {AppNode} from "../workflow.gen";
import {assertIsEnhancedNodeData} from "../../../types/workflow";
import {withCredentials} from "../../../services/credentialPlaceholders";


export function HttpNode ({data, id}: NodeProps<AppNode>) {
    assertIsEnhancedNodeData(data);
    assertIsHttpNodeData(data);

    const [isRunning, setIsRunning] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [openSettings, setOpenSettings] = useState(false);
    const {title, url, input, onResultUpdate, onConfigChange} = data;
    const {settings} = useSettings();

    const handleRun = useCallback(() => {
        setError(null);
        onResultUpdate(id);

        void runTask(async () => {
            try {
                if (!url) {
                    throw new Error("URL is required");
                }

                if(!settings.browserPath && isTauri()){
                    throw new Error("Browser executable path must be specified. Please set Browser Executable Path in the app Settings.");
                }

                // `{{NAME}}` credentials in the URL are filled in only to render the page.
                const html = await withCredentials(url, filledUrl => GraphQLService.renderHtml(parseUrl(filledUrl), settings.browserPath));

                onResultUpdate(id, {
                    payload: beautifyHtml(html),
                    ...(input?.toolsPayload !== undefined ? {toolsPayload: input.toolsPayload} : {}),
                });
            } catch (error) {
                setError(`Error fetching rendered page: ${error instanceof Error ? error.message : 'Unknown error'}`);

                onResultUpdate(id);
            }
        }, setIsRunning);
    }, [id, onResultUpdate, settings.browserPath, url, input]);

    useTimerTrigger(input?.timerTrigger, handleRun);

    const hasMissingConfig = !url;

    return (
        <>
            <MonitoredNode
                id={id}
                nodeIcon={Icon}
                ports={{
                    output: true
                }}
                extraPorts = {
                    <TimerTriggerPort />
                }
                title={title}
                settings={{callback: () => setOpenSettings(true), highlight: hasMissingConfig}}
                run={handleRun}
                running={isRunning}
                error={error}
            />

            <BaseDialog
                open={openSettings}
                onClose={() => setOpenSettings(false)}
                title={title}
            >
                <DebouncedTextField
                    label="URL"
                    variant="outlined"
                    fullWidth
                    value={url}
                    onChange={(value) => onConfigChange(id, {url: value})}
                />
            </BaseDialog>
        </>
    );
}