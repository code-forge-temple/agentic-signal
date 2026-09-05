/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {NormalizedJob} from "../types.ts";
import {fetchJson, parseRegionList, stripHtml} from "../utils.ts";

/**
 * Workable public "widget" API — free, no key, but aggressively rate-limited
 * (429s under any fan-out). Best-effort: a throttled company just surfaces in
 * `errors[]` and the run continues. `application_url` is the real apply form.
 * The list response has no description, so keyword matching is title-only here.
 */
type WkJob = {
    id?: number | string;
    shortcode?: string;
    title: string;
    employment_type?: string;
    department?: string;
    function?: string;
    industry?: string;
    telecommuting?: boolean;
    city?: string;
    region?: string;
    country?: string;
    url?: string;
    shortlink?: string;
    application_url?: string;
    published_on?: string;
    created_at?: string;
    description?: string;
};

type WkResponse = { name?: string; jobs?: WkJob[] };

export async function fetchWorkable (token: string): Promise<NormalizedJob[]> {
    const data = await fetchJson<WkResponse>(
        `https://apply.workable.com/api/v1/widget/accounts/${encodeURIComponent(token)}?details=true`,
        `Workable (${token})`
    );

    const company = data.name || token;

    return (data.jobs ?? []).map((job): NormalizedJob => {
        const locations = [job.city, job.region, job.country].filter((l): l is string => Boolean(l));
        const location = locations.join(", ");
        const apply = job.application_url || job.shortlink || job.url || "";

        return {
            source: "workable",
            ats: "workable",
            id: String(job.id ?? job.shortcode ?? job.title),
            title: job.title,
            company,
            companyToken: token,
            department: job.department,
            url: job.url || job.shortlink || apply,
            applyUrl: apply,
            location: location || (job.telecommuting ? "Remote" : "Not specified"),
            isRemote: job.telecommuting === true || /\bremote\b/i.test(location),
            candidateLocations: locations.flatMap(parseRegionList),
            eligibleFromTarget: null,
            eligibilityConfidence: "low",
            employmentType: job.employment_type || undefined,
            tags: [job.department, job.function, job.industry].filter((t): t is string => Boolean(t)),
            postedAt: job.published_on || job.created_at || undefined,
            descriptionHtml: job.description || undefined,
            descriptionText: stripHtml(job.description),
            raw: job,
        };
    });
}
