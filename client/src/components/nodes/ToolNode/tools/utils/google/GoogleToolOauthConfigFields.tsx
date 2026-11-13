/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Typography from "@mui/material/Typography";
import {useGlobalConfig} from "../../../../../../stores/globalConfig";
import {globalToolProp} from "../utils";
import {ACCESS_TOKEN_KEY, GOOGLE_CLIENT_ID_KEY} from "./oauth";
import {DebouncedTextField} from "../../../../../DebouncedTextField";
import {FieldsetGroup} from "../../../../../FieldsetGroup";


type UserConfig = Record<string, string | undefined>;
type OnConfigChange = (key: string, value: string | number | boolean) => void;

type GoogleToolConfigFieldsProps = {
    toolSubtype: string;
    scope: string;
    provider: string;
    oauthHandler: (params: {
        clientId: string;
        scope: string;
        onConfigChange: (key: string, value: string) => void;
    }) => void | Promise<void>;
    description?: string;
    required?: boolean;
    userConfig: UserConfig;
    onConfigChange: OnConfigChange;
};

/**
 * The Client ID and the access token the settings show, and their setters, which write the node's own value and the
 * shared one: the Client ID is shared by every Google tool, the token by every node of the tool's kind.
 */
function useGoogleCredentials (toolSubtype: string, userConfig: UserConfig, onConfigChange: OnConfigChange) {
    const {globalData, setGlobalData} = useGlobalConfig();
    const globalTokenKey = globalToolProp(toolSubtype, ACCESS_TOKEN_KEY);

    return {
        // An empty shared value counts: it was cleared, for every node (ToolNode runs with it the same way).
        clientId: globalData[GOOGLE_CLIENT_ID_KEY] ?? userConfig[GOOGLE_CLIENT_ID_KEY] ?? '',
        accessToken: globalData[globalTokenKey] ?? userConfig[ACCESS_TOKEN_KEY] ?? '',
        setClientId: (value: string) => {
            setGlobalData(GOOGLE_CLIENT_ID_KEY, value);
            onConfigChange(GOOGLE_CLIENT_ID_KEY, value);
        },
        setAccessToken: (value: string) => {
            onConfigChange(ACCESS_TOKEN_KEY, value);
            setGlobalData(globalTokenKey, value);
        },
    };
}

type ConnectionProps = {
    provider: string;
    isConnected: boolean;
    onConnect: () => void;
    onDisconnect: () => void;
};

function Connection ({provider, isConnected, onConnect, onDisconnect}: ConnectionProps) {
    return (
        <Box sx={{display: 'flex', alignItems: 'center', gap: 1, mb: 1}}>
            <Button
                variant={isConnected ? "outlined" : "contained"}
                color={isConnected ? "success" : "primary"}
                onClick={onConnect}
                size="small"
            >
                {isConnected ? 'Reconnect' : 'Connect'} {provider}
            </Button>
            {isConnected && (
                <Chip
                    label="Connected"
                    color="success"
                    size="small"
                    onDelete={onDisconnect}
                />
            )}
        </Box>
    );
}

export function GoogleToolOauthConfigFields ({
    toolSubtype,
    scope,
    provider,
    oauthHandler,
    description,
    required = true,
    userConfig,
    onConfigChange,
}: GoogleToolConfigFieldsProps) {
    const {clientId, accessToken, setClientId, setAccessToken} = useGoogleCredentials(toolSubtype, userConfig, onConfigChange);

    const connect = () => {
        void oauthHandler({
            clientId,
            scope,
            onConfigChange: (key, value) => {
                if (key === ACCESS_TOKEN_KEY) setAccessToken(value);
                else onConfigChange(key, value);
            },
        });
    };

    return (
        <Box>
            <DebouncedTextField
                label="Google OAuth2 Client ID"
                value={clientId}
                onChange={setClientId}
                fullWidth
                sx={{mb: 1}}
            />
            <FieldsetGroup title="OAuth Settings">
                <Box sx={{mb: 2}}>
                    <Typography variant="body2" sx={{mb: 1}}>
                        {description || `${provider} Authentication`}
                    </Typography>
                    <Connection
                        provider={provider}
                        isConnected={!!accessToken.length}
                        onConnect={connect}
                        onDisconnect={() => setAccessToken('')}
                    />
                    <DebouncedTextField
                        label={`Access Token (Manual)${required ? ' *' : ''}`}
                        value={accessToken}
                        onChange={setAccessToken}
                        fullWidth
                        size="small"
                        sx={{mt: 1}}
                        type="password"
                        helperText="Or paste your OAuth2 access token manually"
                    />
                </Box>
            </FieldsetGroup>
        </Box>
    );
}
