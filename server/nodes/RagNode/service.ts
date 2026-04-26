/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {Ollama} from "npm:ollama";
import {extractFileBlocksFromMarkdown, extractQueryFromMarkdown} from "../../../shared/utils.ts";
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
    toWeaviateClassName,
    upsertMeta,
    weaviateHeaders,
} from "./utils/weaviateClient.ts";


export async function ragIngestAndRetrieve (args: RagIngestAndRetrieveArgs): Promise<RagRetrieveResult> {
    const {
        input,
        collectionName,
        embeddingModel,
        chunkSize,
        chunkOverlap,
        topK,
        ollamaHost,
        weaviateUrl,
        weaviateApiKey,
    } = args;

    try {
        const files = extractFileBlocksFromMarkdown(input);
        const query = extractQueryFromMarkdown(input);

        if (!query && files.length === 0) {
            return {success: false, context: null, error: "No input content to process"};
        }

        const ollama = new Ollama({host: ollamaHost || ""});
        const base = weaviateUrl.replace(/\/$/, "");
        const h = weaviateHeaders(weaviateApiKey);

        const className = toWeaviateClassName(collectionName || "ragDefault");
        const metaClassName = `${className}Meta`;

        // Ensure meta class exists
        if (!(await classExists(base, h, metaClassName))) {
            await createMetaClass(base, h, metaClassName);
        }

        // Compute per-file hashes and determine what needs re-ingestion
        const currentFileHashes: Record<string, string> = {};

        for (const file of files) {
            currentFileHashes[file.name] = await hashString(file.content);
        }

        const storedMeta = await getStoredMeta(base, h, metaClassName);

        // Model change invalidates all stored vectors (dimension mismatch) - must full re-ingest
        const modelChanged = files.length > 0 && storedMeta !== undefined && storedMeta.embeddingModel !== embeddingModel;

        // Only ingest files whose content has changed or are new to this collection
        const filesToIngest = modelChanged
            ? files
            : files.filter(f => currentFileHashes[f.name] !== storedMeta?.fileHashes[f.name]);

        if (filesToIngest.length > 0) {
            if (modelChanged) {
                // Drop entire chunks class - existing vectors have wrong dimensions
                if (await classExists(base, h, className)) {
                    await deleteClass(base, h, className);
                }

                await createChunksClass(base, h, className);
            } else {
                // Ensure class exists, then surgically delete only stale chunks for files being re-ingested
                if (!(await classExists(base, h, className))) {
                    await createChunksClass(base, h, className);
                } else {
                    for (const file of filesToIngest) {
                        await deleteChunksBySourceFile(base, h, className, file.name);
                    }
                }
            }

            const allChunks: {content: string; sourceFile: string; chunkIndex: number}[] = [];

            for (const file of filesToIngest) {
                const chunks = chunkText(file.content, chunkSize, chunkOverlap);

                for (let i = 0; i < chunks.length; i++) {
                    allChunks.push({content: chunks[i], sourceFile: file.name, chunkIndex: i});
                }
            }

            if (allChunks.length > 0) {
                const embedResponse = await ollama.embed({
                    model: embeddingModel,
                    input: allChunks.map(c => c.content),
                });

                const documents = allChunks.map((chunk, i) => ({
                    ...chunk,
                    embedding: embedResponse.embeddings[i],
                }));

                await batchInsert(base, h, className, documents);
            }

            // On model change: only current files are in DB (others were dropped with the class)
            // Otherwise: merge with existing hashes to preserve files ingested by other workflows
            const newFileHashes = modelChanged
                ? currentFileHashes
                : {...(storedMeta?.fileHashes ?? {}), ...currentFileHashes};

            await upsertMeta(base, h, metaClassName, newFileHashes, embeddingModel, collectionName || "ragDefault", storedMeta?.id);
        } else if (!(await classExists(base, h, className))) {
            // Nothing to ingest and no existing class - nothing to query
            return {success: true, context: null, error: null};
        }

        if (!query) {
            return {success: true, context: null, error: null};
        }

        const queryEmbedResponse = await ollama.embed({model: embeddingModel, input: query});
        const queryEmbedding = queryEmbedResponse.embeddings[0];

        const results = await nearVectorSearch(base, h, className, queryEmbedding, topK);

        if (results.length === 0) {
            return {success: true, context: null, error: null};
        }

        const context = results
            .map((chunk, i) => `[${i + 1}] (${chunk.sourceFile})\n${chunk.content}`)
            .join("\n\n");

        return {success: true, context, error: null};
    } catch (error) {
        return {
            success: false,
            context: null,
            error: error instanceof Error ? error.message : String(error),
        };
    }
}