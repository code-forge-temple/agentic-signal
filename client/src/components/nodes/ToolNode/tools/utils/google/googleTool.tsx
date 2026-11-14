/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {ToolDefinition} from "../../types";
import {extendSystemUserConfigSchema} from "../../../../../../types/tool.types";
import {ACCESS_TOKEN_KEY, ACCESS_TOKEN_TYPE_OAUTH, GOOGLE_CLIENT_ID_KEY, googleOauthHandler} from "./oauth";
import {GoogleToolOauthConfigFields} from "./GoogleToolOauthConfigFields";
import {UserConfigFields} from "../../../UserConfigFields";
import {excludeKeysFromObject} from "../../../../../../utils";


/** What a Google tool's call gets, once its settings are known to be there. */
export type GoogleAuth = {accessToken: string; maxResults: number};

type ToolError = {error: string};

/** What sets one Google tool apart; googleTool() adds what every Google tool shares. */
export type GoogleToolSpec<Params, Result> = Pick<ToolDefinition, "toolSubtype" | "title" | "icon" | "toolSchema"> & {
    /** The Google service as the user reads it ("Gmail"), in the settings and the errors. */
    service: string;
    /** The read-only OAuth scope's name ("gmail.readonly", under https://www.googleapis.com/auth/), also on the Connect button. */
    scope: string;
    /** What the settings call one result ("emails"), and the most the Google API returns in one call. */
    maxResults: {items: string; maximum: number};
    /** The tool's own part of a call: it checks what the LLM sent and asks the backend. A throw reaches the LLM as `{error}`. */
    fetch: (params: Params, auth: GoogleAuth) => Promise<Result | ToolError>;
};

const MAX_RESULTS_MISSING = "Maximum results must be specified. Please set maxResults in the configuration.";

/**
 * The secrets Settings → Credentials can save: the Client ID, one for every Google tool. The access token isn't one: it
 * expires within the hour.
 */
const SAVED_SECRETS: readonly string[] = [GOOGLE_CLIENT_ID_KEY];

const failure = (error: unknown): ToolError => ({error: error instanceof Error ? error.message : "Unknown error"});

/**
 * A Google tool: the Client ID and the OAuth sign-in it shares with the other Google tools, a maxResults setting, and a
 * handler that asks for the sign-in and maxResults before the tool's own `fetch` runs.
 */
export function googleTool<Params, Result> ({service, scope, maxResults, fetch, ...tool}: GoogleToolSpec<Params, Result>): ToolDefinition {
    const authDescription = `${service} Authentication`;
    const scopeUrl = `https://www.googleapis.com/auth/${scope}`;
    const userConfigSchema = extendSystemUserConfigSchema({
        [GOOGLE_CLIENT_ID_KEY]: {
            type: "string",
            description: "Google OAuth2 Client ID (from Google Cloud Console)",
        },
        [ACCESS_TOKEN_KEY]: {
            // Shown as a Connect button and an access token field.
            type: ACCESS_TOKEN_TYPE_OAUTH,
            description: authDescription,
            provider: scope,
            scope: scopeUrl,
            oauthHandler: googleOauthHandler,
            required: true,
        },
        maxResults: {
            type: "integer",
            description: `Maximum number of ${maxResults.items} to fetch`,
            default: 5,
            minimum: 1,
            maximum: maxResults.maximum,
        },
    });
    // The fields the generic form shows; the sign-in has its own.
    const otherFields = excludeKeysFromObject(userConfigSchema, [ACCESS_TOKEN_KEY, GOOGLE_CLIENT_ID_KEY]);

    return {
        ...tool,
        userConfigSchema,
        globalSecrets: SAVED_SECRETS,
        toSanitize: [ACCESS_TOKEN_KEY, ...SAVED_SECRETS].map(field => `userConfig.${field}`),
        renderConfig: ({userConfig, onConfigChange}) => (
            <>
                <GoogleToolOauthConfigFields
                    toolSubtype={tool.toolSubtype}
                    scope={scopeUrl}
                    provider={scope}
                    oauthHandler={googleOauthHandler}
                    description={authDescription}
                    userConfig={userConfig}
                    onConfigChange={onConfigChange}
                />
                <UserConfigFields
                    userConfigSchema={otherFields}
                    userConfig={userConfig}
                    onConfigChange={onConfigChange}
                />
            </>
        ),
        handlerFactory: (userConfig: Partial<GoogleAuth>) => async (params: Params): Promise<Result | ToolError> => {
            const {accessToken, maxResults: count} = userConfig;

            if (!accessToken) return {error: `${service} authentication required. Please connect your ${service} account.`};

            if (!count) return {error: MAX_RESULTS_MISSING};

            try {
                return await fetch(params, {accessToken, maxResults: count});
            } catch (error) {
                return failure(error);
            }
        },
    };
}
