/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {NormalizedJob} from "../types.ts";
import {fetchJson, parseRegionList, stripHtml} from "../utils.ts";

/**
 * Ashby job board posting API — free, no key.
 * `applyUrl` points straight to the application form; `isRemote` / `employmentType`
 * / `publishedAt` are first-class fields.
 */
type AshbyJob = {
    id: string;
    title: string;
    department?: string;
    team?: string;
    employmentType?: string;
    location?: string;
    secondaryLocations?: { location?: string }[];
    publishedAt?: string;
    isListed?: boolean;
    isRemote?: boolean;
    workplaceType?: string;
    jobUrl: string;
    applyUrl: string;
    descriptionHtml?: string;
    descriptionPlain?: string;
    compensation?: { compensationTierSummary?: string };
};

type AshbyResponse = { jobs?: AshbyJob[] };

const EMPLOYMENT_LABEL: Record<string, string> = {
    FullTime: "Full-time",
    PartTime: "Part-time",
    Intern: "Internship",
    Contract: "Contract",
    Temporary: "Temporary",
};

export async function fetchAshby (token: string): Promise<NormalizedJob[]> {
    const data = await fetchJson<AshbyResponse>(
        `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(token)}?includeCompensation=true`,
        `Ashby (${token})`
    );

    return (data.jobs ?? [])
        .filter(job => job.isListed !== false)
        .map((job): NormalizedJob => {
            const locations = [job.location, ...(job.secondaryLocations ?? []).map(s => s.location)]
                .filter((l): l is string => Boolean(l));
            const location = locations.join(", ");
            const summary = job.compensation?.compensationTierSummary?.trim();

            return {
                source: "ashby",
                ats: "ashby",
                id: job.id,
                title: job.title,
                company: token,
                companyToken: token,
                department: job.department,
                url: job.jobUrl,
                applyUrl: job.applyUrl,
                location: location || "Not specified",
                isRemote: job.isRemote === true || job.workplaceType === "Remote" || /\bremote\b/i.test(location),
                candidateLocations: locations.flatMap(parseRegionList),
                eligibleFromTarget: null,
                eligibilityConfidence: "low",
                employmentType: job.employmentType ? EMPLOYMENT_LABEL[job.employmentType] ?? job.employmentType : undefined,
                salary: summary ? {raw: summary} : undefined,
                tags: [job.department, job.team].filter((t): t is string => Boolean(t)),
                postedAt: job.publishedAt || undefined,
                descriptionHtml: job.descriptionHtml || undefined,
                descriptionText: job.descriptionPlain || stripHtml(job.descriptionHtml),
                raw: job,
            };
        });
}
