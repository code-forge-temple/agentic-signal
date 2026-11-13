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
import {errorMessage} from "@shared/utils";


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

/** The collections' Weaviate classes (meta classes left out), or the status Weaviate turned the request down with. */
type ClassesAnswer = {classes: string[]} | {refused: number};

/** Asks for the collections' classes; throws when Weaviate can't be asked or answers in another shape. */
async function collectionClasses ({url, headers}: WeaviateTarget): Promise<ClassesAnswer> {
    const res = await fetch(`${url}/v1/schema`, {headers});

    if (!res.ok) return {refused: res.status};

    const schema = await readWeaviateJson(res, WeaviateSchemaResponseSchema, "/v1/schema");

    return {classes: (schema.classes ?? []).map(c => c.class).filter(name => !name.endsWith("Meta"))};
}

type CollectionMeta = NonNullable<z.infer<typeof WeaviateMetaObjectsResponseSchema>["objects"]>[number]["properties"];

/** A collection's meta properties (its original name, its embedding model); undefined when they can't be read. */
async function collectionMeta ({url, headers}: WeaviateTarget, weaviateClass: string): Promise<CollectionMeta | undefined> {
    try {
        const res = await fetch(`${url}/v1/objects?class=${weaviateClass}Meta&limit=1`, {headers});

        if (!res.ok) return undefined;

        const meta = await readWeaviateJson(res, WeaviateMetaObjectsResponseSchema, "/v1/objects");

        return meta.objects?.[0]?.properties;
    } catch {
        return undefined;
    }
}

/** The class whose collection has the original name `name`, asking one class at a time; undefined when none has. */
async function classOfCollection (target: WeaviateTarget, classes: string[], name: string): Promise<string | undefined> {
    for (const weaviateClass of classes) {
        if ((await collectionMeta(target, weaviateClass))?.originalName === name) return weaviateClass;
    }

    return undefined;
}

// item.id = Weaviate class name (e.g. "Ragcollection"), item.value = original name (e.g. "rag_collection"; the class
// name when it has none).
async function collectionItem (target: WeaviateTarget, weaviateClass: string): Promise<DropdownMenuItem> {
    const originalName = (await collectionMeta(target, weaviateClass))?.originalName;

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

    // Locks the embedding model to the one the collection was embedded with, when it has one.
    const checkAndApplyCollectionLock = useCallback(async (weaviateClass: string) => {
        const storedModel = (await collectionMeta(target, weaviateClass))?.embeddingModel;

        if (storedModel) onConfigChange(id, {embeddingModel: storedModel});

        setIsEmbeddingModelLocked(!!storedModel);
    }, [id, onConfigChange, target]);

    // A schema Weaviate turns down leaves the lock as it is; one it can't answer unlocks.
    const checkCollectionLockByName = useCallback(async (name: string) => {
        const answer = name ? await collectionClasses(target).catch(() => undefined) : undefined;

        if (answer && "refused" in answer) return;

        const weaviateClass = answer ? await classOfCollection(target, answer.classes, name) : undefined;

        if (weaviateClass) await checkAndApplyCollectionLock(weaviateClass);
        else setIsEmbeddingModelLocked(false);
    }, [checkAndApplyCollectionLock, target]);

    const selectCollection = useCallback(async (item: DropdownMenuItem) => {
        onConfigChange(id, {collectionName: item.value});

        await checkAndApplyCollectionLock(item.id);
    }, [id, onConfigChange, checkAndApplyCollectionLock]);

    const fetchCollections = useCallback(async () => {
        setLoadingCollections(true);

        try {
            const answer = await collectionClasses(target);

            if ("refused" in answer) throw new Error(`Weaviate returned ${answer.refused}`);

            // Each collection's original name, from its meta class, asked in parallel.
            setAvailableCollections(await Promise.all(answer.classes.map(weaviateClass => collectionItem(target, weaviateClass))));
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
