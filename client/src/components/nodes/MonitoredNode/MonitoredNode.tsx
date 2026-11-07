/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {useContext, useEffect, useState} from "react";
import {useReactFlow} from "@xyflow/react";
import {BaseNode, type BaseNodeProps} from "../BaseNode";
import {LogsDialog} from "../../LogsDialog";
import {WorkflowLayerContext} from "../../../context/WorkflowLayerContext";
import {CommandRouter} from "../../../services/commandRouter";


type MonitoredNodeProps = Omit<BaseNodeProps, "logs"> & {
    /** The node's error log, shown in its logs dialog; the logs button is highlighted while it holds an error. */
    error: string | string[] | null;
};

/**
 * A BaseNode its layer keeps an eye on: it owns the node's logs button and dialog, and passes each new error on to
 * the command the layer is serving, if any (the first one fails it).
 */
export const MonitoredNode = ({error, ...baseNodeProps}: MonitoredNodeProps) => {
    const {id, title} = baseNodeProps;
    const {layerId} = useContext(WorkflowLayerContext);
    const {getNode} = useReactFlow();
    const [openLogs, setOpenLogs] = useState(false);
    const hasError = Array.isArray(error) ? error.length > 0 : !!error;

    // The router drops the report when the layer serves nothing.
    useEffect(() => {
        const message = Array.isArray(error) ? error[error.length - 1] : error;

        if (!layerId || !message) return;

        CommandRouter.getInstance().reportError(layerId, {nodeId: id, nodeType: getNode(id)?.type ?? "", nodeTitle: title, message});
    }, [layerId, error, getNode, id, title]);

    return (
        <>
            <BaseNode {...baseNodeProps} logs={{callback: () => setOpenLogs(true), highlight: hasError}} />
            <LogsDialog open={openLogs} onClose={() => setOpenLogs(false)} title={title} error={error} />
        </>
    );
};
