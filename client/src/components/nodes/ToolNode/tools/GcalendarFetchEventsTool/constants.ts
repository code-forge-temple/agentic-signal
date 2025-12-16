import {googleOauthHandler} from "../utils/oauth";

export const OAUTH_PROVIDER = "calendar.readonly";

export const OAUTH_PROVIDER_SCOPE = "https://www.googleapis.com/auth/calendar.readonly";

export const oauthHandler = googleOauthHandler;