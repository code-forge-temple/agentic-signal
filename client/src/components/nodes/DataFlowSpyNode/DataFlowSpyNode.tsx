/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {type NodeProps} from "@xyflow/react";
import {assertIsDataFlowSpyNodeData} from "./types/workflow";
import {useState} from "react";
import {BaseNode} from "../BaseNode";
import {BaseDialog} from "../../BaseDialog";
import {LogsDialog} from "../../LogsDialog";
import {Icon} from "./constants";
import {AppNode} from "../workflow.gen";
import {assertIsEnhancedNodeData} from "../../../types/workflow";
import {BasicTabs} from "../../Tabs/Tabs";
import {PayloadView} from "../../PayloadView/PayloadView";


export function DataFlowSpyNode ({id, data}: NodeProps<AppNode>) {
    assertIsEnhancedNodeData(data);
    assertIsDataFlowSpyNodeData(data);

    const [openOutput, setOpenOutput] = useState(false);
    const [openLogs, setOpenLogs] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const {title, input} = data;
    const hasOutput = input?.payload !== undefined || input?.toolsPayload !== undefined;

    return (
        <>
            <BaseNode
                id={id}
                nodeIcon={Icon}
                ports={{
                    input: true
                }}
                title={title}
                output={{callback: () => setOpenOutput(true), highlight: hasOutput}}
                logs={{callback: () => setOpenLogs(true), highlight: error !== null}}
            />

            <LogsDialog
                open={openLogs}
                onClose={() => setOpenLogs(false)}
                title={title}
                error={error}
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
                            content: <PayloadView value={input?.payload} onError={setError} />
                        },
                        {
                            title: "Tools Payload",
                            content: <PayloadView value={input?.toolsPayload} onError={setError} />
                        }
                    ]}
                />
            </BaseDialog>
        </>
    );
}
