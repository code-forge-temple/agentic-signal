/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

/* eslint-disable max-len */

import {generateGraphQLType} from "../../utils/graphqlUtils.ts";
import {FormInteractionButtonFields, FormInteractionFieldFields, FormInteractionResultFields} from "./types.ts";


export const graphqlMethodName = "formInteraction";

export const closeFormSessionsMethodName = "closeFormSessions";

export const graphqlResultTypeName = "FormInteractionResult";

export const graphqlFieldTypeName = "FormInteractionField";

export const graphqlButtonTypeName = "FormInteractionButton";

export const typeDefs = `
  input AttachedFileInput {
    name: String!
    base64: String!
    mimeType: String!
  }
  input FillActionInput {
    selector: String!
    actionType: String!
    value: String
    fileKey: String
  }
  ${generateGraphQLType(graphqlFieldTypeName, FormInteractionFieldFields)}
  ${generateGraphQLType(graphqlButtonTypeName, FormInteractionButtonFields)}
  ${generateGraphQLType(graphqlResultTypeName, FormInteractionResultFields)}
`;

// Scalar args are kept flat so the resolver receives plain JS objects.
export const queryDefs = /* GraphQL */ `
  ${graphqlMethodName}(url: String!, actions: [FillActionInput], submitSelector: String, attachedFiles: [AttachedFileInput], typingDelay: Float!, browserPath: String, interactionTimeoutSeconds: Float!, sessionId: String!, toolName: String!): ${graphqlResultTypeName}
  ${closeFormSessionsMethodName}(sessionId: String!): Boolean!
`;
