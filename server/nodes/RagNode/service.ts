/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {Ollama} from "npm:ollama";
import {
    extractFileBlocksFromMarkdown,
    extractQueryFromMarkdown,
    errorMessage,
    isRagMetaClass,
    mayChangeRagCollection,
    ragClassName,
    ragOwnerKeyHash,
} from "../../../shared/utils.ts";
import {DEFAULT_RAG_COLLECTION} from "../../../shared/constants.ts";
import {RagDeleteCollectionArgs, RagDeleteCollectionResult, RagIngestAndRetrieveArgs, RagRetrieveResult} from "./types.ts";
import {chunkText, hashString} from "./utils/textUtils.ts";
import {
    batchInsert,
    classExists,
    createChunksClass,
    createMetaClass,
    deleteClass,
    deleteChunksBySourceFile,
    getStoredMeta,
    nearVectorSearch,
    StoredMeta,
    upsertMeta,
    WeaviateClass,
    weaviateHeaders,
} from "./utils/weaviateClient.ts";
import {withKeyedLock} from "../../utils/keyedLock.ts";


type FileBlock = {name: string; content: string};

/** What a run works with: the embedding client, the collection's chunks and meta classes, and the node's settings. */
type RagCollection = {
    ollama: Ollama;
    chunks: WeaviateClass;
    meta: WeaviateClass;
    args: RagIngestAndRetrieveArgs;
};

/** A collection's two Weaviate classes: its chunks, and its meta (file list, model, owner key fingerprint). */
function collectionClasses ({weaviateUrl, weaviateApiKey, collectionName}: RagDeleteCollectionArgs): {chunks: WeaviateClass; meta: WeaviateClass} {
    const base = weaviateUrl.replace(/\/$/, "");
    const h = weaviateHeaders(weaviateApiKey);
    const className = ragClassName(collectionName);

    return {chunks: {base, h, className}, meta: {base, h, className: `${className}Meta`}};
}

function ragCollection (args: RagIngestAndRetrieveArgs): RagCollection {
    return {ollama: new Ollama({host: args.ollamaHost || ""}), ...collectionClasses(args), args};
}

/** Refuses a change from a node whose owner key isn't the collection's; `refused` says what it can't do. */
async function assertMayChange (storedKeyHash: string | undefined, {collectionName, ownerKey}: RagDeleteCollectionArgs, refused: string): Promise<void> {
    if (await mayChangeRagCollection(storedKeyHash, ownerKey)) return;

    const whose = ownerKey ? "another one" : "empty";

    throw new Error(`Collection "${collectionName || DEFAULT_RAG_COLLECTION}" has an owner key, and this node's is ${whose}: ${refused}`);
}

/** Each file's content hash, by file name. */
async function hashFiles (files: FileBlock[]): Promise<Record<string, string>> {
    const hashes: Record<string, string> = {};

    for (const file of files) {
        hashes[file.name] = await hashString(file.content);
    }

    return hashes;
}

/**
 * Readies the chunks class for the files to ingest: on a model change it starts empty (the stored vectors have another
 * dimension); else it's created when missing, or each file's old chunks are deleted. Says whether it was missing.
 */
async function prepareChunksClass (chunks: WeaviateClass, modelChanged: boolean, filesToIngest: FileBlock[]): Promise<boolean> {
    if (modelChanged) {
        if (await classExists(chunks)) await deleteClass(chunks);

        await createChunksClass(chunks);

        return false;
    }

    if (!(await classExists(chunks))) {
        await createChunksClass(chunks);

        return true;
    }

    for (const file of filesToIngest) {
        await deleteChunksBySourceFile(chunks, file.name);
    }

    return false;
}

/** The files' chunks, in order, each with its file and its place in it. */
const fileChunks = (files: FileBlock[], chunkSize: number, chunkOverlap: number) =>
    files.flatMap(file => chunkText(file.content, chunkSize, chunkOverlap).map((content, chunkIndex) => ({content, sourceFile: file.name, chunkIndex})));

/** Embeds the files' chunks and stores them in the chunks class. */
async function embedAndInsert ({ollama, chunks, args}: RagCollection, files: FileBlock[]): Promise<void> {
    const allChunks = fileChunks(files, args.chunkSize, args.chunkOverlap);

    if (allChunks.length === 0) return;

    const {embeddings} = await ollama.embed({model: args.embeddingModel, input: allChunks.map(chunk => chunk.content)});

    await batchInsert(chunks, allChunks.map((chunk, i) => ({...chunk, embedding: embeddings[i]})));
}

/**
 * The file hashes the collection holds after the ingest: on a model change only the current files (the others went with
 * the class); else the stored ones too, which keeps files other workflows ingested.
 */
const ingestedHashes = (current: Record<string, string>, stored: StoredMeta | undefined, modelChanged: boolean) =>
    (modelChanged ? current : {...(stored?.fileHashes ?? {}), ...current});

/**
 * Ingests the files that are new or changed (all of them when the embedding model changed), and says whether the
 * collection has anything to query.
 */
async function ingestFiles (collection: RagCollection, files: FileBlock[]): Promise<boolean> {
    const {chunks, meta, args} = collection;

    // A query alone: nothing to write (no meta class made for a name nothing was ingested under), just whether to query.
    if (files.length === 0) return classExists(chunks);

    if (!(await classExists(meta))) await createMetaClass(meta);

    const currentHashes = await hashFiles(files);
    const storedMeta = await getStoredMeta(meta);
    const modelChanged = storedMeta !== undefined && storedMeta.embeddingModel !== args.embeddingModel;
    const filesToIngest = modelChanged ? files : files.filter(file => currentHashes[file.name] !== storedMeta?.fileHashes[file.name]);

    // Nothing to ingest: there's something to query only if an earlier run ingested files.
    if (filesToIngest.length === 0) return classExists(chunks);

    // Right before the first write: re-sending files the collection already has changes nothing, so anyone may.
    await assertMayChange(storedMeta?.ownerKeyHash, args, "it can query the collection, but not add files to it or change it.");

    const isNewCollection = await prepareChunksClass(chunks, modelChanged, filesToIngest);

    await embedAndInsert(collection, filesToIngest);

    const metaProperties = {
        fileHashes: ingestedHashes(currentHashes, storedMeta, modelChanged),
        embeddingModel: args.embeddingModel,
        originalName: args.collectionName || DEFAULT_RAG_COLLECTION,
        // Set when the collection is made, by the node that makes it; upsertMeta never changes it later.
        ownerKeyHash: isNewCollection ? await ragOwnerKeyHash(args.ownerKey) : undefined,
    };

    await upsertMeta(meta, metaProperties, storedMeta?.id);

    return true;
}

/**
 * Throws when the collection was embedded with another model than the query's: its vectors are of another length, so
 * the search would fail or match nothing that means anything. A class made outside the app has no meta to tell.
 */
async function checkQueryModel ({meta, args}: RagCollection): Promise<void> {
    if (!(await classExists(meta))) return;

    const storedModel = (await getStoredMeta(meta))?.embeddingModel;

    if (storedModel && storedModel !== args.embeddingModel) {
        // eslint-disable-next-line max-len
        throw new Error(`Collection "${args.collectionName || DEFAULT_RAG_COLLECTION}" was embedded with ${storedModel}, not ${args.embeddingModel}: query it with ${storedModel}.`);
    }
}

/** The chunks closest to the query, numbered with their files, as context for the LLM; null when there are none. */
async function retrieveContext ({ollama, chunks, args}: RagCollection, query: string): Promise<string | null> {
    const {embeddings} = await ollama.embed({model: args.embeddingModel, input: query});
    const results = await nearVectorSearch(chunks, embeddings[0], args.topK);

    if (results.length === 0) return null;

    return results.map((chunk, i) => `[${i + 1}] (${chunk.sourceFile})\n${chunk.content}`).join("\n\n");
}

export async function ragIngestAndRetrieve (args: RagIngestAndRetrieveArgs): Promise<RagRetrieveResult> {
    try {
        const files = extractFileBlocksFromMarkdown(args.input);
        const query = extractQueryFromMarkdown(args.input);

        if (!query && files.length === 0) {
            return {success: false, context: null, error: "No input content to process"};
        }

        const collection = ragCollection(args);
        const {className} = collection.chunks;

        // Classes ending in Meta hold the collections' file lists ("project"'s is ProjectMeta): a collection named
        // "projectMeta" would write its chunks into it.
        if (isRagMetaClass(className)) {
            // eslint-disable-next-line max-len
            return {success: false, context: null, error: `A collection's name can't end in "Meta" ("${args.collectionName}" would be the Weaviate class ${className}, where file lists are kept). Rename it.`};
        }

        /*
         * The ingest is one read-modify-write over the meta object, whose documentHash property is a JSON map of every
         * file in the collection. The read must be inside the lock: two runs that both read before either writes would
         * each PATCH back a map missing the other's files, and on a fresh collection would both POST a meta object
         * instead of one PATCHing the other's. The embed in the middle makes that window minutes wide.
         *
         * Keyed on the class name so only same-collection ingests wait; the query below stays outside, so queries on a
         * collection don't wait for each other. A query whose model isn't the collection's (another run changed it)
         * says so (checkQueryModel).
         */
        const hasQueryableClass = await withKeyedLock(className, () => ingestFiles(collection, files));

        if (!hasQueryableClass || !query) return {success: true, context: null, error: null};

        // With files, the ingest left the collection on this run's model; a query alone may meet another one.
        if (files.length === 0) await checkQueryModel(collection);

        return {success: true, context: await retrieveContext(collection, query), error: null};
    } catch (error) {
        return {
            success: false,
            context: null,
            error: errorMessage(error),
        };
    }
}

/**
 * Deletes a collection the app made: its chunks and meta classes. Only the owner key may, when it has one. A class
 * without a meta class wasn't made by the app (in a shared Weaviate it may be another app's data), so it's left alone.
 */
export async function ragDeleteCollection (args: RagDeleteCollectionArgs): Promise<RagDeleteCollectionResult> {
    try {
        const {chunks, meta} = collectionClasses(args);
        const name = args.collectionName || DEFAULT_RAG_COLLECTION;

        if (isRagMetaClass(chunks.className)) throw new Error(`"${name}" is no collection: Weaviate classes ending in "Meta" hold collections' file lists.`);

        // Keyed like the ingest, so a delete doesn't land in the middle of a run writing the same collection.
        await withKeyedLock(chunks.className, async () => {
            if (!(await classExists(meta))) {
                throw new Error(await classExists(chunks)
                    ? `Collection "${name}" wasn't made by Agentic Signal (it has no meta class): delete it in Weaviate.`
                    : `There's no collection "${name}".`);
            }

            await assertMayChange((await getStoredMeta(meta))?.ownerKeyHash, args, "only that key can delete the collection.");
            await deleteClass(chunks);
            await deleteClass(meta);
        });

        return {success: true, error: null};
    } catch (error) {
        return {success: false, error: errorMessage(error)};
    }
}
