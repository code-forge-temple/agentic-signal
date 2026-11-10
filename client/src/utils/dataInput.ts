/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {NodeEnvelope} from "../types/workflow";


// A timer trigger arrives as an input of its own: the trigger and nothing else.
const isTimerTriggerOnly = (input: NodeEnvelope) => input.timerTrigger !== undefined && input.payload === undefined && input.toolsPayload === undefined;

/**
 * The input, unless it's only a timer trigger: a node that runs on new input and also on its timer watches this, so a
 * trigger runs it once (through its timer), not twice. It is the input itself, new with each delivery, so the same
 * data sent again still runs the node.
 */
export const dataInput = (input: NodeEnvelope | undefined): NodeEnvelope | undefined =>
    (input === undefined || isTimerTriggerOnly(input) ? undefined : input);
