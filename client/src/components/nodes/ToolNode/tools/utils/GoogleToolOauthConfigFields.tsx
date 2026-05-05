/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {Box, Button, Chip, Typography} from "@mui/material";
import {useGlobalConfig} from "../../../../../stores/globalConfig";
import {globalToolProp} from "./utils";
import {DebouncedTextField} from "../../../../DebouncedTextField";
import {FieldsetGroup} from "../../../../FieldsetGroup";


const GOOGLE_CLIENT_ID_KEY = 'googleClientId';
const ACCESS_TOKEN_KEY = 'accessToken';

type GoogleToolConfigFieldsProps = {
    toolSubtype: string;
    scope: string;
    provider: string;
    oauthHandler: (params: {
        clientId: string;
        scope: string;
        onConfigChange: (key: string, value: string) => void;
    }) => void;
    description?: string;
    required?: boolean;
    userConfig: Record<string, any>;
    onConfigChange: (key: string, value: string | number | boolean) => void;
};

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
    const {globalData, setGlobalData} = useGlobalConfig();
    const googleClientId = globalData[GOOGLE_CLIENT_ID_KEY] || userConfig[GOOGLE_CLIENT_ID_KEY] || '';
    const GLOBAL_ACCESS_TOKEN_KEY = globalToolProp(toolSubtype, ACCESS_TOKEN_KEY);
    const isConnected = !!(globalData[GLOBAL_ACCESS_TOKEN_KEY]?.length);

    return (
        <Box>
            <DebouncedTextField
                label="Google OAuth2 Client ID"
                value={googleClientId}
                onChange={(newValue) => {
                    setGlobalData(GOOGLE_CLIENT_ID_KEY, newValue);
                    onConfigChange(GOOGLE_CLIENT_ID_KEY, newValue);
                }}
                fullWidth
                sx={{mb: 1}}
            />
            <FieldsetGroup title="OAuth Settings">
                <Box sx={{mb: 2}}>
                    <Typography variant="body2" sx={{mb: 1}}>
                        {description || `${provider} Authentication`}
                    </Typography>
                    <Box sx={{display: 'flex', alignItems: 'center', gap: 1, mb: 1}}>
                        <Button
                            variant={isConnected ? "outlined" : "contained"}
                            color={isConnected ? "success" : "primary"}
                            onClick={() => {
                                oauthHandler({
                                    clientId: googleClientId,
                                    scope,
                                    onConfigChange: (key, value) => {
                                        onConfigChange(key, value);

                                        if (key === ACCESS_TOKEN_KEY) {
                                            setGlobalData(GLOBAL_ACCESS_TOKEN_KEY, value);
                                        }
                                    },
                                });
                            }}
                            size="small"
                        >
                            {isConnected ? 'Reconnect' : 'Connect'} {provider}
                        </Button>
                        {isConnected && (
                            <Chip
                                label="Connected"
                                color="success"
                                size="small"
                                onDelete={() => {
                                    onConfigChange(ACCESS_TOKEN_KEY, '');
                                    setGlobalData(GLOBAL_ACCESS_TOKEN_KEY, '');
                                }}
                            />
                        )}
                    </Box>
                    <DebouncedTextField
                        label={`Access Token (Manual)${required ? ' *' : ''}`}
                        value={globalData[GLOBAL_ACCESS_TOKEN_KEY] || ''}
                        onChange={(value) => {
                            onConfigChange(ACCESS_TOKEN_KEY, value);
                            setGlobalData(GLOBAL_ACCESS_TOKEN_KEY, value);
                        }}
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
