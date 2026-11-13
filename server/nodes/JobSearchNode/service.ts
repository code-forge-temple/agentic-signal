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
import {errorMessage} from "../../../shared/utils.ts";
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

/** What fetching the companies' jobs gave: the jobs, the companies that failed, and how many answered. */
type FetchedJobs = {collected: NormalizedJob[]; errors: CompanyError[]; reachable: number};

/** Every company's jobs: from the cache when they're there, else fetched (CONCURRENCY at a time) and cached. */
async function fetchCompanyJobs (companies: (CompanyRef | UnresolvedCompany)[]): Promise<FetchedJobs> {
    const fetched: FetchedJobs = {collected: [], errors: [], reachable: 0};

    await pool(companies, CONCURRENCY, async (entry) => {
        const cacheKey = entry.ats === "auto" ? null : keyOf(entry);
        const cached = cacheKey ? getCachedJobs(cacheKey) : undefined;

        if (cached) {
            fetched.reachable++;
            fetched.collected.push(...cached);

            return;
        }

        try {
            const {ats, jobs} = await resolveAndFetch(entry);

            fetched.reachable++;
            setCachedJobs(`${ats}:${entry.token}`, jobs);
            fetched.collected.push(...jobs);
        } catch (err) {
            fetched.errors.push({
                company: entry.token,
                ats: entry.ats,
                message: errorMessage(err),
            });
        }
    });

    return fetched;
}

const matchesEmploymentType = (job: NormalizedJob, types: EmploymentType[]): boolean =>
    types.length === 0 || types.some(t => EMPLOYMENT_MATCH[t].test(job.employmentType ?? ""));

/** Whether the job passes the filters: keywords, remote, date posted, seniority and employment type. */
function matchesFilters (job: NormalizedJob, filters: JobSearchFilters, cutoff: number | null): boolean {
    if (!matchesKeywords(filters.keywords, job.title, [...job.tags, job.department ?? ""])) return false;

    if (filters.remoteOnly && !job.isRemote) return false;

    if (!withinDateWindow(job.postedAt, cutoff)) return false;

    if (!matchesSeniority(filters.seniority, job.seniority, job.title)) return false;

    return matchesEmploymentType(job, filters.employmentTypes);
}

/**
 * The jobs, each tagged with whether its free-text location lets a candidate from `region` apply, and how sure that is.
 * Copies: the jobs are the cache's, shared by every search, and another search's region would retag them.
 */
const withEligibility = (jobs: NormalizedJob[], region: string): NormalizedJob[] => jobs.map((job) => {
    const {eligible, confidence} = evaluateEligibility(job.candidateLocations, region);

    return {...job, eligibleFromTarget: eligible, eligibilityConfidence: confidence};
});

/** The jobs without repeats: the first of each company and title. */
function withoutDuplicates (jobs: NormalizedJob[]): NormalizedJob[] {
    const seen = new Set<string>();

    return jobs.filter((job) => {
        const k = dedupeKey(job);

        if (seen.has(k)) return false;

        seen.add(k);

        return true;
    });
}

const postedTime = (job: NormalizedJob): number => (job.postedAt ? Date.parse(job.postedAt) : 0);

class JobSearchService {
    async search (filters: JobSearchFilters): Promise<JobSearchResult> {
        const companies = resolveCompanyList(filters);
        const {collected, errors, reachable} = await fetchCompanyJobs(companies);
        const jobsFetched = collected.length;
        const cutoff = datePostedCutoff(filters.datePosted);

        let jobs = collected.filter(job => matchesFilters(job, filters, cutoff));
        const afterFilter = jobs.length;

        // Tagged after the repeats are dropped: no work on jobs that won't be returned.
        jobs = withEligibility(withoutDuplicates(jobs), filters.candidateRegion);

        const afterDedupe = jobs.length;

        if (filters.filterByEligibility && filters.candidateRegion.trim()) {
            jobs = jobs.filter(job => !(job.eligibleFromTarget === false && job.eligibilityConfidence === "high"));
        }

        jobs.sort((a, b) => postedTime(b) - postedTime(a));

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
