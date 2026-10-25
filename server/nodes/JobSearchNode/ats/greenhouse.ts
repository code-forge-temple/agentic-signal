/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {z} from "zod";
import {NormalizedJob} from "../types.ts";
import {fetchJson, parseRegionList, stripHtml, unescapeHtml} from "../utils.ts";

/**
 * Greenhouse job board API — free, no key, CORS `*`.
 * `?content=true` adds the description HTML and department list. `absolute_url`
 * is the application page (`…?gh_jid=`), so it doubles as `applyUrl`.
 * Optional fields are nullish (job boards send null for empty values) and every object
 * is passthrough, so `raw` keeps the whole posting.
 */
const GhJobSchema = z.object({
    id: z.number(),
    title: z.string(),
    updated_at: z.string().nullish(),
    first_published: z.string().nullish(),
    absolute_url: z.string(),
    company_name: z.string().nullish(),
    location: z.object({name: z.string().nullish()}).passthrough().nullish(),
    departments: z.array(z.object({name: z.string().nullish()}).passthrough()).nullish(),
    content: z.string().nullish(),
}).passthrough();

const GhResponseSchema = z.object({jobs: z.array(GhJobSchema).nullish()});

export async function fetchGreenhouse (token: string): Promise<NormalizedJob[]> {
    const data = await fetchJson(
        `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(token)}/jobs?content=true`,
        `Greenhouse (${token})`,
        GhResponseSchema
    );

    return (data.jobs ?? []).map((job): NormalizedJob => {
        const location = job.location?.name?.trim() ?? "";
        const departments = (job.departments ?? []).map(d => d.name ?? "").filter(Boolean);
        const html = unescapeHtml(job.content);

        return {
            source: "greenhouse",
            ats: "greenhouse",
            id: String(job.id),
            title: job.title,
            company: job.company_name || token,
            companyToken: token,
            department: departments[0],
            url: job.absolute_url,
            applyUrl: job.absolute_url,
            location: location || "Not specified",
            isRemote: /\b(remote|anywhere|distributed|work from home)\b/i.test(location),
            candidateLocations: parseRegionList(location),
            eligibleFromTarget: null,
            eligibilityConfidence: "low",
            tags: departments,
            postedAt: job.updated_at || job.first_published || undefined,
            descriptionHtml: html || undefined,
            descriptionText: stripHtml(html),
            raw: job,
        };
    });
}
