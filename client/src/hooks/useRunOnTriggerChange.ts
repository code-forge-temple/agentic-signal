/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {useEffect} from "react";

type UseRunOnTriggerChangeProps = {
    clearError: () => void;
    clearOutput: () => void;
    runCallback: () => void;
}

export function useRunOnTriggerChange ({clearError, clearOutput, runCallback}: UseRunOnTriggerChangeProps, changeTriggers: any[] = []) {
    useEffect(() => {
        if (!changeTriggers.some((trigger) => trigger == undefined)) {
            clearError();
            clearOutput();

            runCallback();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, changeTriggers);
}
