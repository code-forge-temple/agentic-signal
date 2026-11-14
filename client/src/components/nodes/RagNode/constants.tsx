/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/


import {Brain} from "iconoir-react";

export {RAG_NODE_TYPE as NODE_TYPE} from "@shared/types.gen";

export const Icon = <Brain />;

export const TITLE = "RAG";

/**
 * The node's data fields that hold its secrets: the Weaviate API key, and the owner key that alone may change or delete
 * the collections it makes. Workflow files never keep them (only older ones still carry the API key).
 */
export const LOCAL_SECRETS = {
    API_KEY: "weaviateApiKey",
    OWNER_KEY: "ownerKey",
} as const;

/** The global store keys for the same secrets, shared by every RAG node; Settings → Credentials can save them. */
export const GLOBAL_SECRETS = {
    API_KEY: "weaviateApiKey",
    OWNER_KEY: "ragOwnerKey",
} as const satisfies Record<keyof typeof LOCAL_SECRETS, string>;
