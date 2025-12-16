import {googleOauthHandler} from "../utils/oauth";

export const OAUTH_PROVIDER = "drive.readonly";

export const OAUTH_PROVIDER_SCOPE = "https://www.googleapis.com/auth/drive.readonly";

export const oauthHandler = googleOauthHandler;