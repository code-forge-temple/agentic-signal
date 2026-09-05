/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

export const JOB_SEARCH_NODE_TYPE = "job-search";

/**
 * Applicant-tracking systems with free, public, no-key job-board endpoints.
 * The node pulls a company's full posting list from its ATS, then filters locally
 * — these APIs are per-company, not searchable. Workable's public endpoint is
 * rate-limited and best-effort; the other three are reliable.
 */
export const ATS_PROVIDERS = ["greenhouse", "lever", "ashby", "workable"] as const;

export type AtsProvider = typeof ATS_PROVIDERS[number];

/** One company on a specific ATS. `token` is the board slug (e.g. `stripe`). */
export type CompanyRef = {
    ats: AtsProvider;
    token: string;
};

/** A company the user typed that we still need to locate across the ATSs. */
export type UnresolvedCompany = {
    ats: "auto";
    token: string;
};

export const EMPLOYMENT_TYPES = ["full_time", "part_time", "contract", "internship"] as const;

export type EmploymentType = typeof EMPLOYMENT_TYPES[number];

export const DATE_POSTED_OPTIONS = ["any", "today", "3days", "week", "month"] as const;

export type DatePosted = typeof DATE_POSTED_OPTIONS[number];

export const SENIORITY_OPTIONS = ["any", "junior", "mid", "senior", "lead"] as const;

export type Seniority = typeof SENIORITY_OPTIONS[number];

export type JobSearchFilters = {
    /** Explicit companies to pull, `"ats:token"` or a bare slug (auto-located). */
    companies: (CompanyRef | UnresolvedCompany)[];
    /** `"ats:token"` keys selected from the vendored starter company list. */
    seedCompanies: string[];
    keywords: string;
    remoteOnly: boolean;
    employmentTypes: EmploymentType[];
    datePosted: DatePosted;
    seniority: Seniority;
    /** Where the applicant would be based, e.g. "Cyprus", "Europe", "Worldwide". */
    candidateRegion: string;
    /** Drop jobs whose location text clearly excludes `candidateRegion` (best-effort). */
    filterByEligibility: boolean;
    /** Hard cap on how many companies to fan out to in one run. */
    maxCompanies: number;
    /** Hard cap on returned jobs after filtering. */
    resultsLimit: number;
};

export type NormalizedSalary = {
    min?: number;
    max?: number;
    currency?: string;
    period?: string;
    raw?: string;
};

export type NormalizedJob = {
    /** The ATS the job came from. */
    source: AtsProvider;
    ats: AtsProvider;
    id: string;
    title: string;
    company: string;
    companyToken: string;
    department?: string;
    /** The ATS listing page. */
    url: string;
    /** Direct link to the employer's application form — reliably present for these ATSs. */
    applyUrl: string;
    location: string;
    isRemote: boolean;
    /** Regions parsed from the free-text location. Empty = unspecified / worldwide. */
    candidateLocations: string[];
    /** Whether `candidateRegion` is allowed. null = no target set or undetermined. */
    eligibleFromTarget: boolean | null;
    eligibilityConfidence: "high" | "low";
    employmentType?: string;
    seniority?: string;
    salary?: NormalizedSalary;
    tags: string[];
    /** ISO 8601. */
    postedAt?: string;
    descriptionHtml?: string;
    descriptionText?: string;
    raw: unknown;
};

export type CompanyError = {
    company: string;
    ats: AtsProvider | "auto";
    message: string;
};

export type JobSearchResult = {
    jobs: NormalizedJob[];
    /** `companies`, `reachable`, `jobsFetched`, `afterFilter`, `afterDedupe`, `returned`. */
    counts: Record<string, number>;
    errors: CompanyError[];
};
