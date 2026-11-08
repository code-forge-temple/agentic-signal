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

    const headers = useMemo(
        () => weaviateApiKey ? {"X-Weaviate-Api-Key": weaviateApiKey} : undefined,
        [weaviateApiKey]
    );

    const checkAndApplyCollectionLock = useCallback(async (weaviateClass: string) => {
        const url = (weaviateUrl || defaultRagNodeData.weaviateUrl).replace(/\/$/, "");

        try {
            const res = await fetch(`${url}/v1/objects?class=${weaviateClass}Meta&limit=1`, {headers});

            if (res.ok) {
                const result = await readWeaviateJson(res, WeaviateMetaObjectsResponseSchema, "/v1/objects");
                const storedModel = result.objects?.[0]?.properties?.embeddingModel;

                if (storedModel) {
                    onConfigChange(id, {embeddingModel: storedModel});
                    setIsEmbeddingModelLocked(true);

                    return;
                }
            }
        } catch { /* ignore — not critical */ }

        setIsEmbeddingModelLocked(false);
    }, [id, headers, onConfigChange, weaviateUrl]);

    const checkCollectionLockByName = useCallback(async (name: string) => {
        if (!name) {
            setIsEmbeddingModelLocked(false);

            return;
        }

        const url = (weaviateUrl || defaultRagNodeData.weaviateUrl).replace(/\/$/, "");

        try {
            const res = await fetch(`${url}/v1/schema`, {headers});

            if (!res.ok) return;

            const schema = await readWeaviateJson(res, WeaviateSchemaResponseSchema, "/v1/schema");
            const weaviateClasses = (schema.classes ?? [])
                .map(c => c.class)
                .filter(cls => !cls.endsWith("Meta"));

            for (const weaviateClass of weaviateClasses) {
                try {
                    const metaRes = await fetch(`${url}/v1/objects?class=${weaviateClass}Meta&limit=1`, {headers});

                    if (metaRes.ok) {
                        const meta = await readWeaviateJson(metaRes, WeaviateMetaObjectsResponseSchema, "/v1/objects");
                        const originalName = meta.objects?.[0]?.properties?.originalName;

                        if (originalName === name) {
                            await checkAndApplyCollectionLock(weaviateClass);

                            return;
                        }
                    }
                } catch { /* ignore */ }
            }
        } catch { /* ignore */ }

        setIsEmbeddingModelLocked(false);
    }, [checkAndApplyCollectionLock, headers, weaviateUrl]);

    // item.id = Weaviate class name (e.g. "Ragcollection"), item.value = original name (e.g. "rag_collection")
    const selectCollection = useCallback(async (item: DropdownMenuItem) => {
        onConfigChange(id, {collectionName: item.value});

        await checkAndApplyCollectionLock(item.id);
    }, [id, onConfigChange, checkAndApplyCollectionLock]);

    const fetchCollections = useCallback(async () => {
        const url = (weaviateUrl || defaultRagNodeData.weaviateUrl).replace(/\/$/, "");

        setLoadingCollections(true);

        try {
            const res = await fetch(`${url}/v1/schema`, {headers});

            if (!res.ok) throw new Error(`Weaviate returned ${res.status}`);

            const schema = await readWeaviateJson(res, WeaviateSchemaResponseSchema, "/v1/schema");
            const weaviateClasses = (schema.classes ?? [])
                .map(c => c.class)
                .filter(name => !name.endsWith("Meta"));

            // Fetch original names from each meta class in parallel
            const items = await Promise.all(weaviateClasses.map(async (weaviateClass) => {
                try {
                    const metaRes = await fetch(`${url}/v1/objects?class=${weaviateClass}Meta&limit=1`, {headers});

                    if (metaRes.ok) {
                        const meta = await readWeaviateJson(metaRes, WeaviateMetaObjectsResponseSchema, "/v1/objects");
                        const originalName = meta.objects?.[0]?.properties?.originalName;

                        if (originalName) return {id: weaviateClass, value: originalName};
                    }
                } catch { /* fall back to Weaviate class name */ }

                return {id: weaviateClass, value: weaviateClass};
            }));

            setAvailableCollections(items);
        } catch (err) {
            onError(`${FAILED_TO_FETCH_COLLECTIONS_ERROR_PREFIX}: ${errorMessage(err)}`);

            setAvailableCollections([]);
        } finally {
            setLoadingCollections(false);
        }
    }, [headers, weaviateUrl, onError]);

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
