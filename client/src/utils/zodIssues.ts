/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {z} from "zod";


type ZodIssuesOptions = {
    /** Between the parts of a path: "." (0.selector) by default. */
    separator?: string;
    /** Path parts put before each issue's own path (["data"] gives data.title). */
    prefix?: (string | number)[];
    /** The name of the value itself, for an issue with no path ("body"); without one, such an issue is its message alone. */
    rootName?: string;
};

/** What a zod check found wrong, in one line: each issue as "path: message", separated by "; ". */
export const zodIssues = (error: z.ZodError, {separator = ".", prefix = [], rootName}: ZodIssuesOptions = {}): string =>
    error.issues.map((issue) => {
        const name = [...prefix, ...issue.path].join(separator) || rootName;

        return name ? `${name}: ${issue.message}` : issue.message;
    }).join("; ");
