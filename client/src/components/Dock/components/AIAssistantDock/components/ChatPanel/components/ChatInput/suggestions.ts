/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {Suggestion} from './components/ChatInputSuggestions';


/**
 * The options matching the word typed so far ("/wea", "@cur"), best first: those starting with it, then,
 * from two letters on (one letter would match nearly everything), those containing it after its `/` or `@`.
 * The menu highlights the first, so Enter picks the likeliest.
 */
export function matchingSuggestions (options: Suggestion[], typed: string): Suggestion[] {
    const query = typed.toLowerCase();
    const starting = options.filter(option => option.value.toLowerCase().startsWith(query));
    const containing = query.length > 2
        ? options.filter(option => !starting.includes(option) && option.value.toLowerCase().includes(query.slice(1)))
        : [];

    return [...starting, ...containing];
}
