/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {AtsProvider, ATS_PROVIDERS, CompanyRef, NormalizedJob, UnresolvedCompany} from "../types.ts";
import {fetchGreenhouse} from "./greenhouse.ts";
import {fetchLever} from "./lever.ts";
import {fetchAshby} from "./ashby.ts";
import {fetchWorkable} from "./workable.ts";

export const PROVIDERS: Record<AtsProvider, (token: string) => Promise<NormalizedJob[]>> = {
    greenhouse: fetchGreenhouse,
    lever: fetchLever,
    ashby: fetchAshby,
    workable: fetchWorkable,
};

// Order matters for `auto` resolution: try the reliable, common ones first.
const AUTO_ORDER: AtsProvider[] = ["greenhouse", "lever", "ashby", "workable"];

const URL_HOST_ATS: [RegExp, AtsProvider][] = [
    [/(?:boards|job-boards)\.greenhouse\.io\/([^/?#]+)/i, "greenhouse"],
    [/jobs\.lever\.co\/([^/?#]+)/i, "lever"],
    [/jobs\.ashbyhq\.com\/([^/?#]+)/i, "ashby"],
    [/apply\.workable\.com\/([^/?#]+)/i, "workable"],
];

const slug = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");

/**
 * Parse one line of the `companies` config:
 *   "greenhouse:stripe" -> { ats: "greenhouse", token: "stripe" }
 *   "https://jobs.lever.co/vercel/..." -> { ats: "lever", token: "vercel" }
 *   "Acme Corp" -> { ats: "auto", token: "acme-corp" }
 *   "" / "# note" -> null
 */
export function parseCompanyLine (line: string): CompanyRef | UnresolvedCompany | null {
    const raw = line.trim();

    if (!raw || raw.startsWith("#") || raw.startsWith("//")) return null;

    for (const [re, ats] of URL_HOST_ATS) {
        const m = raw.match(re);

        if (m) return {ats, token: m[1].toLowerCase()};
    }

    const colon = raw.indexOf(":");

    if (colon > 0 && !raw.startsWith("http")) {
        const ats = raw.slice(0, colon).trim().toLowerCase();
        const token = raw.slice(colon + 1).trim().toLowerCase();

        if ((ATS_PROVIDERS as readonly string[]).includes(ats) && token) {
            return {ats: ats as AtsProvider, token};
        }
    }

    const token = slug(raw);

    return token ? {ats: "auto", token} : null;
}

/** Fetch a company's jobs; for `auto`, probe each ATS until one yields postings. */
export async function resolveAndFetch (
    entry: CompanyRef | UnresolvedCompany
): Promise<{ ats: AtsProvider; jobs: NormalizedJob[] }> {
    if (entry.ats !== "auto") {
        return {ats: entry.ats, jobs: await PROVIDERS[entry.ats](entry.token)};
    }

    const failures: string[] = [];

    for (const ats of AUTO_ORDER) {
        try {
            const jobs = await PROVIDERS[ats](entry.token);

            if (jobs.length > 0) return {ats, jobs};
        } catch (err) {
            failures.push(`${ats}: ${err instanceof Error ? err.message : String(err)}`);
        }
    }

    throw new Error(`"${entry.token}" not found on Greenhouse/Lever/Ashby/Workable${failures.length ? ` (${failures.join("; ")})` : ""}`);
}

export function keyOf (entry: CompanyRef | UnresolvedCompany): string {
    return `${entry.ats}:${entry.token}`;
}
