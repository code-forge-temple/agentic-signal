/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {Box, FormControl, InputLabel, MenuItem, Select} from "@mui/material";
import {DocMagnifyingGlass} from "iconoir-react";
import {BaseDialog} from "../../../BaseDialog";
import {DebouncedTextField} from "../../../DebouncedTextField";
import {DropdownButton, DropdownMenuItem} from "../../../DropdownButton/DropdownButton";
import {modelOptions} from "../../../../hooks/useFetchModels";
import {saveCountWithin} from "../../../../utils/countWithin";
import {defaultRagNodeData, RagNodeData} from "../types/workflow";
import {useWeaviateCollections} from "../hooks/useWeaviateCollections";


const EMBEDDING_MODEL_LABEL = "Embedding Model";

type ChangeData = (data: Partial<RagNodeData>) => void;
type Collections = ReturnType<typeof useWeaviateCollections>;

function ModelField ({embeddingModel, models, isFetchingModels, locked, change}: {
    embeddingModel: string; models: string[]; isFetchingModels: boolean; locked: boolean; change: ChangeData;
}) {
    return (
        <>
            <FormControl fullWidth size="small">
                <InputLabel id="rag-embedding-model-label">{EMBEDDING_MODEL_LABEL}</InputLabel>
                <Select
                    labelId="rag-embedding-model-label"
                    label={EMBEDDING_MODEL_LABEL}
                    value={embeddingModel || ""}
                    onChange={event => change({embeddingModel: event.target.value})}
                    disabled={isFetchingModels || locked}
                >
                    <MenuItem value="" disabled>
                        {isFetchingModels ? "Loading models..." : "Select a model..."}
                    </MenuItem>
                    {modelOptions(embeddingModel, models).map(model => (
                        <MenuItem key={model} value={model}>{`${model}${locked && embeddingModel === model ? " (locked by collection)" : ""}`}</MenuItem>
                    ))}
                </Select>
            </FormControl>
            {locked && (
                <Box sx={{mt: -1.5, ml: 1.75, fontSize: "0.75rem", color: "text.secondary"}}>
                    Model is locked to the existing collection. Edit the collection name to unlock.
                </Box>
            )}
        </>
    );
}

function CollectionField ({collectionName, weaviateUrl, change, collections, onPick}: {
    collectionName: string; weaviateUrl: string; change: ChangeData; collections: Collections; onPick: (item: DropdownMenuItem) => void;
}) {
    return (
        <Box sx={{display: "flex", alignItems: "flex-start", gap: 1}}>
            <DebouncedTextField
                label="Collection Name"
                fullWidth
                size="small"
                value={collectionName ?? defaultRagNodeData.collectionName}
                onChange={value => {
                    change({collectionName: value});
                    collections.checkCollectionLockByName(value).catch(() => { /* ignore */ });
                }}
                helperText="Namespace for this knowledge base in Weaviate"
            />
            <DropdownButton
                buttonLabel={<DocMagnifyingGlass style={{verticalAlign: "middle"}} />}
                menuItems={collections.availableCollections}
                loading={collections.loadingCollections}
                disabled={!weaviateUrl}
                noItemsAvailable="No collections found"
                onButtonClick={() => void collections.fetchCollections()}
                onMenuItemClick={onPick}
                sx={{height: 40, minWidth: 40, p: 0, flexShrink: 0}}
            />
        </Box>
    );
}

function ChunkFields ({data, change}: {data: RagNodeData; change: ChangeData}) {
    return (
        <>
            <DebouncedTextField
                label="Chunk Size (words)"
                type="number"
                fullWidth
                size="small"
                value={data.chunkSize ?? defaultRagNodeData.chunkSize}
                onChange={value => saveCountWithin(value, 64, 2048, count => change({chunkSize: count}))}
            />
            <DebouncedTextField
                label="Chunk Overlap (words)"
                type="number"
                fullWidth
                size="small"
                value={data.chunkOverlap ?? defaultRagNodeData.chunkOverlap}
                onChange={value => saveCountWithin(value, 0, 256, count => change({chunkOverlap: count}))}
            />
            <DebouncedTextField
                label="Top-K Results"
                type="number"
                fullWidth
                size="small"
                value={data.topK ?? defaultRagNodeData.topK}
                onChange={value => saveCountWithin(value, 1, 20, count => change({topK: count}))}
                helperText="Number of most relevant chunks to inject as context"
            />
        </>
    );
}

type RagSettingsProps = {
    open: boolean;
    onClose: () => void;
    title: string;
    data: RagNodeData;
    change: ChangeData;
    apiKey: string;
    setApiKey: (value: string) => void;
    models: string[];
    isFetchingModels: boolean;
    collections: Collections;
    /** A collection picked from the list; the dialog clears an old "couldn't fetch collections" error first. */
    onPickCollection: (item: DropdownMenuItem) => void;
};

/** The RAG node's settings dialog. */
export function RagSettings (props: RagSettingsProps) {
    const {open, onClose, title, data, change, apiKey, setApiKey, models, isFetchingModels, collections, onPickCollection} = props;

    return (
        <BaseDialog open={open} onClose={onClose} title={title}>
            <Box sx={{display: "flex", flexDirection: "column", gap: 2, pt: 1}}>
                <DebouncedTextField
                    label="Weaviate URL"
                    fullWidth
                    size="small"
                    value={data.weaviateUrl ?? defaultRagNodeData.weaviateUrl}
                    onChange={value => change({weaviateUrl: value})}
                    helperText="e.g. http://localhost:8080"
                />
                <DebouncedTextField
                    label="API Key (optional)"
                    fullWidth
                    size="small"
                    value={apiKey}
                    onChange={setApiKey}
                    helperText="Leave blank for unauthenticated local Weaviate"
                />
                <ModelField
                    embeddingModel={data.embeddingModel}
                    models={models}
                    isFetchingModels={isFetchingModels}
                    locked={collections.isEmbeddingModelLocked}
                    change={change}
                />
                <CollectionField collectionName={data.collectionName} weaviateUrl={data.weaviateUrl} change={change} collections={collections} onPick={onPickCollection} />
                <ChunkFields data={data} change={change} />
            </Box>
        </BaseDialog>
    );
}
