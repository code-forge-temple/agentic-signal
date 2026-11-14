/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

// An in-memory Weaviate and Ollama behind a stubbed fetch, for the RAG service's tests: the endpoints the service
// calls, each request recorded (method, path, body, Weaviate API key).

type WeaviateObject = {id: string; class: string; properties: Record<string, unknown>; vector?: number[]};

export type FakeRequest = {method: string; path: string; body?: unknown; apiKey?: string};

export type FakeServices = {
    requests: FakeRequest[];
    classes: Set<string>;
    objects: WeaviateObject[];
    /** Answers the next request to `path` (method and path, "POST /v1/schema") with this status and body instead. */
    failNext: (route: string, status: number, body: unknown) => void;
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {status});

function makeRoutes (services: FakeServices) {
    let nextId = 1;
    const {classes} = services;
    const objectsOf = (className: string) => services.objects.filter(object => object.class === className);
    const deleteWhere = (keep: (object: WeaviateObject) => boolean) => {
        services.objects = services.objects.filter(keep);
    };

    return {
        "GET /v1/schema/": (name: string) => json({}, classes.has(name) ? 200 : 404),
        "POST /v1/schema": (_: string, body: {class: string}) => (classes.add(body.class), json({})),
        "DELETE /v1/schema/": (name: string) => (classes.delete(name), deleteWhere(object => object.class !== name), json({})),
        "DELETE /v1/batch/objects": (_: string, body: {match: {class: string; where: {valueText: string}}}) =>
            (deleteWhere(object => object.class !== body.match.class || object.properties.sourceFile !== body.match.where.valueText), json({})),
        "POST /v1/batch/objects": (_: string, body: {objects: Omit<WeaviateObject, "id">[]}) =>
            json(body.objects.map(object => (services.objects.push({...object, id: String(nextId++)}), {result: {status: "SUCCESS"}}))),
        "GET /v1/objects": (query: string) => json({objects: objectsOf(new URLSearchParams(query).get("class") ?? "").slice(0, 1)}),
        "PATCH /v1/objects/": (rest: string, body: {properties: Record<string, unknown>}) => {
            const object = services.objects.find(candidate => candidate.id === rest.split("/")[1]);

            // Merged, as Weaviate's PATCH does: properties it doesn't name stay.
            if (object) object.properties = {...object.properties, ...body.properties};

            return json({}, object ? 200 : 404);
        },
        "POST /v1/objects": (_: string, body: {class: string; properties: Record<string, unknown>}) =>
            (services.objects.push({...body, id: String(nextId++)}), json({})),
        "POST /v1/graphql": (_: string, body: {query: string}) => {
            const [, className, limit] = /Get\s*{\s*(\w+)\([\s\S]*?limit:\s*(\d+)/.exec(body.query) ?? [];
            const found = objectsOf(className).slice(0, Number(limit)).map(({properties}) => ({content: properties.content, sourceFile: properties.sourceFile}));

            return json({data: {Get: {[className]: found}}});
        },
        // Ollama: a 2-number vector per text.
        "POST /api/embed": (_: string, body: {input: string | string[]}) =>
            json({embeddings: [body.input].flat().map(text => [text.length, 1])}),
    } as Record<string, (rest: string, body: never) => Response>;
}

// The route for a request: the longest route key the "METHOD /path" starts with, and the rest of the path after it.
function routeFor (routes: ReturnType<typeof makeRoutes>, method: string, url: URL) {
    const key = `${method} ${url.pathname}`;
    const route = Object.keys(routes).filter(candidate => key.startsWith(candidate)).sort((a, b) => b.length - a.length)[0];

    if (!route) return undefined;

    const rest = route.endsWith("/") ? key.slice(route.length) : url.search.slice(1);

    return {handle: routes[route], rest};
}

/** Runs `run` with fetch answered by a fresh fake Weaviate and Ollama, and gives the services back to look at. */
export async function withFakeServices (run: (services: FakeServices) => Promise<void>): Promise<FakeServices> {
    const failures = new Map<string, {status: number; body: unknown}>();
    const services: FakeServices = {
        requests: [],
        classes: new Set(),
        objects: [],
        failNext: (route, status, body) => failures.set(route, {status, body}),
    };
    const routes = makeRoutes(services);
    const realFetch = globalThis.fetch;

    globalThis.fetch = ((input: string | URL | Request, init?: RequestInit) => {
        const request = input instanceof Request ? input : new Request(String(input), init);

        return request.text().then((text) => {
            const url = new URL(request.url);
            const body = text ? JSON.parse(text) : undefined;
            const failure = failures.get(`${request.method} ${url.pathname}`);

            services.requests.push({method: request.method, path: `${url.pathname}${url.search}`, body, apiKey: request.headers.get("X-Weaviate-Api-Key") ?? undefined});

            if (failure) return (failures.delete(`${request.method} ${url.pathname}`), json(failure.body, failure.status));

            const route = routeFor(routes, request.method, url);

            return route ? route.handle(route.rest, body as never) : json({error: `no route for ${request.method} ${url.pathname}`}, 500);
        });
    }) as typeof fetch;

    try {
        await run(services);
    } finally {
        globalThis.fetch = realFetch;
    }

    return services;
}
