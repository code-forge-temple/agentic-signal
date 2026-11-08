/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {ChatEntry, NOTICE_ROLE} from "../constants";


/**
 * The chat with a line marking a switch from `previousModel` to `model` at its end. Another switch straight after
 * updates that line, and switching straight back removes it. An empty chat needs no line.
 */
export function withModelSwitch (entries: ChatEntry[], model: string, previousModel: string): ChatEntry[] {
    const last = entries[entries.length - 1];

    if (!last) return entries;

    if (last.role !== NOTICE_ROLE) return [...entries, {role: NOTICE_ROLE, model, previousModel}];

    const rest = entries.slice(0, -1);

    return model === last.previousModel ? rest : [...rest, {...last, model}];
}
