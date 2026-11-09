/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {defaultLlmProcessNodeData, LlmProcessNodeData} from "../types/workflow";


/** The node's run settings, each falling back to its default. */
export function runSettings (data: LlmProcessNodeData) {
    const defaults = defaultLlmProcessNodeData;

    return {
        maxFeedbackLoops: data.maxFeedbackLoops ?? defaults.maxFeedbackLoops,
        maxToolRetries: data.maxToolRetries ?? defaults.maxToolRetries,
        think: data.think ?? defaults.think,
        temperatureEnabled: data.temperatureEnabled ?? defaults.temperatureEnabled,
        temperature: data.temperature ?? defaults.temperature,
        orchestrationMode: data.orchestrationMode ?? defaults.orchestrationMode,
    };
}

/** A typed count kept within its range; null when the text isn't a number, as in a cleared field. */
export function countWithin (text: string, min: number, max: number): number | null {
    const count = parseInt(text);

    return Number.isNaN(count) ? null : Math.max(min, Math.min(max, count));
}

/** The run settings an AI request takes: the temperature only while it is turned on. */
export function requestSettings (data: LlmProcessNodeData) {
    const {maxToolRetries, think, temperatureEnabled, temperature, orchestrationMode} = runSettings(data);

    return {maxToolRetries, think, orchestrationMode, temperature: temperatureEnabled ? temperature : undefined};
}
