/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {
    CompanyError,
    CompanyRef,
    EmploymentType,
    JobSearchFilters,
    JobSearchResult,
    NormalizedJob,
    UnresolvedCompany,
} from "./types.ts";
import {PROVIDERS, keyOf, resolveAndFetch} from "./ats/index.ts";
import {getCachedJobs, setCachedJobs} from "./cache.ts";
import {
    datePostedCutoff,
    evaluateEligibility,
    matchesKeywords,
    matchesSeniority,
    pool,
    withinDateWindow,
} from "./utils.ts";
import seedCompanies from "./data/seed-companies.json" with {type: "json"};

const CONCURRENCY = 8;

const EMPLOYMENT_MATCH: Record<EmploymentType, RegExp> = {
    full_time: /full[\s-]?time/i,
    part_time: /part[\s-]?time/i,
    contract: /contract|contractor|freelance|temporary/i,
    internship: /intern/i,
};

function resolveCompanyList (filters: JobSearchFilters): (CompanyRef | UnresolvedCompany)[] {
    const seen = new Set<string>();
    const list: (CompanyRef | UnresolvedCompany)[] = [];

    const add = (entry: CompanyRef | UnresolvedCompany) => {
        const k = keyOf(entry);

        if (seen.has(k)) return;

        seen.add(k);
        list.push(entry);
    };

    // User entries win priority (added first) over the selected seed companies.
    for (const entry of filters.companies) add(entry);

    const wantedSeed = new Set(filters.seedCompanies);

    for (const s of seedCompanies as CompanyRef[]) {
        if (s.ats in PROVIDERS && wantedSeed.has(keyOf(s))) add(s);
    }

    return list.slice(0, filters.maxCompanies);
}

function dedupeKey (job: NormalizedJob): string {
    const company = job.company.toLowerCase().replace(/[^a-z0-9]+/g, "");
    const title = job.title.toLowerCase().replace(/\s+/g, " ").replace(/[^a-z0-9 ]+/g, "").trim();

    return `${company}::${title}`;
}

class JobSearchService {
    async search (filters: JobSearchFilters): Promise<JobSearchResult> {
        const companies = resolveCompanyList(filters);
        const errors: CompanyError[] = [];
        const collected: NormalizedJob[] = [];
        let reachable = 0;

        await pool(companies, CONCURRENCY, async (entry) => {
            const cacheKey = entry.ats === "auto" ? null : keyOf(entry);
            const cached = cacheKey ? getCachedJobs(cacheKey) : undefined;

            if (cached) {
                reachable++;
                collected.push(...cached);

                return;
            }

            try {
                const {ats, jobs} = await resolveAndFetch(entry);

                reachable++;
                setCachedJobs(`${ats}:${entry.token}`, jobs);
                collected.push(...jobs);
            } catch (err) {
                errors.push({
                    company: entry.token,
                    ats: entry.ats,
                    message: err instanceof Error ? err.message : String(err),
                });
            }
        });

        const jobsFetched = collected.length;
        const cutoff = datePostedCutoff(filters.datePosted);

        let jobs = collected.filter(job =>
            matchesKeywords(filters.keywords, job.title, [...job.tags, job.department ?? ""])
            && (!filters.remoteOnly || job.isRemote)
            && withinDateWindow(job.postedAt, cutoff)
            && matchesSeniority(filters.seniority, job.seniority, job.title)
            && (filters.employmentTypes.length === 0
                || filters.employmentTypes.some(t => EMPLOYMENT_MATCH[t].test(job.employmentType ?? "")))
        );

        // Tag eligibility against the free-text location.
        for (const job of jobs) {
            const {eligible, confidence} = evaluateEligibility(job.candidateLocations, filters.candidateRegion);

            job.eligibleFromTarget = eligible;
            job.eligibilityConfidence = confidence;
        }

        const afterFilter = jobs.length;

        const seen = new Set<string>();

        jobs = jobs.filter(job => {
            const k = dedupeKey(job);

            if (seen.has(k)) return false;

            seen.add(k);

            return true;
        });

        const afterDedupe = jobs.length;

        if (filters.filterByEligibility && filters.candidateRegion.trim()) {
            jobs = jobs.filter(job => !(job.eligibleFromTarget === false && job.eligibilityConfidence === "high"));
        }

        jobs.sort((a, b) => {
            const ta = a.postedAt ? Date.parse(a.postedAt) : 0;
            const tb = b.postedAt ? Date.parse(b.postedAt) : 0;

            return tb - ta;
        });

        jobs = jobs.slice(0, filters.resultsLimit);

        return {
            jobs,
            counts: {
                companies: companies.length,
                reachable,
                jobsFetched,
                afterFilter,
                afterDedupe,
                returned: jobs.length,
            },
            errors,
        };
    }
}

export const jobSearchService = new JobSearchService();
