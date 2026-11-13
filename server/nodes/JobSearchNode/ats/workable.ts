/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {z} from "zod";
import {NormalizedJob} from "../types.ts";
import {fetchJson, parseRegionList, stripHtml} from "../utils.ts";

/**
 * Workable public "widget" API — free, no key, but aggressively rate-limited
 * (429s under any fan-out). Best-effort: a throttled company just surfaces in
 * `errors[]` and the run continues. `application_url` is the real apply form.
 * The list response has no description, so keyword matching is title-only here.
 * Optional fields are nullish (job boards send null for empty values) and every object
 * is passthrough, so `raw` keeps the whole posting.
 */
const WkJobSchema = z.object({
    id: z.union([z.number(), z.string()]).nullish(),
    shortcode: z.string().nullish(),
    title: z.string(),
    employment_type: z.string().nullish(),
    department: z.string().nullish(),
    function: z.string().nullish(),
    industry: z.string().nullish(),
    telecommuting: z.boolean().nullish(),
    city: z.string().nullish(),
    region: z.string().nullish(),
    country: z.string().nullish(),
    url: z.string().nullish(),
    shortlink: z.string().nullish(),
    application_url: z.string().nullish(),
    published_on: z.string().nullish(),
    created_at: z.string().nullish(),
    description: z.string().nullish(),
}).passthrough();

const WkResponseSchema = z.object({name: z.string().nullish(), jobs: z.array(WkJobSchema).nullish()});

type WkJob = z.infer<typeof WkJobSchema>;

/** The application form: the posting's application link, else its short link or page; "" when it has none. */
const workableApplyUrl = (job: WkJob): string => job.application_url || job.shortlink || job.url || "";

/** The posting's id: Workable's, else its shortcode, else its title. */
const workableId = (job: WkJob): string => String(job.id ?? job.shortcode ?? job.title);

/** Where it is: its location, else Remote for a remote posting, else not specified. */
const workableLocation = (location: string, job: WkJob): string => location || (job.telecommuting ? "Remote" : "Not specified");

/** When it was published, else created. */
const workablePostedAt = (job: WkJob): string | undefined => job.published_on || job.created_at || undefined;

function workableJob (job: WkJob, company: string, token: string): NormalizedJob {
    const locations = [job.city, job.region, job.country].filter((l): l is string => Boolean(l));
    const location = locations.join(", ");
    const apply = workableApplyUrl(job);

    return {
        source: "workable",
        ats: "workable",
        id: workableId(job),
        title: job.title,
        company,
        companyToken: token,
        department: job.department ?? undefined,
        url: job.url || job.shortlink || apply,
        applyUrl: apply,
        location: workableLocation(location, job),
        isRemote: job.telecommuting === true || /\bremote\b/i.test(location),
        candidateLocations: locations.flatMap(parseRegionList),
        eligibleFromTarget: null,
        eligibilityConfidence: "low",
        employmentType: job.employment_type || undefined,
        tags: [job.department, job.function, job.industry].filter((t): t is string => Boolean(t)),
        postedAt: workablePostedAt(job),
        descriptionHtml: job.description || undefined,
        descriptionText: stripHtml(job.description),
        raw: job,
    };
}

export async function fetchWorkable (token: string): Promise<NormalizedJob[]> {
    const data = await fetchJson(
        `https://apply.workable.com/api/v1/widget/accounts/${encodeURIComponent(token)}?details=true`,
        `Workable (${token})`,
        WkResponseSchema
    );

    const company = data.name || token;

    return (data.jobs ?? []).map(job => workableJob(job, company, token));
}
