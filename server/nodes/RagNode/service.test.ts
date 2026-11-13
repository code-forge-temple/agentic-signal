/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {ragIngestAndRetrieve} from "./service.ts";
import {FakeServices, withFakeServices} from "./fakeServices.test-utils.ts";
import {RagIngestAndRetrieveArgs} from "./types.ts";

// Hand-rolled, like keyedLock.test.ts: the server has no test dependencies.
function assertEquals<T> (actual: T, expected: T): void {
    const a = JSON.stringify(actual);
    const b = JSON.stringify(expected);

    if (a !== b) throw new Error(`Expected ${b}, got ${a}`);
}

const ARGS: RagIngestAndRetrieveArgs = {
    input: "", collectionName: "docs", embeddingModel: "nomic", chunkSize: 500, chunkOverlap: 50, topK: 3,
    ollamaHost: "http://ollama:11434", weaviateUrl: "http://weaviate:8080/", weaviateApiKey: "wk",
};

const withFiles = (query: string, files: Record<string, string>) =>
    query + Object.entries(files).map(([name, content]) => `\n\n### File name "${name}"\n${content}`).join("");

const run = (input: string, overrides: Partial<RagIngestAndRetrieveArgs> = {}) => ragIngestAndRetrieve({...ARGS, ...overrides, input});

/** The requests made since `from`, as "METHOD /path". */
const routesSince = (services: FakeServices, from: number) => services.requests.slice(from).map(({method, path}) => `${method} ${path}`);

const chunksOf = (services: FakeServices, className: string) =>
    services.objects.filter(object => object.class === className).map(({properties}) => `${properties.sourceFile}: ${properties.content}`);

const metaOf = (services: FakeServices) => services.objects.find(object => object.class === "DocsMeta")?.properties;

Deno.test("RAG: no query and no files is an error", async () => {
    await withFakeServices(async (services) => {
        assertEquals(await run("  "), {success: false, context: null, error: "No input content to process"});
        assertEquals(services.requests, []);
    });
});

Deno.test("RAG: ingests the files and answers from them, each chunk numbered with its file", async () => {
    await withFakeServices(async (services) => {
        const result = await run(withFiles("what is alpha?", {"a.txt": "Alpha.", "b.txt": "Beta."}));

        assertEquals(result, {success: true, context: "[1] (a.txt)\nAlpha.\n\n[2] (b.txt)\nBeta.", error: null});
        assertEquals([...services.classes], ["DocsMeta", "Docs"]);
        assertEquals(chunksOf(services, "Docs"), ["a.txt: Alpha.", "b.txt: Beta."]);
        assertEquals(metaOf(services)?.embeddingModel, "nomic");
        assertEquals(metaOf(services)?.originalName, "docs");
        // Weaviate's requests carry its API key, on paths without the URL's trailing slash doubled.
        const weaviateRequests = services.requests.filter(request => request.path.startsWith("/v1/"));

        assertEquals(weaviateRequests.length > 0 && weaviateRequests.every(request => request.apiKey === "wk"), true);
        assertEquals(services.requests.some(request => request.path.includes("//")), false);
    });
});

Deno.test("RAG: unchanged files aren't embedded again; a changed one replaces only its own chunks", async () => {
    await withFakeServices(async (services) => {
        await run(withFiles("q", {"a.txt": "Alpha.", "b.txt": "Beta."}));

        const again = services.requests.length;

        await run(withFiles("q", {"a.txt": "Alpha.", "b.txt": "Beta."}));
        assertEquals(routesSince(services, again).includes("POST /v1/batch/objects"), false);

        const changed = services.requests.length;

        await run(withFiles("q", {"a.txt": "Alpha.", "b.txt": "Beta, changed."}));
        assertEquals(routesSince(services, changed).filter(route => route.startsWith("DELETE")), ["DELETE /v1/batch/objects"]);
        assertEquals(chunksOf(services, "Docs"), ["a.txt: Alpha.", "b.txt: Beta, changed."]);
        assertEquals(Object.keys(JSON.parse(String(metaOf(services)?.documentHash))), ["a.txt", "b.txt"]);
    });
});

Deno.test("RAG: keeps the files another workflow ingested into the collection", async () => {
    await withFakeServices(async (services) => {
        await run(withFiles("q", {"a.txt": "Alpha."}));
        await run(withFiles("q", {"c.txt": "Gamma."}));

        assertEquals(chunksOf(services, "Docs"), ["a.txt: Alpha.", "c.txt: Gamma."]);
        assertEquals(Object.keys(JSON.parse(String(metaOf(services)?.documentHash))), ["a.txt", "c.txt"]);
    });
});

Deno.test("RAG: a new embedding model starts the collection over with the files sent", async () => {
    await withFakeServices(async (services) => {
        await run(withFiles("q", {"a.txt": "Alpha.", "b.txt": "Beta."}));
        await run(withFiles("q", {"a.txt": "Alpha."}), {embeddingModel: "mxbai"});

        assertEquals(chunksOf(services, "Docs"), ["a.txt: Alpha."]);
        assertEquals(Object.keys(JSON.parse(String(metaOf(services)?.documentHash))), ["a.txt"]);
        assertEquals(metaOf(services)?.embeddingModel, "mxbai");
    });
});

Deno.test("RAG: files without a query are stored, and a query with nothing stored finds nothing", async () => {
    await withFakeServices(async (services) => {
        assertEquals(await run("anything?"), {success: true, context: null, error: null});
        assertEquals(await run(withFiles("", {"a.txt": "Alpha."})), {success: true, context: null, error: null});
        assertEquals(chunksOf(services, "Docs"), ["a.txt: Alpha."]);
    });
});

Deno.test("RAG: a query alone, on a name nothing was ingested under, creates nothing", async () => {
    await withFakeServices(async (services) => {
        await run("anything?", {collectionName: "brand new"});

        assertEquals([...services.classes], []);
        assertEquals(routesSince(services, 0), ["GET /v1/schema/Brandnew"]);
    });
});

Deno.test("RAG: a query alone that Weaviate turns away is the run's error, not an empty collection", async () => {
    await withFakeServices(async (services) => {
        services.failNext("GET /v1/schema/Docs", 401, {error: "bad key"});

        const result = await run("anything?");

        assertEquals([result.success, result.error], [false, "Weaviate couldn't say whether \"Docs\" exists: 401 {\"error\":\"bad key\"}"]);
    });
});

Deno.test("RAG: turns down a name whose class would end in Meta, where collections keep their file lists", async () => {
    await withFakeServices(async (services) => {
        await run(withFiles("q", {"a.txt": "Alpha."}), {collectionName: "project"});

        const result = await run(withFiles("q", {"b.txt": "Beta."}), {collectionName: "projectMeta"});

        assertEquals(result.success, false);
        assertEquals(result.error, "A collection's name can't end in \"Meta\" (\"projectMeta\" would be the Weaviate class ProjectMeta, where file lists are kept). Rename it.");
        // ProjectMeta still holds only "project"'s file list.
        assertEquals(services.objects.filter(object => object.class === "ProjectMeta").map(object => object.properties.originalName), ["project"]);
    });
});

Deno.test("RAG: a query with another model than the collection's says which model to use", async () => {
    await withFakeServices(async () => {
        await run(withFiles("q", {"a.txt": "Alpha."}));

        const result = await run("what is alpha?", {embeddingModel: "mxbai"});

        assertEquals(result, {success: false, context: null, error: "Collection \"docs\" was embedded with nomic, not mxbai: query it with nomic."});
    });
});

Deno.test("RAG: a meta object that can't be read fails the run, not taken for none (a second one would be written)", async () => {
    await withFakeServices(async (services) => {
        await run(withFiles("q", {"a.txt": "Alpha."}));
        services.failNext("GET /v1/objects", 503, {error: "busy"});

        const result = await run(withFiles("q", {"b.txt": "Beta."}));

        assertEquals(result.success, false);
        assertEquals(services.objects.filter(object => object.class === "DocsMeta").length, 1);
    });
});

Deno.test("RAG: a name starting with a digit gets a class Weaviate takes (it starts with a letter)", async () => {
    await withFakeServices(async (services) => {
        await run(withFiles("q", {"a.txt": "Alpha."}), {collectionName: "2024 notes"});

        assertEquals([...services.classes], ["Rag2024notesMeta", "Rag2024notes"]);
    });
});

Deno.test("RAG: a failing Weaviate call is the run's error", async () => {
    await withFakeServices(async (services) => {
        services.failNext("POST /v1/schema", 500, {error: "disk full"});

        assertEquals(await run(withFiles("q", {"a.txt": "Alpha."})),
            {success: false, context: null, error: "Failed to create Weaviate meta class \"DocsMeta\": {\"error\":\"disk full\"}"});
    });
});
