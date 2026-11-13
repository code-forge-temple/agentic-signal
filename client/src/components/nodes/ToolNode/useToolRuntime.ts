/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {useEffect, useCallback, useMemo, useRef} from "react";
import {useShallow} from "zustand/react/shallow";
import {ToolNodeData} from "./types/workflow";
import {useSettings} from "../../../hooks/useSettings";
import {EnhancedNodeData} from "../../../types/workflow";
import {useGlobalConfig} from "../../../stores/globalConfig";
import {ToolDefinition} from "./tools/types";
import {missingConfigError, missingConfigKeys, pickedTool, sharedToolValues, toolRuntime} from "./toolConfig";


type ToolRuntimeOptions = {
    id: string;
    selectedTool: ToolDefinition | undefined;
    data: Pick<ToolNodeData, "toolSubtype" | "userConfig" | "handler" | "cleanup"> & Pick<EnhancedNodeData, "onConfigChange">;
};

/**
 * Keeps a tool node's handler and cleanup in step with its settings and the tool's shared ones: built again after every
 * change once each required setting has a value, dropped (the node's error naming the missing settings) while one hasn't.
 */
export function useToolRuntime ({id, selectedTool, data}: ToolRuntimeOptions) {
    const {toolSubtype, userConfig, handler, cleanup, onConfigChange} = data;
    const {settings} = useSettings();
    // Only this tool's shared values: another tool's key or token changing doesn't rebuild this node's handler.
    const shared = useGlobalConfig(useShallow(state => sharedToolValues(selectedTool, state.globalData)));
    const missingKeys = useMemo(
        () => (selectedTool ? missingConfigKeys(selectedTool, shared, userConfig) : []),
        [selectedTool, shared, userConfig]
    );
    // The handler and cleanup as last rendered: the effect below reads them here rather than depending on them, as
    // it would otherwise run again each time it sets them.
    const runtimeRef = useRef({handler, cleanup});
    // The settings as last saved, ahead of the render that shows them: a save from a callback made earlier (a field's
    // debounced save, a sign-in finishing) builds on them, not on the settings of its own render, which would undo
    // whatever was saved in between.
    const userConfigRef = useRef(userConfig);
    // The tool the node has now, ahead of the render that shows it (a pick sets it at once).
    const toolRef = useRef(selectedTool);

    useEffect(() => {
        runtimeRef.current = {handler, cleanup};
    });

    useEffect(() => {
        userConfigRef.current = userConfig;
    }, [userConfig]);

    useEffect(() => {
        toolRef.current = selectedTool;
    }, [selectedTool]);

    useEffect(() => {
        if (!selectedTool) return;

        if (missingKeys.length > 0) {
            if (runtimeRef.current.handler || runtimeRef.current.cleanup) onConfigChange(id, {handler: undefined, cleanup: undefined});

            return;
        }

        onConfigChange(id, toolRuntime(selectedTool, shared, userConfig, settings.browserPath));
    }, [selectedTool, missingKeys, shared, userConfig, onConfigChange, id, settings.browserPath]);

    // Only saves the setting: the effect above then checks the new settings and builds (or drops) the handler. A save
    // from the settings of a tool picked before (a sign-in finishing after the switch) is dropped: the setting isn't this
    // tool's, and a secret of that tool would not be removed when the workflow is saved.
    const handleUserConfigChange = useCallback((key: string, value: string | number | boolean) => {
        if (toolRef.current !== selectedTool) return;

        const next = {...(userConfigRef.current || {}), [key]: value};

        userConfigRef.current = next;
        onConfigChange(id, {userConfig: next});
    }, [id, onConfigChange, selectedTool]);

    // A picked tool brings its own settings, which the saves made in its settings build on.
    const pickTool = useCallback((tool: ToolDefinition) => {
        const picked = pickedTool(tool);

        toolRef.current = tool;
        userConfigRef.current = picked.userConfig;
        onConfigChange(id, picked);
    }, [id, onConfigChange]);

    return {
        error: selectedTool && missingKeys.length > 0 ? missingConfigError(selectedTool, missingKeys) : null,
        hasMissingConfig: !toolSubtype || missingKeys.length > 0,
        handleUserConfigChange,
        pickTool,
    };
}
