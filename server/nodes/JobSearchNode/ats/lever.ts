/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {z} from "zod";
import {NormalizedJob, NormalizedSalary} from "../types.ts";
import {fetchJson, parseRegionList, stripHtml} from "../utils.ts";

/**
 * Lever postings API — `?mode=json`, free, no key.
 * `applyUrl` / `hostedUrl` are the real application links; `workplaceType` and
 * `categories.commitment` give remote + employment type directly.
 * Optional fields are nullish (job boards send null for empty values) and every object
 * is passthrough, so `raw` keeps the whole posting.
 */
const LeverJobSchema = z.object({
    id: z.string(),
    text: z.string(),
    hostedUrl: z.string(),
    applyUrl: z.string().nullish(),
    createdAt: z.number().nullish(),
    workplaceType: z.string().nullish(),
    country: z.string().nullish(),
    categories: z.object({
        commitment: z.string().nullish(),
        department: z.string().nullish(),
        location: z.string().nullish(),
        team: z.string().nullish(),
        allLocations: z.array(z.string()).nullish(),
    }).passthrough().nullish(),
    salaryRange: z.object({
        min: z.number().nullish(),
        max: z.number().nullish(),
        currency: z.string().nullish(),
        interval: z.string().nullish(),
    }).passthrough().nullish(),
    description: z.string().nullish(),
    descriptionPlain: z.string().nullish(),
    lists: z.array(z.object({text: z.string().nullish(), content: z.string().nullish()}).passthrough()).nullish(),
}).passthrough();

type LeverJob = z.infer<typeof LeverJobSchema>;

function salaryOf (job: LeverJob): NormalizedSalary | undefined {
    const s = job.salaryRange;

    if (!s || (!s.min && !s.max)) return undefined;

    return {min: s.min || undefined, max: s.max || undefined, currency: s.currency || undefined, period: s.interval || undefined};
}

type LeverCategories = NonNullable<LeverJob["categories"]>;

/** Where the posting is: every location Lever lists for it, else its one location (if any). */
const leverLocations = (cat: LeverCategories): string[] => (cat.allLocations?.length ? cat.allLocations : [cat.location ?? ""].filter(Boolean));

/** The description with the posting's lists (requirements, benefits, ...) after it, as HTML; undefined when both are empty. */
function leverDescriptionHtml (job: LeverJob): string | undefined {
    const listsHtml = (job.lists ?? []).map(list => `<h3>${list.text ?? ""}</h3>${list.content ?? ""}`).join("");

    return (job.description ?? "") + listsHtml || undefined;
}

/** The application form: Lever's own link, else the posting's page with /apply. */
const leverApplyUrl = (job: LeverJob): string => job.applyUrl || `${job.hostedUrl.replace(/\/$/, "")}/apply`;

function leverJob (job: LeverJob, token: string): NormalizedJob {
    const cat = job.categories ?? {};
    const allLocations = leverLocations(cat);
    const location = allLocations.join(", ");

    return {
        source: "lever",
        ats: "lever",
        id: job.id,
        title: job.text,
        company: token,
        companyToken: token,
        department: cat.department ?? undefined,
        url: job.hostedUrl,
        applyUrl: leverApplyUrl(job),
        location: location || "Not specified",
        isRemote: job.workplaceType === "remote" || /\bremote\b/i.test(location),
        candidateLocations: allLocations.flatMap(parseRegionList),
        eligibleFromTarget: null,
        eligibilityConfidence: "low",
        employmentType: cat.commitment || undefined,
        salary: salaryOf(job),
        tags: [cat.department, cat.team].filter((t): t is string => Boolean(t)),
        postedAt: job.createdAt ? new Date(job.createdAt).toISOString() : undefined,
        descriptionHtml: leverDescriptionHtml(job),
        descriptionText: job.descriptionPlain || stripHtml(job.description),
        raw: job,
    };
}

export async function fetchLever (token: string): Promise<NormalizedJob[]> {
    const data = await fetchJson(
        `https://api.lever.co/v0/postings/${encodeURIComponent(token)}?mode=json`,
        `Lever (${token})`,
        z.array(LeverJobSchema)
    );

    return data.map(job => leverJob(job, token));
}
