/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {Ollama} from "npm:ollama";
import {extractFileBlocksFromMarkdown, extractQueryFromMarkdown, errorMessage, isRagMetaClass, ragClassName} from "../../../shared/utils.ts";
import {DEFAULT_RAG_COLLECTION} from "../../../shared/constants.ts";
import {RagIngestAndRetrieveArgs, RagRetrieveResult} from "./types.ts";
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

function ragCollection (args: RagIngestAndRetrieveArgs): RagCollection {
    const base = args.weaviateUrl.replace(/\/$/, "");
    const h = weaviateHeaders(args.weaviateApiKey);
    const className = ragClassName(args.collectionName);

    return {
        ollama: new Ollama({host: args.ollamaHost || ""}),
        chunks: {base, h, className},
        meta: {base, h, className: `${className}Meta`},
        args,
    };
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
 * dimension); else it's created when missing, or each file's old chunks are deleted.
 */
async function prepareChunksClass (chunks: WeaviateClass, modelChanged: boolean, filesToIngest: FileBlock[]): Promise<void> {
    if (modelChanged) {
        if (await classExists(chunks)) await deleteClass(chunks);

        await createChunksClass(chunks);

        return;
    }

    if (!(await classExists(chunks))) {
        await createChunksClass(chunks);

        return;
    }

    for (const file of filesToIngest) {
        await deleteChunksBySourceFile(chunks, file.name);
    }
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

    await prepareChunksClass(chunks, modelChanged, filesToIngest);
    await embedAndInsert(collection, filesToIngest);

    const metaProperties = {
        fileHashes: ingestedHashes(currentHashes, storedMeta, modelChanged),
        embeddingModel: args.embeddingModel,
        originalName: args.collectionName || DEFAULT_RAG_COLLECTION,
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
