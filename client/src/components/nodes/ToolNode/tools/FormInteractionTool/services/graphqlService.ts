/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {graphqlRequest} from "../../../../../../utils";
import {AttachedFile, FillAction} from "@shared/types.gen";
import {SessionId} from "../../types";


export interface FormInteractionParams {
    url: string;
    actions?: FillAction[];
    submitSelector?: string;
    attachedFiles?: AttachedFile[];
    typingDelay: number;
    browserPath?: string;
    interactionTimeoutSeconds: number;
    sessionId: SessionId;
    toolName: string;
}

export interface FormInteractionFieldResult {
    label: string;
    name: string;
    type: string;
    selector: string;
    required: boolean;
    options?: string[];
    currentValue?: string;
    placeholder?: string;
}

export interface FormInteractionButtonResult {
    label: string;
    selector: string;
}

export interface FormInteractionQueryResult {
    success: boolean;
    currentUrl: string;
    pageTitle: string;
    submitted: boolean;
    formFields: FormInteractionFieldResult[];
    actionButtons: FormInteractionButtonResult[];
    error?: string;
}

export class GraphQLService {
    static async formInteraction (params: FormInteractionParams): Promise<FormInteractionQueryResult> {
        const data = await graphqlRequest<{ formInteraction: FormInteractionQueryResult }>(
            /* GraphQL */ `
                query(
                    $url: String!
                    $actions: [FillActionInput]
                    $submitSelector: String
                    $attachedFiles: [AttachedFileInput]
                    $typingDelay: Float!
                    $browserPath: String
                    $interactionTimeoutSeconds: Float!
                    $sessionId: String!
                    $toolName: String!
                ) {
                    formInteraction(
                        url: $url
                        actions: $actions
                        submitSelector: $submitSelector
                        attachedFiles: $attachedFiles
                        typingDelay: $typingDelay
                        browserPath: $browserPath
                        interactionTimeoutSeconds: $interactionTimeoutSeconds
                        sessionId: $sessionId
                        toolName: $toolName
                    ) {
                        success
                        currentUrl
                        pageTitle
                        submitted
                        formFields {
                            label
                            name
                            type
                            selector
                            required
                            options
                            currentValue
                            placeholder
                        }
                        actionButtons {
                            label
                            selector
                        }
                        error
                    }
                }
            `,
            params
        );

        return data.formInteraction;
    }

    /** Closes every browser session this run opened (across all form URLs it visited). */
    static async closeFormSessions (sessionId: SessionId): Promise<void> {
        await graphqlRequest(
            /* GraphQL */ `
                query($sessionId: String!) {
                    closeFormSessions(sessionId: $sessionId)
                }
            `,
            {sessionId}
        );
    }
}
