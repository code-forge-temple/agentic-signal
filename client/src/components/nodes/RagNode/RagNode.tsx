/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {Handle, Position, useReactFlow, type NodeProps} from "@xyflow/react";
import {useEffect, useState} from "react";
import {BaseNode} from "../BaseNode";
import {Box, FormControl, InputLabel, MenuItem, Select} from "@mui/material";
import {BaseDialog} from "../../BaseDialog";
import {LogsDialog} from "../../LogsDialog";
import {DebouncedTextField} from "../../DebouncedTextField";
import {Icon} from "./constants";
import {AppNode} from "../workflow.gen";
import {assertIsEnhancedNodeData} from "../../../types/workflow";
import {assertIsRagNodeData, defaultRagNodeData} from "./types/workflow";
import {ragService} from "./services/ragService";
import {RAG_PORT_COLOR, RAG_PORT_ID} from "../../../constants";
import {NODE_TYPE as LLM_NODE_TYPE} from "../LlmProcessNode/constants";
import {useFetchModels} from "../../../hooks/useFetchModels";
import {DropdownButton} from "../../DropdownButton/DropdownButton";
import {DocMagnifyingGlass} from "iconoir-react";
import {useWeaviateCollections} from "./hooks/useWeaviateCollections";


const EMBEDDING_MODEL_LABEL = "Embedding Model";

export function RagNode ({data, id}: NodeProps<AppNode>) {
    assertIsEnhancedNodeData(data);
    assertIsRagNodeData(data);

    const [openSettings, setOpenSettings] = useState(false);
    const [openLogs, setOpenLogs] = useState(false);
    const [error, setError] = useState<string[]>([]);

    const {models, isFetchingModels, fetchModels} = useFetchModels((msg) => setError(prev => [...prev, msg]));

    const {
        title,
        embeddingModel,
        collectionName,
        chunkSize,
        chunkOverlap,
        topK,
        weaviateUrl,
        weaviateApiKey,
        onConfigChange,
    } = data;

    const {
        availableCollections,
        loadingCollections,
        isEmbeddingModelLocked,
        isEmbeddingModelLockedRef,
        checkCollectionLockByName,
        selectCollection,
        fetchCollections,
    } = useWeaviateCollections({
        id,
        weaviateUrl,
        onConfigChange,
        onError: (msg) => setError(prev => [...prev, msg]),
    });

    // Rebuild the handler whenever any config value changes
    useEffect(() => {
        onConfigChange(id, {
            handler: async (input: string): Promise<string> => {
                const ollamaHost = localStorage.getItem("ollamaHost") || "";

                try {
                    return await ragService.ingestAndRetrieve({
                        input,
                        collectionName: collectionName || defaultRagNodeData.collectionName,
                        embeddingModel: embeddingModel || "",
                        chunkSize: chunkSize ?? defaultRagNodeData.chunkSize,
                        chunkOverlap: chunkOverlap ?? defaultRagNodeData.chunkOverlap,
                        topK: topK ?? defaultRagNodeData.topK,
                        ollamaHost,
                        weaviateUrl: weaviateUrl || defaultRagNodeData.weaviateUrl,
                        weaviateApiKey,
                    });
                } catch (err) {
                    const msg = err instanceof Error ? err.message : String(err);

                    setError(prev => [...prev, msg]);

                    throw new Error(msg);
                }
            },
        });

    }, [
        id,
        embeddingModel,
        collectionName,
        chunkSize,
        chunkOverlap,
        topK,
        weaviateUrl,
        weaviateApiKey,
        onConfigChange
    ]);

    const {getNode, getEdges} = useReactFlow();

    useEffect(() => {
        if (openSettings) {
            fetchModels().then(fetchedModels => {
                if (embeddingModel && !fetchedModels.includes(embeddingModel) && !isEmbeddingModelLockedRef.current) {
                    onConfigChange(id, {embeddingModel: ""});
                }
            });

            checkCollectionLockByName(collectionName ?? "").catch(() => { /* ignore */ });
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [openSettings]);

    const hasMissingConfig = !embeddingModel || !collectionName || !weaviateUrl;

    return (
        <>
            <BaseNode
                id={id}
                nodeIcon={Icon}
                ports={{}}
                title={title}
                settings={{callback: () => setOpenSettings(true), highlight: hasMissingConfig}}
                logs={{callback: () => setOpenLogs(true), highlight: error.length > 0}}
                extraPorts={
                    <Handle
                        type="source"
                        id={RAG_PORT_ID}
                        position={Position.Right}
                        style={{backgroundColor: RAG_PORT_COLOR}}
                        isValidConnection={({target, targetHandle}) => {
                            const targetNode = getNode(target);

                            if (!targetNode || targetNode.type !== LLM_NODE_TYPE) return false;

                            if (targetHandle !== RAG_PORT_ID) return false;

                            const alreadyConnected = getEdges().some(
                                edge => edge.target === target && edge.targetHandle === RAG_PORT_ID
                            );

                            return !alreadyConnected;
                        }}
                    />
                }
            />

            <LogsDialog
                open={openLogs}
                onClose={() => setOpenLogs(false)}
                title={title}
                error={error}
            />

            <BaseDialog
                open={openSettings}
                onClose={() => setOpenSettings(false)}
                title={title}
            >
                <Box sx={{display: "flex", flexDirection: "column", gap: 2, pt: 1}}>
                    <DebouncedTextField
                        label="Weaviate URL"
                        fullWidth
                        size="small"
                        value={weaviateUrl ?? defaultRagNodeData.weaviateUrl}
                        onChange={value => onConfigChange(id, {weaviateUrl: value})}
                        helperText="e.g. http://localhost:8080"
                    />

                    <DebouncedTextField
                        label="API Key (optional)"
                        fullWidth
                        size="small"
                        value={weaviateApiKey ?? ""}
                        onChange={value => onConfigChange(id, {weaviateApiKey: value})}
                        helperText="Leave blank for unauthenticated local Weaviate"
                    />
                    <FormControl fullWidth size="small">
                        <InputLabel id="rag-embedding-model-label">{EMBEDDING_MODEL_LABEL}</InputLabel>
                        <Select
                            labelId="rag-embedding-model-label"
                            label={EMBEDDING_MODEL_LABEL}
                            value={embeddingModel || ""}
                            onChange={e => onConfigChange(id, {embeddingModel: e.target.value})}
                            disabled={isFetchingModels || isEmbeddingModelLocked}
                        >
                            <MenuItem value="" disabled>
                                {isFetchingModels ? "Loading models..." : "Select a model..."}
                            </MenuItem>
                            {models.map(m => (
                                <MenuItem key={m} value={m}>{`${m}${isEmbeddingModelLocked && embeddingModel === m ? " (locked by collection)" : ""}`}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                    {isEmbeddingModelLocked && (
                        <Box sx={{mt: -1.5, ml: 1.75, fontSize: "0.75rem", color: "text.secondary"}}>
                            Model is locked to the existing collection. Edit the collection name to unlock.
                        </Box>
                    )}

                    <Box sx={{display: "flex", alignItems: "flex-start", gap: 1}}>
                        <DebouncedTextField
                            label="Collection Name"
                            fullWidth
                            size="small"
                            value={collectionName ?? defaultRagNodeData.collectionName}
                            onChange={value => {
                                onConfigChange(id, {collectionName: value});
                                checkCollectionLockByName(value).catch(() => { /* ignore */ });
                            }}
                            helperText="Namespace for this knowledge base in Weaviate"
                        />
                        <DropdownButton
                            buttonLabel={<DocMagnifyingGlass style={{verticalAlign: "middle"}} />}
                            menuItems={availableCollections}
                            loading={loadingCollections}
                            disabled={!weaviateUrl}
                            noItemsAvailable="No collections found"
                            onButtonClick={fetchCollections}
                            onMenuItemClick={item => selectCollection(item)}
                            sx={{height: 40, minWidth: 40, p: 0, flexShrink: 0}}
                        />
                    </Box>

                    <DebouncedTextField
                        label="Chunk Size (words)"
                        type="number"
                        fullWidth
                        size="small"
                        value={chunkSize ?? defaultRagNodeData.chunkSize}
                        onChange={value => onConfigChange(id, {chunkSize: Math.max(64, Math.min(2048, parseInt(value)))})}
                    />

                    <DebouncedTextField
                        label="Chunk Overlap (words)"
                        type="number"
                        fullWidth
                        size="small"
                        value={chunkOverlap ?? defaultRagNodeData.chunkOverlap}
                        onChange={value => onConfigChange(id, {chunkOverlap: Math.max(0, Math.min(256, parseInt(value)))})}
                    />

                    <DebouncedTextField
                        label="Top-K Results"
                        type="number"
                        fullWidth
                        size="small"
                        value={topK ?? defaultRagNodeData.topK}
                        onChange={value => onConfigChange(id, {topK: Math.max(1, Math.min(20, parseInt(value)))})}
                        helperText="Number of most relevant chunks to inject as context"
                    />
                </Box>
            </BaseDialog>
        </>
    );
}
