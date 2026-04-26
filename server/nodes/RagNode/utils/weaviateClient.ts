/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

export type WHeaders = Record<string, string>;

/** Weaviate class names must start with uppercase and contain only [a-zA-Z0-9]. */
export function toWeaviateClassName (name: string): string {
    const safe = name.replace(/[^a-zA-Z0-9]/g, "");

    if (!safe) return "RagCollection";

    return safe.charAt(0).toUpperCase() + safe.slice(1);
}

export function weaviateHeaders (apiKey?: string): WHeaders {
    const h: WHeaders = {"Content-Type": "application/json"};

    if (apiKey) h["X-Weaviate-Api-Key"] = apiKey;

    return h;
}

export async function classExists (base: string, h: WHeaders, className: string): Promise<boolean> {
    const res = await fetch(`${base}/v1/schema/${className}`, {headers: h});

    return res.ok;
}

export async function createChunksClass (base: string, h: WHeaders, className: string): Promise<void> {
    const res = await fetch(`${base}/v1/schema`, {
        method: "POST",
        headers: h,
        body: JSON.stringify({
            class: className,
            vectorizer: "none",
            properties: [
                {name: "content", dataType: ["text"]},
                {name: "sourceFile", dataType: ["text"]},
                {name: "chunkIndex", dataType: ["int"]},
            ],
        }),
    });

    if (!res.ok) throw new Error(`Failed to create Weaviate class "${className}": ${await res.text()}`);
}

export async function createMetaClass (base: string, h: WHeaders, className: string): Promise<void> {
    const res = await fetch(`${base}/v1/schema`, {
        method: "POST",
        headers: h,
        body: JSON.stringify({
            class: className,
            vectorizer: "none",
            properties: [
                {name: "documentHash", dataType: ["text"]},
                {name: "embeddingModel", dataType: ["text"]},
                {name: "originalName", dataType: ["text"]},
            ],
        }),
    });

    if (!res.ok) throw new Error(`Failed to create Weaviate meta class "${className}": ${await res.text()}`);
}

export async function deleteClass (base: string, h: WHeaders, className: string): Promise<void> {
    await fetch(`${base}/v1/schema/${className}`, {method: "DELETE", headers: h});
}

export async function deleteChunksBySourceFile (base: string, h: WHeaders, className: string, sourceFile: string): Promise<void> {
    const res = await fetch(`${base}/v1/batch/objects`, {
        method: "DELETE",
        headers: h,
        body: JSON.stringify({
            match: {
                class: className,
                where: {operator: "Equal", path: ["sourceFile"], valueText: sourceFile},
            },
        }),
    });

    if (!res.ok) throw new Error(`Failed to delete chunks for "${sourceFile}": ${await res.text()}`);
}

export async function batchInsert (
    base: string,
    h: WHeaders,
    className: string,
    objects: Array<{content: string; sourceFile: string; chunkIndex: number; embedding: number[]}>,
): Promise<void> {
    const res = await fetch(`${base}/v1/batch/objects`, {
        method: "POST",
        headers: h,
        body: JSON.stringify({
            objects: objects.map(obj => ({
                class: className,
                properties: {content: obj.content, sourceFile: obj.sourceFile, chunkIndex: obj.chunkIndex},
                vector: obj.embedding,
            })),
        }),
    });

    if (!res.ok) throw new Error(`Weaviate batch insert failed: ${await res.text()}`);

    const result: Array<{result?: {status?: string; errors?: {error?: Array<{message: string}>}}}> = await res.json();
    const failed = result.filter(r => r.result?.status === "FAILED");

    if (failed.length > 0) {
        const msg = failed
            .flatMap(r => r.result?.errors?.error?.map(e => e.message) ?? [])
            .join("; ");

        throw new Error(`Weaviate batch insert: ${failed.length} object(s) failed — ${msg}`);
    }
}

export async function getStoredMeta (
    base: string,
    h: WHeaders,
    metaClassName: string,
): Promise<{id: string; fileHashes: Record<string, string>; embeddingModel?: string} | undefined> {
    const res = await fetch(`${base}/v1/objects?class=${metaClassName}&limit=1`, {headers: h});

    if (!res.ok) return undefined;

    const result = await res.json();
    const obj = result.objects?.[0];

    if (!obj) return undefined;

    const raw = obj.properties.documentHash as string | undefined;
    let fileHashes: Record<string, string> = {};

    try {
        if (raw?.startsWith("{")) fileHashes = JSON.parse(raw);
        // Plain SHA-256 string = old format → fileHashes stays empty → full re-ingest
    } catch { /* corrupt — treat as empty */ }

    return {
        id: obj.id,
        fileHashes,
        embeddingModel: obj.properties.embeddingModel as string | undefined,
    };
}

export async function upsertMeta (
    base: string,
    h: WHeaders,
    metaClassName: string,
    fileHashes: Record<string, string>,
    embeddingModel: string,
    originalName: string,
    existingId?: string,
): Promise<void> {
    const documentHash = JSON.stringify(fileHashes);

    if (existingId) {
        const res = await fetch(`${base}/v1/objects/${metaClassName}/${existingId}`, {
            method: "PATCH",
            headers: h,
            body: JSON.stringify({properties: {documentHash, embeddingModel, originalName}}),
        });

        if (!res.ok) throw new Error(`Failed to update Weaviate meta: ${await res.text()}`);
    } else {
        const res = await fetch(`${base}/v1/objects`, {
            method: "POST",
            headers: h,
            body: JSON.stringify({class: metaClassName, properties: {documentHash, embeddingModel, originalName}}),
        });

        if (!res.ok) throw new Error(`Failed to insert Weaviate meta: ${await res.text()}`);
    }
}

export async function nearVectorSearch (
    base: string,
    h: WHeaders,
    className: string,
    vector: number[],
    limit: number,
): Promise<Array<{content: string; sourceFile: string}>> {
    const res = await fetch(`${base}/v1/graphql`, {
        method: "POST",
        headers: h,
        body: JSON.stringify({
            query: /* GraphQL */ `{
                Get {
                    ${className}(
                        nearVector: { vector: ${JSON.stringify(vector)} }
                        limit: ${limit}
                    ) {
                        content
                        sourceFile
                    }
                }
            }`,
        }),
    });

    if (!res.ok) throw new Error(`Weaviate GraphQL query failed: ${await res.text()}`);

    const result = await res.json();

    if (result.errors?.length) {
        throw new Error(result.errors.map((e: {message: string}) => e.message).join("; "));
    }

    return (result.data?.Get?.[className] ?? []) as Array<{content: string; sourceFile: string}>;
}
