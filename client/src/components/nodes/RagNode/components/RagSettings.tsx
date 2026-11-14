/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {useState} from "react";
import Box from "@mui/material/Box";
import FormControl from "@mui/material/FormControl";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Tooltip from "@mui/material/Tooltip";
import {DocMagnifyingGlass, Shuffle, Trash} from "iconoir-react";
import {v4 as uuidv4} from "uuid";
import {BaseDialog} from "../../../BaseDialog";
import {ConfirmDialog} from "../../../ConfirmDialog";
import {DebouncedTextField} from "../../../DebouncedTextField";
import {DropdownButton, DropdownMenuItem} from "../../../DropdownButton/DropdownButton";
import {modelOptions} from "../../../../hooks/useFetchModels";
import {saveCountWithin} from "../../../../utils/countWithin";
import {defaultRagNodeData, RagNodeData} from "../types/workflow";
import {CollectionItem, useWeaviateCollections} from "../hooks/useWeaviateCollections";


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

// eslint-disable-next-line max-len
const OWNER_KEY_HINT = "Collections this node makes can then be changed (files added or replaced, the model changed) or deleted only with this key; anyone can query them. Save it in Settings → Credentials, or it's gone after a reload.";

// The generate button shows only while the field is empty: a new key would lock this node out of the collections the old one made.
function OwnerKeyField ({ownerKey, setOwnerKey}: {ownerKey: string; setOwnerKey: (value: string) => void}) {
    const generateButton = (
        <InputAdornment position="end">
            <Tooltip title="Generate a key">
                <IconButton size="small" edge="end" aria-label="Generate a key" onClick={() => setOwnerKey(uuidv4())}>
                    <Shuffle />
                </IconButton>
            </Tooltip>
        </InputAdornment>
    );

    return (
        <DebouncedTextField
            label="Owner Key (optional)"
            fullWidth
            size="small"
            value={ownerKey}
            onChange={setOwnerKey}
            helperText={OWNER_KEY_HINT}
            slotProps={{input: {endAdornment: ownerKey ? undefined : generateButton}}}
        />
    );
}

const deleteMessage = (item: CollectionItem) => {
    const unowned = item.owned ? "" : " It has no owner key, so anyone can delete it.";

    return `Delete the collection "${item.value}" and everything ingested into it from Weaviate? This can't be undone.${unowned}`;
};

/**
 * Deleting from the collection list: a bin on the collections this node may delete (the server checks the owner key
 * again), the confirmation, and why the last delete failed, until the next try.
 */
function useCollectionDeletion (collections: Collections, collectionName: string) {
    // The collection the confirmation names; kept while the dialog fades out, so it doesn't empty as it closes.
    const [pending, setPending] = useState<CollectionItem | null>(null);
    const [confirming, setConfirming] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);

    const menuItems = collections.availableCollections.map(item => (item.deletable
        ? {...item, action: {label: `Delete "${item.value}"`, icon: <Trash />, onClick: () => {
            setPending(item);
            setConfirming(true);
            setDeleteError(null);
        }}}
        : item));

    const confirmation = {
        open: confirming,
        onClose: () => setConfirming(false),
        message: pending ? deleteMessage(pending) : "",
        onConfirm: () => {
            if (pending) void collections.deleteCollection(pending, collectionName).then(setDeleteError);
        },
    };

    return {menuItems, confirmation, deleteError, clearDeleteError: () => setDeleteError(null)};
}

function CollectionField ({collectionName, weaviateUrl, change, collections, onPick}: {
    collectionName: string; weaviateUrl: string; change: ChangeData; collections: Collections; onPick: (item: DropdownMenuItem) => void;
}) {
    const {menuItems, confirmation, deleteError, clearDeleteError} = useCollectionDeletion(collections, collectionName);

    return (
        <Box sx={{display: "flex", alignItems: "flex-start", gap: 1}}>
            <DebouncedTextField
                label="Collection Name"
                fullWidth
                size="small"
                value={collectionName ?? defaultRagNodeData.collectionName}
                onChange={value => {
                    clearDeleteError();
                    change({collectionName: value});
                    collections.checkCollectionLockByName(value).catch(() => { /* ignore */ });
                }}
                // A failed delete shows here: the node's logs, where it's also written, can't be seen behind the dialog.
                error={deleteError !== null}
                helperText={deleteError ?? "Namespace for this knowledge base in Weaviate"}
            />
            <DropdownButton
                buttonLabel={<DocMagnifyingGlass style={{verticalAlign: "middle"}} />}
                menuItems={menuItems}
                loading={collections.loadingCollections}
                disabled={!weaviateUrl}
                noItemsAvailable="No collections found"
                onButtonClick={() => {
                    clearDeleteError();
                    void collections.fetchCollections();
                }}
                onMenuItemClick={onPick}
                sx={{height: 40, minWidth: 40, p: 0, flexShrink: 0}}
            />
            <ConfirmDialog {...confirmation} title="Delete the Collection" confirmLabel="Delete" maximizable={false} />
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
    ownerKey: string;
    setOwnerKey: (value: string) => void;
    models: string[];
    isFetchingModels: boolean;
    collections: Collections;
    /** A collection picked from the list; the dialog clears an old "couldn't fetch collections" error first. */
    onPickCollection: (item: DropdownMenuItem) => void;
};

/** The RAG node's settings dialog. */
export function RagSettings (props: RagSettingsProps) {
    const {open, onClose, title, data, change, apiKey, setApiKey, ownerKey, setOwnerKey, models, isFetchingModels, collections, onPickCollection} = props;

    return (
        <BaseDialog open={open} onClose={onClose} title={title}>
            <Box sx={{display: "flex", flexDirection: "column", gap: 2, pt: 1}}>
                <DebouncedTextField
                    label="Weaviate URL"
                    fullWidth
                    size="small"
                    value={data.weaviateUrl ?? defaultRagNodeData.weaviateUrl}
                    onChange={value => change({weaviateUrl: value})}
                    helperText="e.g. http://localhost:9090"
                />
                <DebouncedTextField
                    label="API Key (optional)"
                    fullWidth
                    size="small"
                    value={apiKey}
                    onChange={setApiKey}
                    helperText="Leave blank for unauthenticated local Weaviate"
                />
                <OwnerKeyField ownerKey={ownerKey} setOwnerKey={setOwnerKey} />
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
