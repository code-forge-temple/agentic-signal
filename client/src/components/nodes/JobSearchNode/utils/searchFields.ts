/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {getField} from "../../../../utils";
import {JobSearchNodeData} from "../types/workflow";
import type {JobSearchConfig} from "../services/jobSearchService";


type OwnFields = Pick<JobSearchNodeData, "companies" | "keywords" | "candidateRegion">;

/**
 * The companies, keywords and region a search uses. When they're provided by upstream, each one the input gives
 * replaces the node's own; one the input leaves out or empty keeps it.
 */
export function searchFields (own: OwnFields, payload: unknown, fromUpstream: boolean | undefined): OwnFields {
    const upstream = fromUpstream ? payload : undefined;

    return {
        companies: getField(upstream, "companies", own.companies),
        keywords: getField(upstream, "keywords", own.keywords),
        candidateRegion: getField(upstream, "candidateRegion", own.candidateRegion),
    };
}

/** What the job search service gets: the node's settings, with the fields worked out for this run. */
export const searchRequest = (data: JobSearchNodeData, fields: OwnFields): JobSearchConfig => ({
    seedCompanies: data.seedCompanies,
    remoteOnly: data.remoteOnly,
    employmentTypes: data.employmentTypes,
    datePosted: data.datePosted,
    seniority: data.seniority,
    filterByEligibility: data.filterByEligibility,
    maxCompanies: data.maxCompanies,
    resultsLimit: data.resultsLimit,
    ...fields,
});

/** Whether a search has no company to look at: none picked from the built-in list, none typed. */
export const hasNoCompanies = (seedCompanies: string[], companies: string): boolean => seedCompanies.length === 0 && !companies?.trim();

/** A typed limit kept within its range; text that isn't a number, or 0, gives `fallback`. */
export const clampLimit = (text: unknown, min: number, max: number, fallback: number): number =>
    Math.max(min, Math.min(max, Number(text) || fallback));
