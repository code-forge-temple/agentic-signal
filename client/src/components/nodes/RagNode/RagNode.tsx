/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {type NodeProps} from "@xyflow/react";
import {useCallback, useState} from "react";
import {MonitoredNode} from "../MonitoredNode";
import {Icon} from "./constants";
import {AppNode} from "../workflow.gen";
import {assertIsEnhancedNodeData} from "../../../types/workflow";
import {assertIsRagNodeData, RagNodeData} from "./types/workflow";
import {isModelGone, useFetchModels} from "../../../hooks/useFetchModels";
import {useOnOpen} from "../../../hooks/useOnOpen";
import {DropdownMenuItem} from "../../DropdownButton/DropdownButton";
import {FAILED_TO_FETCH_COLLECTIONS_ERROR_PREFIX, useWeaviateCollections} from "./hooks/useWeaviateCollections";
import {useRagSecret} from "./hooks/useRagSecret";
import {GLOBAL_SECRETS} from "./constants";
import {useRagHandler} from "./hooks/useRagHandler";
import {RagPort} from "./components/RagPort";
import {RagSettings} from "./components/RagSettings";


export function RagNode ({data, id}: NodeProps<AppNode>) {
    assertIsEnhancedNodeData(data);
    assertIsRagNodeData(data);

    const [openSettings, setOpenSettings] = useState(false);
    const [error, setError] = useState<string[]>([]);
    const showError = useCallback((message: string) => setError(prev => [...prev, message]), []);
    const {title, embeddingModel, collectionName, weaviateUrl, onConfigChange} = data;
    const {models, isFetchingModels, fetchModels} = useFetchModels(showError);
    const [weaviateApiKey, setWeaviateApiKey] = useRagSecret(GLOBAL_SECRETS.API_KEY, data.weaviateApiKey);
    const [ownerKey, setOwnerKey] = useRagSecret(GLOBAL_SECRETS.OWNER_KEY, data.ownerKey);
    const change = (changes: Partial<RagNodeData>) => onConfigChange(id, changes);
    const collections = useWeaviateCollections({id, weaviateUrl, weaviateApiKey, ownerKey, onConfigChange, onError: showError});

    useRagHandler({id, settings: data, weaviateApiKey, ownerKey, onConfigChange, showError});

    // A model Ollama no longer has is dropped, unless the collection locks it; the lock itself is checked again.
    useOnOpen(openSettings, () => {
        void fetchModels().then((fetchedModels) => {
            if (isModelGone(embeddingModel, fetchedModels) && !collections.isEmbeddingModelLockedRef.current) change({embeddingModel: ""});
        });

        collections.checkCollectionLockByName(collectionName ?? "").catch(() => { /* ignore */ });
    });

    const pickCollection = (item: DropdownMenuItem) => {
        setError(prev => prev.filter(message => !message.includes(FAILED_TO_FETCH_COLLECTIONS_ERROR_PREFIX)));

        void collections.selectCollection(item);
    };

    const hasMissingConfig = !embeddingModel || !collectionName || !weaviateUrl;

    return (
        <>
            <MonitoredNode
                id={id}
                nodeIcon={Icon}
                ports={{}}
                title={title}
                settings={{callback: () => setOpenSettings(true), highlight: hasMissingConfig}}
                error={error}
                extraPorts={<RagPort />}
            />
            <RagSettings
                open={openSettings}
                onClose={() => setOpenSettings(false)}
                title={title}
                data={data}
                change={change}
                apiKey={weaviateApiKey}
                setApiKey={setWeaviateApiKey}
                ownerKey={ownerKey}
                setOwnerKey={setOwnerKey}
                models={models}
                isFetchingModels={isFetchingModels}
                collections={collections}
                onPickCollection={pickCollection}
            />
        </>
    );
}
