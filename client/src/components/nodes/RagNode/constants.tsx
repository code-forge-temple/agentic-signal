/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/


import {Brain} from "iconoir-react";

export {RAG_NODE_TYPE as NODE_TYPE} from "@shared/types.gen";

export const Icon = <Brain />;

export const TITLE = "RAG";

/** The node's data field that holds the Weaviate API key (only older workflow files still carry it). */
export const LOCAL_SECRETS = {
    API_KEY: "weaviateApiKey",
} as const;

/** The global store key for the same key, shared by every RAG node; Settings → Credentials can save it. */
export const GLOBAL_SECRETS = {
    API_KEY: "weaviateApiKey",
} as const satisfies Record<keyof typeof LOCAL_SECRETS, string>;
