/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {NormalizedJob, NormalizedSalary} from "../types.ts";
import {fetchJson, parseRegionList, stripHtml} from "../utils.ts";

/**
 * Lever postings API — `?mode=json`, free, no key.
 * `applyUrl` / `hostedUrl` are the real application links; `workplaceType` and
 * `categories.commitment` give remote + employment type directly.
 */
type LeverJob = {
    id: string;
    text: string;
    hostedUrl: string;
    applyUrl?: string;
    createdAt?: number;
    workplaceType?: string;
    country?: string;
    categories?: {
        commitment?: string;
        department?: string;
        location?: string;
        team?: string;
        allLocations?: string[];
    };
    salaryRange?: { min?: number; max?: number; currency?: string; interval?: string };
    description?: string;
    descriptionPlain?: string;
    lists?: { text?: string; content?: string }[];
};

function salaryOf (job: LeverJob): NormalizedSalary | undefined {
    const s = job.salaryRange;

    if (!s || (!s.min && !s.max)) return undefined;

    return {min: s.min || undefined, max: s.max || undefined, currency: s.currency || undefined, period: s.interval || undefined};
}

export async function fetchLever (token: string): Promise<NormalizedJob[]> {
    const data = await fetchJson<LeverJob[]>(
        `https://api.lever.co/v0/postings/${encodeURIComponent(token)}?mode=json`,
        `Lever (${token})`
    );

    return (Array.isArray(data) ? data : []).map((job): NormalizedJob => {
        const cat = job.categories ?? {};
        const allLocations = cat.allLocations?.length ? cat.allLocations : [cat.location ?? ""].filter(Boolean);
        const location = allLocations.join(", ");
        const listsHtml = (job.lists ?? []).map(l => `<h3>${l.text ?? ""}</h3>${l.content ?? ""}`).join("");

        return {
            source: "lever",
            ats: "lever",
            id: job.id,
            title: job.text,
            company: token,
            companyToken: token,
            department: cat.department,
            url: job.hostedUrl,
            applyUrl: job.applyUrl || `${job.hostedUrl.replace(/\/$/, "")}/apply`,
            location: location || "Not specified",
            isRemote: job.workplaceType === "remote" || /\bremote\b/i.test(location),
            candidateLocations: allLocations.flatMap(parseRegionList),
            eligibleFromTarget: null,
            eligibilityConfidence: "low",
            employmentType: cat.commitment || undefined,
            salary: salaryOf(job),
            tags: [cat.department, cat.team].filter((t): t is string => Boolean(t)),
            postedAt: job.createdAt ? new Date(job.createdAt).toISOString() : undefined,
            descriptionHtml: (job.description ?? "") + listsHtml || undefined,
            descriptionText: job.descriptionPlain || stripHtml(job.description),
            raw: job,
        };
    });
}
