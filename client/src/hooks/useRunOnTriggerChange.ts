/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {useEffect} from "react";
import {NodeEnvelope} from "../types/workflow";
import {dataInput} from "../utils/dataInput";

type UseRunOnTriggerChangeProps = {
    clearError: () => void;
    clearOutput: () => void;
    runCallback: () => void | Promise<void>;
}

export function useRunOnTriggerChange ({clearError, clearOutput, runCallback}: UseRunOnTriggerChangeProps, changeTriggers: any[] = []) {
    useEffect(() => {
        if (!changeTriggers.some((trigger) => trigger == undefined)) {
            clearError();
            clearOutput();

            void runCallback();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, changeTriggers);
}

/**
 * Runs when the node's input changes. A timer trigger alone doesn't count: a node with a timer port runs on it through
 * useTimerTrigger, once, not a second time as new input.
 */
export function useRunOnInputChange (props: UseRunOnTriggerChangeProps, input: NodeEnvelope | undefined) {
    useRunOnTriggerChange(props, [dataInput(input)]);
}
