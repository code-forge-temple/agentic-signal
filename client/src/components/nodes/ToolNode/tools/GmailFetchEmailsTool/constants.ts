import {googleOauthHandler} from "../utils/oauth";

export const OAUTH_PROVIDER = "gmail.readonly";

export const OAUTH_PROVIDER_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";

export const oauthHandler = googleOauthHandler;