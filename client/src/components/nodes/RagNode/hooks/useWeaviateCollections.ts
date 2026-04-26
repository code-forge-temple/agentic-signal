/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {useCallback, useRef, useState} from "react";
import {DropdownMenuItem} from "../../../DropdownButton/DropdownButton";
import {defaultRagNodeData} from "../types/workflow";


interface UseWeaviateCollectionsOptions {
    id: string;
    weaviateUrl: string | undefined;
    onConfigChange: (id: string, patch: Record<string, unknown>) => void;
    onError: (msg: string) => void;
}

export function useWeaviateCollections ({id, weaviateUrl, onConfigChange, onError}: UseWeaviateCollectionsOptions) {
    const [availableCollections, setAvailableCollections] = useState<DropdownMenuItem[]>([]);
    const [loadingCollections, setLoadingCollections] = useState(false);
    const [isEmbeddingModelLocked, setIsEmbeddingModelLocked] = useState(false);
    const isEmbeddingModelLockedRef = useRef(false);

    isEmbeddingModelLockedRef.current = isEmbeddingModelLocked;

    const checkAndApplyCollectionLock = useCallback(async (weaviateClass: string) => {
        const url = (weaviateUrl || defaultRagNodeData.weaviateUrl).replace(/\/$/, "");

        try {
            const res = await fetch(`${url}/v1/objects?class=${weaviateClass}Meta&limit=1`);

            if (res.ok) {
                const result = await res.json();
                const storedModel = result.objects?.[0]?.properties?.embeddingModel as string | undefined;

                if (storedModel) {
                    onConfigChange(id, {embeddingModel: storedModel});
                    setIsEmbeddingModelLocked(true);

                    return;
                }
            }
        } catch { /* ignore — not critical */ }

        setIsEmbeddingModelLocked(false);
    }, [id, onConfigChange, weaviateUrl]);

    const checkCollectionLockByName = useCallback(async (name: string) => {
        if (!name) {
            setIsEmbeddingModelLocked(false);

            return;
        }

        const url = (weaviateUrl || defaultRagNodeData.weaviateUrl).replace(/\/$/, "");

        try {
            const res = await fetch(`${url}/v1/schema`);

            if (!res.ok) return;

            const schema = await res.json();
            const weaviateClasses: string[] = (schema.classes ?? [])
                .map((c: {class: string}) => c.class)
                .filter((cls: string) => !cls.endsWith("Meta"));

            for (const weaviateClass of weaviateClasses) {
                try {
                    const metaRes = await fetch(`${url}/v1/objects?class=${weaviateClass}Meta&limit=1`);

                    if (metaRes.ok) {
                        const meta = await metaRes.json();
                        const originalName = meta.objects?.[0]?.properties?.originalName as string | undefined;

                        if (originalName === name) {
                            await checkAndApplyCollectionLock(weaviateClass);

                            return;
                        }
                    }
                } catch { /* ignore */ }
            }
        } catch { /* ignore */ }

        setIsEmbeddingModelLocked(false);
    }, [checkAndApplyCollectionLock, weaviateUrl]);

    // item.id = Weaviate class name (e.g. "Ragcollection"), item.value = original name (e.g. "rag_collection")
    const selectCollection = useCallback(async (item: DropdownMenuItem) => {
        onConfigChange(id, {collectionName: item.value});

        await checkAndApplyCollectionLock(item.id);
    }, [id, onConfigChange, checkAndApplyCollectionLock]);

    const fetchCollections = useCallback(async () => {
        const url = (weaviateUrl || defaultRagNodeData.weaviateUrl).replace(/\/$/, "");

        setLoadingCollections(true);

        try {
            const res = await fetch(`${url}/v1/schema`);

            if (!res.ok) throw new Error(`Weaviate returned ${res.status}`);

            const schema = await res.json();
            const weaviateClasses: string[] = (schema.classes ?? [])
                .map((c: {class: string}) => c.class)
                .filter((name: string) => !name.endsWith("Meta"));

            // Fetch original names from each meta class in parallel
            const items = await Promise.all(weaviateClasses.map(async (weaviateClass) => {
                try {
                    const metaRes = await fetch(`${url}/v1/objects?class=${weaviateClass}Meta&limit=1`);

                    if (metaRes.ok) {
                        const meta = await metaRes.json();
                        const originalName = meta.objects?.[0]?.properties?.originalName as string | undefined;

                        if (originalName) return {id: weaviateClass, value: originalName};
                    }
                } catch { /* fall back to Weaviate class name */ }

                return {id: weaviateClass, value: weaviateClass};
            }));

            setAvailableCollections(items);
        } catch (err) {
            onError(`Failed to fetch collections: ${err instanceof Error ? err.message : String(err)}`);

            setAvailableCollections([]);
        } finally {
            setLoadingCollections(false);
        }
    }, [weaviateUrl, onError]);

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
