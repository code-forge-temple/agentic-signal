/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

export const graphqlMethodName = "searchJobs";

// `config` is a JSON-encoded JobSearchFilters; the result is a JSON-encoded
// JobSearchResult. Kept as opaque strings (like HttpNode's renderHtml) to avoid
// hand-maintaining a deep GraphQL type for the nested job shape.
export const queryDefs = /* GraphQL */ `${graphqlMethodName}(config: String!): String`;
