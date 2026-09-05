/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {jobSearchService} from "./service.ts";
import {parseCompanyLine} from "./ats/index.ts";
import {clampInt} from "./utils.ts";
import {
    CompanyRef,
    DATE_POSTED_OPTIONS,
    DatePosted,
    EMPLOYMENT_TYPES,
    EmploymentType,
    JobSearchFilters,
    SENIORITY_OPTIONS,
    Seniority,
    UnresolvedCompany,
} from "./types.ts";
import {graphqlMethodName} from "./schema.ts";

function parseCompanies (raw: unknown): (CompanyRef | UnresolvedCompany)[] {
    if (typeof raw !== "string") return [];

    return raw
        .split(/[\r\n,]+/)
        .map(parseCompanyLine)
        .filter((c): c is CompanyRef | UnresolvedCompany => c !== null);
}

function normalizeFilters (raw: Record<string, unknown>): JobSearchFilters {
    const employmentTypes = Array.isArray(raw.employmentTypes)
        ? (raw.employmentTypes as unknown[]).filter((t): t is EmploymentType => EMPLOYMENT_TYPES.includes(t as EmploymentType))
        : [];
    const seedCompanies = Array.isArray(raw.seedCompanies)
        ? (raw.seedCompanies as unknown[]).filter((s): s is string => typeof s === "string")
        : [];

    return {
        companies: parseCompanies(raw.companies),
        seedCompanies,
        keywords: typeof raw.keywords === "string" ? raw.keywords : "",
        remoteOnly: raw.remoteOnly === true,
        employmentTypes,
        datePosted: DATE_POSTED_OPTIONS.includes(raw.datePosted as DatePosted) ? raw.datePosted as DatePosted : "any",
        seniority: SENIORITY_OPTIONS.includes(raw.seniority as Seniority) ? raw.seniority as Seniority : "any",
        candidateRegion: typeof raw.candidateRegion === "string" ? raw.candidateRegion : "",
        filterByEligibility: raw.filterByEligibility === true,
        maxCompanies: clampInt(raw.maxCompanies, 1, 400, 60),
        resultsLimit: clampInt(raw.resultsLimit, 1, 500, 100),
    };
}

export const resolver = {
    Query: {
        [graphqlMethodName]: async (
            _parent: unknown,
            {config}: { config: string }
        ): Promise<string> => {
            let parsed: Record<string, unknown>;

            try {
                parsed = JSON.parse(config);
            } catch {
                throw new Error("Job search: `config` is not valid JSON");
            }

            const filters = normalizeFilters(parsed);

            if (filters.companies.length === 0 && filters.seedCompanies.length === 0) {
                throw new Error("Job search: add at least one company, or select some from the built-in list");
            }

            const result = await jobSearchService.search(filters);

            return JSON.stringify(result);
        },
    },
};
