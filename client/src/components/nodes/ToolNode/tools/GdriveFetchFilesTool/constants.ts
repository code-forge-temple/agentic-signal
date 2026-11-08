import {GOOGLE_CLIENT_ID_KEY, googleOauthHandler} from "../utils/oauth";

export const OAUTH_PROVIDER = "drive.readonly";

export const OAUTH_PROVIDER_SCOPE = "https://www.googleapis.com/auth/drive.readonly";

export const oauthHandler = googleOauthHandler;

export const TOOL_SUBTYPE = "gdrive-fetch-files";

/** The userConfig fields Settings → Credentials can save. The access token isn't one: it expires within the hour. */
export const LOCAL_SECRETS = {
    GOOGLE_CLIENT_ID: GOOGLE_CLIENT_ID_KEY,
} as const;

/** The global store keys for the same fields: one Client ID serves every Google tool. */
export const GLOBAL_SECRETS = {
    GOOGLE_CLIENT_ID: GOOGLE_CLIENT_ID_KEY,
} as const satisfies Record<keyof typeof LOCAL_SECRETS, string>;
