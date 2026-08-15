/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {graphqlBaseUrl} from "../../../../../../utils";


export interface FillActionInput {
    selector: string;
    /** Renamed from 'type' — avoids the GraphQL reserved-keyword collision. */
    actionType: string;
    value?: string;
    fileKey?: string;
}

export interface AttachedFileInput {
    name: string;
    base64: string;
    mimeType: string;
}

export interface FormInteractionParams {
    url: string;
    actions?: FillActionInput[];
    submitSelector?: string;
    /** Binary files forwarded from DataSourceNode — written to a temp dir on the server per run. */
    attachedFiles?: AttachedFileInput[];
    /** Seconds between each field action; 0 = instant fill with no pauses. */
    typingDelay: number;
    browserPath?: string;
    /** Maximum seconds for one formInteraction call. */
    interactionTimeoutSeconds: number;
    /**
     * Scopes the server-side browser session to a single run so concurrent runs (e.g. the
     * same workflow launched from two tabs) don't collide on the same form URL.
     */
    sessionId: string;
    /** Tool subtype identifier forwarded so server error messages reference the correct tool name. */
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
        const response = await fetch(graphqlBaseUrl, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({
                query: /* GraphQL */ `
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
                variables: params,
            }),
        });

        const {data, errors} = await response.json();

        if (errors) {
            throw new Error(errors.map((e: any) => e.message).join("\n"));
        }

        return data.formInteraction;
    }

    /** Closes every browser session this run opened (across all form URLs it visited). */
    static async closeFormSessions (sessionId: string): Promise<void> {
        const response = await fetch(graphqlBaseUrl, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({
                query: /* GraphQL */ `
                    query($sessionId: String!) {
                        closeFormSessions(sessionId: $sessionId)
                    }
                `,
                variables: {sessionId},
            }),
        });

        const {errors} = await response.json();

        if (errors) {
            throw new Error(errors.map((e: any) => e.message).join("\n"));
        }
    }
}
