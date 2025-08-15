/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {TextField, Box, Typography, Button, Chip} from "@mui/material";
import {PROVIDER_SCOPES, PROVIDERS} from "../../../constants";

declare global {
    interface Window {
        google?: any;
    }
}

type UserConfigSchema = {
    [key: string]: {
        type?: string;
        description?: string;
        minimum?: number;
        maximum?: number;
        default?: any;
        provider?: string;
    } | undefined;
};

type UserConfigFieldsProps = {
    userConfigSchema?: UserConfigSchema;
    userConfig: Record<string, any>;
    onConfigChange: (key: string, value: string|number) => void;
};

export function UserConfigFields ({userConfigSchema, userConfig, onConfigChange}: UserConfigFieldsProps) {
    if (!userConfigSchema) {
        return null;
    }

    const handleOAuthLogin = async (provider: string) => {
        try {
            if (provider === PROVIDERS.GMAIL || provider === PROVIDERS.DRIVE || provider === PROVIDERS.CALENDAR) {
                const googleClientId = userConfig?.googleClientId;

                if (!googleClientId) {
                    alert('Please provide your Google Client ID first in the configuration above.');

                    return;
                }

                if (!window.google) {
                    alert('Google Identity Services not loaded. Please refresh the page.');

                    return;
                }

                const tokenClient = window.google.accounts.oauth2.initTokenClient({
                    client_id: googleClientId,
                    scope: PROVIDER_SCOPES[provider],
                    callback: (response: { access_token: string; }) => {
                        if (response.access_token) {
                            onConfigChange('accessToken', response.access_token);
                        } else {
                            alert('OAuth authentication failed');
                        }
                    }
                });

                tokenClient.requestAccessToken();
            }
        } catch (error) {
            alert(`OAuth failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    };

    return (
        <Box sx={{mb: 2}}>
            {Object.entries(userConfigSchema).map(([key, schema]) => {
                if (!schema) return null;

                const value = userConfig?.[key] ?? "";
                const type = schema.type || "string";

                if (type === "oauth") {
                    const isConnected = userConfig?.accessToken && userConfig.accessToken.length > 0;

                    return (
                        <Box key={key} sx={{mb: 2}}>
                            <Typography variant="body2" sx={{mb: 1}}>
                                {schema.description || `${schema.provider || 'OAuth'} Authentication`}
                            </Typography>
                            <Box sx={{display: 'flex', alignItems: 'center', gap: 1}}>
                                <Button
                                    variant={isConnected ? "outlined" : "contained"}
                                    color={isConnected ? "success" : "primary"}
                                    onClick={() => handleOAuthLogin(schema.provider || 'gmail')}
                                    size="small"
                                >
                                    {isConnected ? 'Reconnect' : 'Connect'} {schema.provider || 'Account'}
                                </Button>
                                {isConnected && (
                                    <Chip
                                        label="Connected"
                                        color="success"
                                        size="small"
                                        onDelete={() => onConfigChange('accessToken', '')}
                                    />
                                )}
                            </Box>
                            {/* Fallback: Manual token input */}
                            <TextField
                                label="Access Token (Manual)"
                                value={userConfig?.accessToken || ""}
                                onChange={e => onConfigChange('accessToken', e.target.value)}
                                fullWidth
                                size="small"
                                sx={{mt: 1}}
                                type="password"
                                helperText="Or paste your OAuth2 access token manually"
                            />
                        </Box>
                    );
                }

                if (type === "integer" || type === "number") {
                    return (
                        <TextField
                            key={key}
                            label={schema.description || key}
                            type="number"
                            value={value}
                            onChange={e => {
                                let newValue = Number(e.target.value || 0);

                                if (typeof newValue === "number") {
                                    if (schema.minimum !== undefined) newValue = Math.max(schema.minimum, newValue);

                                    if (schema.maximum !== undefined) newValue = Math.min(schema.maximum, newValue);
                                }

                                onConfigChange(key, newValue);
                            }}
                            fullWidth
                            sx={{mb: 1}}
                            slotProps={{
                                input: {
                                    inputProps: {
                                        min: schema.minimum,
                                        max: schema.maximum,
                                        step: 1
                                    }
                                }
                            }}
                        />
                    );
                }

                return (
                    <TextField
                        key={key}
                        label={schema.description || key}
                        value={value}
                        onChange={e => onConfigChange(key, e.target.value)}
                        fullWidth
                        sx={{mb: 1}}
                        type={key.toLowerCase().includes('token') || key.toLowerCase().includes('key') ? 'password' : 'text'}
                    />
                );
            })}
        </Box>
    );
}