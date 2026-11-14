/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {z} from "zod";
import {parseApiResponse} from "../../../utils/apiResponse.ts";
import {WeaviateMetaObjectsResponseSchema} from "../types.ts";

export type WHeaders = Record<string, string>;

/** A Weaviate class to work on: the server's base URL (no trailing slash), the request headers, and the class name. */
export type WeaviateClass = {base: string; h: WHeaders; className: string};

const BatchInsertResultSchema = z.array(z.object({
    result: z.object({
        status: z.string().nullish(),
        errors: z.object({
            error: z.array(z.object({message: z.string()})).nullish(),
        }).nullish(),
    }).nullish(),
}));

// GraphQL `Get` returns null for a property an object doesn't have, so both are nullable.
const NearVectorResponseSchema = z.object({
    errors: z.array(z.object({message: z.string()})).nullish(),
    data: z.object({
        Get: z.record(z.string(), z.array(z.object({
            content: z.string().nullable(),
            sourceFile: z.string().nullable(),
        })).nullable()).nullish(),
    }).nullish(),
});

export function weaviateHeaders (apiKey?: string): WHeaders {
    const h: WHeaders = {"Content-Type": "application/json"};

    if (apiKey) h["X-Weaviate-Api-Key"] = apiKey;

    return h;
}

/** Whether Weaviate has the class (it answers 404 for one it hasn't); throws when it can't tell (an API key it turns down, an error). */
export async function classExists ({base, h, className}: WeaviateClass): Promise<boolean> {
    const res = await fetch(`${base}/v1/schema/${className}`, {headers: h});

    if (res.status === 404) return false;

    if (!res.ok) throw new Error(`Weaviate couldn't say whether "${className}" exists: ${res.status} ${await res.text()}`);

    return true;
}

export async function createChunksClass ({base, h, className}: WeaviateClass): Promise<void> {
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

export async function createMetaClass ({base, h, className}: WeaviateClass): Promise<void> {
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
                {name: "ownerKeyHash", dataType: ["text"]},
            ],
        }),
    });

    if (!res.ok) throw new Error(`Failed to create Weaviate meta class "${className}": ${await res.text()}`);
}

/** Deletes the class with its objects; one already gone is no failure. */
export async function deleteClass ({base, h, className}: WeaviateClass): Promise<void> {
    const res = await fetch(`${base}/v1/schema/${className}`, {method: "DELETE", headers: h});

    if (!res.ok && res.status !== 404) throw new Error(`Failed to delete Weaviate class "${className}": ${res.status} ${await res.text()}`);
}

export async function deleteChunksBySourceFile ({base, h, className}: WeaviateClass, sourceFile: string): Promise<void> {
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
    {base, h, className}: WeaviateClass,
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

    const result = parseApiResponse(await res.json(), BatchInsertResultSchema, "Weaviate (batch insert)");
    const failed = result.filter(r => r.result?.status === "FAILED");

    if (failed.length > 0) {
        const msg = failed
            .flatMap(r => r.result?.errors?.error?.map(e => e.message) ?? [])
            .join("; ");

        throw new Error(`Weaviate batch insert: ${failed.length} object(s) failed — ${msg}`);
    }
}

/**
 * A RAG collection's meta object: the files ingested (name → content hash), the embedding model they were embedded
 * with, and the owner key's fingerprint when the collection has one.
 */
export type StoredMeta = {id: string; fileHashes: Record<string, string>; embeddingModel?: string; ownerKeyHash?: string};

export async function getStoredMeta ({base, h, className: metaClassName}: WeaviateClass): Promise<StoredMeta | undefined> {
    const res = await fetch(`${base}/v1/objects?class=${metaClassName}&limit=1`, {headers: h});

    // Read only where the meta class exists: a failure isn't "no meta yet" (taken as one, a run would add a second).
    if (!res.ok) throw new Error(`Weaviate couldn't read "${metaClassName}": ${res.status} ${await res.text()}`);

    const result = parseApiResponse(await res.json(), WeaviateMetaObjectsResponseSchema, "Weaviate (meta object)");
    const obj = result.objects?.[0];

    if (!obj) return undefined;

    const raw = obj.properties.documentHash;
    let fileHashes: Record<string, string> = {};

    try {
        if (raw?.startsWith("{")) fileHashes = JSON.parse(raw);
        // Plain SHA-256 string = old format → fileHashes stays empty → full re-ingest
    } catch { /* corrupt — treat as empty */ }

    return {
        id: obj.id,
        fileHashes,
        embeddingModel: obj.properties.embeddingModel ?? undefined,
        ownerKeyHash: obj.properties.ownerKeyHash || undefined,
    };
}

/**
 * What a collection's meta object holds: its files' hashes, the embedding model, the collection's name as typed, and
 * the owner key's fingerprint, which is written with a new meta object only: an update never changes the owner.
 */
export type MetaProperties = {fileHashes: Record<string, string>; embeddingModel: string; originalName: string; ownerKeyHash?: string};

/** Writes the collection's meta object: updates the one with `existingId`, or adds it when there's none. */
export async function upsertMeta (
    {base, h, className: metaClassName}: WeaviateClass,
    {fileHashes, embeddingModel, originalName, ownerKeyHash}: MetaProperties,
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
            body: JSON.stringify({class: metaClassName, properties: {documentHash, embeddingModel, originalName, ...(ownerKeyHash ? {ownerKeyHash} : {})}}),
        });

        if (!res.ok) throw new Error(`Failed to insert Weaviate meta: ${await res.text()}`);
    }
}

export async function nearVectorSearch (
    {base, h, className}: WeaviateClass,
    vector: number[],
    limit: number,
): Promise<Array<{content: string | null; sourceFile: string | null}>> {
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

    const result = parseApiResponse(await res.json(), NearVectorResponseSchema, "Weaviate (nearVector search)");

    if (result.errors?.length) {
        throw new Error(result.errors.map(e => e.message).join("; "));
    }

    return result.data?.Get?.[className] ?? [];
}
