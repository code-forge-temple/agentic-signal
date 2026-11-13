/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {jobSearchService} from "./service.ts";
import {parseCompanyLine} from "./ats/index.ts";
import {JobSearchFilters} from "./types.ts";

// Hand-rolled, like keyedLock.test.ts: the server has no test dependencies.
function assertEquals<T> (actual: T, expected: T): void {
    const a = JSON.stringify(actual);
    const b = JSON.stringify(expected);

    if (a !== b) throw new Error(`Expected ${b}, got ${a}`);
}

const recent = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

const BOARDS: Record<string, unknown> = {
    "https://api.lever.co/v0/postings/lever-co?mode=json": [
        {
            id: "l1", text: "Senior Backend Engineer", hostedUrl: "https://jobs.lever.co/lever-co/l1/", workplaceType: "remote", createdAt: Date.parse(recent),
            categories: {commitment: "Full-time", department: "Engineering", allLocations: ["Remote - Europe"]},
            description: "<p>Build</p>", lists: [{text: "You", content: "<li>Go</li>"}],
        },
        {
            id: "l2", text: "Product Designer", hostedUrl: "https://jobs.lever.co/lever-co/l2", applyUrl: "https://jobs.lever.co/lever-co/l2/apply?src=x",
            categories: {location: "USA only"},
        },
    ],
    "https://api.ashbyhq.com/posting-api/job-board/ashby-co?includeCompensation=true": {jobs: [
        {
            id: "a1", title: "Senior Backend Engineer", employmentType: "FullTime", location: "Berlin", jobUrl: "https://a/1", applyUrl: "https://a/1/apply",
            compensation: {compensationTierSummary: " €90K "},
        },
        {id: "a2", title: "Hidden", jobUrl: "u", applyUrl: "a", isListed: false},
    ]},
    "https://apply.workable.com/api/v1/widget/accounts/workable-co?details=true": {name: "Workable Co", jobs: [
        {shortcode: "W1", title: "Data Engineer", telecommuting: true, shortlink: "https://w/W1"},
    ]},
};

function withBoards (run: () => Promise<void>): Promise<void> {
    const real = globalThis.fetch;

    globalThis.fetch = ((input: string | URL | Request) => {
        const body = BOARDS[String(input)];

        return Promise.resolve(body === undefined ? new Response("{}", {status: 404, statusText: "Not Found"}) : new Response(JSON.stringify(body)));
    }) as typeof fetch;

    return run().finally(() => {
        globalThis.fetch = real;
    });
}

const FILTERS: JobSearchFilters = {
    companies: [{ats: "lever", token: "lever-co"}, {ats: "ashby", token: "ashby-co"}, {ats: "workable", token: "workable-co"}, {ats: "auto", token: "no-such-co"}],
    seedCompanies: [], keywords: "", remoteOnly: false, employmentTypes: [], datePosted: "any", seniority: "any",
    candidateRegion: "", filterByEligibility: false, maxCompanies: 50, resultsLimit: 100,
};

Deno.test("Job Search: maps each board's postings to one shape", async () => {
    await withBoards(async () => {
        const {jobs} = await jobSearchService.search(FILTERS);
        const byId = Object.fromEntries(jobs.map(job => [job.id, job]));

        assertEquals(Object.keys(byId).sort(), ["W1", "a1", "l1", "l2"]);
        assertEquals([byId.l1.applyUrl, byId.l2.applyUrl], ["https://jobs.lever.co/lever-co/l1/apply", "https://jobs.lever.co/lever-co/l2/apply?src=x"]);
        assertEquals(byId.l1.descriptionHtml, "<p>Build</p><h3>You</h3><li>Go</li>");
        assertEquals([byId.l1.isRemote, byId.l2.location], [true, "USA only"]);
        assertEquals([byId.a1.employmentType, byId.a1.salary], ["Full-time", {raw: "€90K"}]);
        assertEquals([byId.W1.company, byId.W1.location, byId.W1.applyUrl, byId.W1.isRemote], ["Workable Co", "Remote", "https://w/W1", true]);
    });
});

Deno.test("Job Search: filters, drops repeats, and reports a company no board has", async () => {
    await withBoards(async () => {
        const result = await jobSearchService.search({...FILTERS, keywords: "engineer", remoteOnly: true});

        assertEquals(result.jobs.map(job => job.id), ["l1", "W1"]);
        assertEquals(result.errors.map(error => error.company), ["no-such-co"]);

        const deduped = await jobSearchService.search({...FILTERS, keywords: "backend"});

        // The two "Senior Backend Engineer" postings are from different companies: both stay.
        assertEquals(deduped.jobs.length, 2);
        assertEquals(deduped.counts.reachable, 3);
    });
});

Deno.test("Job Search: leaves out jobs a candidate clearly can't apply to, when asked", async () => {
    await withBoards(async () => {
        const result = await jobSearchService.search({...FILTERS, candidateRegion: "Europe", filterByEligibility: true});

        assertEquals(result.jobs.some(job => job.id === "l2"), false);
    });
});

Deno.test("Job Search: reads a company line as a board URL, a board:token, a name to look up, or nothing", () => {
    assertEquals(parseCompanyLine("https://boards.greenhouse.io/Stripe/jobs/1"), {ats: "greenhouse", token: "stripe"});
    assertEquals(parseCompanyLine("jobs.lever.co/Vercel/abc"), {ats: "lever", token: "vercel"});
    assertEquals(parseCompanyLine("LEVER : Vercel "), {ats: "lever", token: "vercel"});
    assertEquals(parseCompanyLine("unknown:thing"), {ats: "auto", token: "unknown-thing"});
    assertEquals(parseCompanyLine("Acme Corp"), {ats: "auto", token: "acme-corp"});

    for (const line of ["", "# a note", "// a note", "--"]) assertEquals(parseCompanyLine(line), null);
});
