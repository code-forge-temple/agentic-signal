/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {useCallback, useMemo, useRef, useState} from "react";
import {z} from "zod";
import {WeaviateMetaObjectsResponseSchema} from "@shared/types.gen";
import {DropdownMenuItem} from "../../../DropdownButton/DropdownButton";
import {defaultRagNodeData} from "../types/workflow";
import {errorMessage, isRagMetaClass, ragClassName} from "@shared/utils";


export const FAILED_TO_FETCH_COLLECTIONS_ERROR_PREFIX = "Failed to fetch collections";

const WeaviateSchemaResponseSchema = z.object({
    classes: z.array(z.object({class: z.string()})).nullish(),
});

async function readWeaviateJson<T> (res: Response, schema: z.ZodType<T>, endpoint: string): Promise<T> {
    const parsed = schema.safeParse(await res.json());

    if (!parsed.success) throw new Error(`Unexpected response from Weaviate's ${endpoint}`);

    return parsed.data;
}

/** The Weaviate server to ask: its URL (no trailing slash) and the headers (its API key, when there is one). */
type WeaviateTarget = {url: string; headers: Record<string, string> | undefined};

/** The collections' Weaviate classes (meta classes left out); throws when Weaviate can't be asked, turns it down, or answers in another shape. */
async function collectionClasses ({url, headers}: WeaviateTarget): Promise<string[]> {
    const res = await fetch(`${url}/v1/schema`, {headers});

    if (!res.ok) throw new Error(`Weaviate returned ${res.status}`);

    const schema = await readWeaviateJson(res, WeaviateSchemaResponseSchema, "/v1/schema");

    return (schema.classes ?? []).map(c => c.class).filter(name => !isRagMetaClass(name));
}

type CollectionMeta = NonNullable<z.infer<typeof WeaviateMetaObjectsResponseSchema>["objects"]>[number]["properties"];

/** A collection's meta properties (its original name, its embedding model); undefined when it has none. Throws when they can't be read. */
async function collectionMeta ({url, headers}: WeaviateTarget, weaviateClass: string): Promise<CollectionMeta | undefined> {
    const res = await fetch(`${url}/v1/objects?class=${weaviateClass}Meta&limit=1`, {headers});

    if (!res.ok) throw new Error(`Weaviate returned ${res.status}`);

    const meta = await readWeaviateJson(res, WeaviateMetaObjectsResponseSchema, "/v1/objects");

    return meta.objects?.[0]?.properties;
}

/**
 * The embedding model a collection was embedded with: null when the collection doesn't exist (Weaviate answers 404 for
 * its class) or has none. Throws when that can't be told (Weaviate down, the API key turned down, another answer).
 */
async function collectionModel (target: WeaviateTarget, weaviateClass: string): Promise<string | null> {
    // All asked at once. The classes' answers decide first: a collection Weaviate hasn't, or one without a meta class
    // (made outside the app), has no model to lock to.
    const [found, foundMeta, meta] = await Promise.allSettled([
        classFound(target, weaviateClass),
        classFound(target, `${weaviateClass}Meta`),
        collectionMeta(target, weaviateClass),
    ]);

    if (found.status === "rejected") throw found.reason;

    if (foundMeta.status === "rejected") throw foundMeta.reason;

    if (!found.value || !foundMeta.value) return null;

    if (meta.status === "rejected") throw meta.reason;

    return meta.value?.embeddingModel || null;
}

/** Whether Weaviate has the class (it answers 404 for one it hasn't); throws when it can't tell. */
async function classFound ({url, headers}: WeaviateTarget, weaviateClass: string): Promise<boolean> {
    const res = await fetch(`${url}/v1/schema/${weaviateClass}`, {headers});

    if (res.status === 404) return false;

    if (!res.ok) throw new Error(`Weaviate returned ${res.status}`);

    return true;
}

// item.id = Weaviate class name (e.g. "Ragcollection"), item.value = original name (e.g. "rag_collection"; the class
// name when it has none).
async function collectionItem (target: WeaviateTarget, weaviateClass: string): Promise<DropdownMenuItem> {
    const originalName = (await collectionMeta(target, weaviateClass).catch(() => undefined))?.originalName;

    return {id: weaviateClass, value: originalName || weaviateClass};
}

interface UseWeaviateCollectionsOptions {
    id: string;
    weaviateUrl: string | undefined;
    weaviateApiKey: string | undefined;
    onConfigChange: (id: string, patch: Record<string, unknown>) => void;
    onError: (msg: string) => void;
}

export function useWeaviateCollections ({id, weaviateUrl, weaviateApiKey, onConfigChange, onError}: UseWeaviateCollectionsOptions) {
    const [availableCollections, setAvailableCollections] = useState<DropdownMenuItem[]>([]);
    const [loadingCollections, setLoadingCollections] = useState(false);
    const [isEmbeddingModelLocked, setIsEmbeddingModelLocked] = useState(false);
    const isEmbeddingModelLockedRef = useRef(false);

    isEmbeddingModelLockedRef.current = isEmbeddingModelLocked;

    const target = useMemo<WeaviateTarget>(() => ({
        url: (weaviateUrl || defaultRagNodeData.weaviateUrl).replace(/\/$/, ""),
        headers: weaviateApiKey ? {"X-Weaviate-Api-Key": weaviateApiKey} : undefined,
    }), [weaviateUrl, weaviateApiKey]);

    // Counts the lock checks, so an answer that comes after a newer check's (picking two collections quickly) is dropped.
    const lockCheckRef = useRef(0);

    // Locks the embedding model to the one the collection was embedded with, when it has one; unlocks when it has none
    // or doesn't exist. When that can't be told (Weaviate down for a moment), the lock stays as it is: unlocking then
    // would let a model change through that wipes the collection.
    const checkAndApplyCollectionLock = useCallback(async (weaviateClass: string) => {
        const check = ++lockCheckRef.current;
        const storedModel = await collectionModel(target, weaviateClass).catch(() => undefined);

        if (check !== lockCheckRef.current || storedModel === undefined) return;

        if (storedModel) onConfigChange(id, {embeddingModel: storedModel});

        setIsEmbeddingModelLocked(!!storedModel);
    }, [id, onConfigChange, target]);

    // The collection a run would write into for this name: ragClassName's class ("my-docs" and "my_docs" are one;
    // no name is the default collection). So the model locks whenever a run would add to a collection, and can't be
    // changed into wiping it.
    const checkCollectionLockByName = useCallback(
        (name: string) => checkAndApplyCollectionLock(ragClassName(name)),
        [checkAndApplyCollectionLock]
    );

    const selectCollection = useCallback(async (item: DropdownMenuItem) => {
        onConfigChange(id, {collectionName: item.value});

        await checkCollectionLockByName(item.value);
    }, [id, onConfigChange, checkCollectionLockByName]);

    const fetchCollections = useCallback(async () => {
        setLoadingCollections(true);

        try {
            const classes = await collectionClasses(target);

            // Each collection's original name, from its meta class, asked in parallel.
            setAvailableCollections(await Promise.all(classes.map(weaviateClass => collectionItem(target, weaviateClass))));
        } catch (err) {
            onError(`${FAILED_TO_FETCH_COLLECTIONS_ERROR_PREFIX}: ${errorMessage(err)}`);

            setAvailableCollections([]);
        } finally {
            setLoadingCollections(false);
        }
    }, [onError, target]);

    return {
        availableCollections,
        loadingCollections,
        isEmbeddingModelLocked,
        isEmbeddingModelLockedRef,
        checkCollectionLockByName,
        selectCollection,
        fetchCollections,
    };
}
