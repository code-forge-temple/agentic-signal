/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {type NodeProps} from "@xyflow/react";
import {useContext, useEffect, useState} from "react";
import {assertIsWorkflowOutputNodeData} from "./types/workflow";
import {BaseNode} from "../BaseNode";
import {BaseDialog} from "../../BaseDialog";
import {Icon} from "./constants";
import {AppNode} from "../workflow.gen";
import {assertIsEnhancedNodeData} from "../../../types/workflow";
import {BasicTabs} from "../../Tabs/Tabs";
import {PayloadView} from "../../PayloadView/PayloadView";
import {WorkflowLayerContext} from "../../../context/WorkflowLayerContext";
import {CommandRouter} from "../../../services/commandRouter";


// A payload that can't be formatted shows as "No output available". It says nothing about the run,
// so it isn't the node's error: that would fail the command it serves.
const ignoreDisplayError = () => {};

export function WorkflowOutputNode ({id, data}: NodeProps<AppNode>) {
    assertIsEnhancedNodeData(data);
    assertIsWorkflowOutputNodeData(data);

    const {layerId} = useContext(WorkflowLayerContext);
    const [openOutput, setOpenOutput] = useState(false);
    const {title, input} = data;

    // The workflow hands data on by setting this node's input, as for any node; it goes back to the
    // caller of the command this layer is serving. With none, the router drops it and it only shows here.
    useEffect(() => {
        if (input !== undefined && layerId) CommandRouter.getInstance().reportResult(layerId, input);
    }, [layerId, input]);

    return (
        <>
            <BaseNode
                id={id}
                nodeIcon={Icon}
                ports={{
                    input: true
                }}
                title={title}
                output={{callback: () => setOpenOutput(true), highlight: input !== undefined}}
            />

            <BaseDialog
                open={openOutput}
                onClose={() => setOpenOutput(false)}
                title={title}
            >
                <BasicTabs
                    tabs={[
                        {
                            title: "Payload",
                            content: <PayloadView value={input?.payload} onError={ignoreDisplayError} />
                        },
                        {
                            title: "Tools Payload",
                            content: <PayloadView value={input?.toolsPayload} onError={ignoreDisplayError} />
                        }
                    ]}
                />
            </BaseDialog>
        </>
    );
}
