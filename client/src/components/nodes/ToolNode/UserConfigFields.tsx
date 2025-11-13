/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {Box, Typography, Button, Chip} from "@mui/material";
import {PROVIDER_SCOPES, PROVIDERS} from "../../../constants";
import {FieldsetGroup} from "../../FieldsetGroup";
import {DebouncedTextField} from "../../DebouncedTextField";
import {isTauri} from "../../../utils";


const AUTHENTICATION_CANCELED = 'Authentication cancelled';

const showTauriError = (error: unknown) => {
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (!errorMessage.includes(AUTHENTICATION_CANCELED)) {
        alert(`OAuth failed: ${errorMessage}`);
    }
};

type UserConfigSchema = {
    [key: string]: {
        type?: string;
        description?: string;
        minimum?: number;
        maximum?: number;
        default?: any;
        required?: boolean;
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

                const isTauriEnv = isTauri();

                if (isTauriEnv) {
                    try {
                        const scope = PROVIDER_SCOPES[provider];
                        const {invoke} = await import('@tauri-apps/api/core');
                        const result = await invoke<{accessToken: string}>('start_oauth_flow', {
                            clientId: googleClientId,
                            scope: scope
                        });

                        if (result && result.accessToken) {
                            onConfigChange('accessToken', result.accessToken);
                        } else {
                            alert('OAuth failed: No access token received');
                        }
                    } catch (error) {
                        showTauriError(error);
                    }
                } else {
                    // Web environment - use Google's popup
                    if (!window.google) {
                        alert('Google Identity Services not loaded. Please refresh the page.');

                        return;
                    }

                    const tokenClient = window.google.accounts.oauth2.initTokenClient({
                        client_id: googleClientId,
                        scope: PROVIDER_SCOPES[provider],
                        callback: (response: { access_token: string; error?: string }) => {
                            if (response.access_token) {
                                onConfigChange('accessToken', response.access_token);
                            } else {
                                alert(`OAuth authentication failed: ${response.error || 'Unknown error'}`);
                            }
                        }
                    });

                    tokenClient.requestAccessToken();
                }
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
                const isRequired = schema.required || false;
                const fieldLabel = `${schema.description || key}${isRequired ? ' *' : ''}`;

                if (type === "oauth") {
                    const isConnected = userConfig?.accessToken && userConfig.accessToken.length > 0;

                    return (
                        <FieldsetGroup key={key} title="OAuth Settings">
                            <Box key={key} sx={{mb: 2}}>
                                <Typography variant="body2" sx={{mb: 1}}>
                                    {schema.description || `${schema.provider || 'OAuth'} Authentication`}
                                </Typography>
                                <Box sx={{display: 'flex', alignItems: 'center', gap: 1, mb: 1}}>
                                    <Button
                                        variant={isConnected ? "outlined" : "contained"}
                                        color={isConnected ? "success" : "primary"}
                                        onClick={() => {
                                            handleOAuthLogin(schema.provider || 'gmail');
                                        }}
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
                                <DebouncedTextField
                                    label={`Access Token (Manual)${isRequired ? ' *' : ''}`}
                                    value={userConfig?.accessToken || ""}
                                    onChange={value => onConfigChange('accessToken', value)}
                                    fullWidth
                                    size="small"
                                    sx={{mt: 1}}
                                    type="password"
                                    helperText="Or paste your OAuth2 access token manually"
                                />
                            </Box>
                        </FieldsetGroup>
                    );
                }

                if (type === "integer" || type === "number") {
                    return (
                        <DebouncedTextField
                            key={key}
                            label={fieldLabel}
                            type="number"
                            value={value}
                            onChange={value => {
                                let newValue = Number(value || 0);

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
                    <DebouncedTextField
                        key={key}
                        label={fieldLabel}
                        value={value}
                        onChange={value => onConfigChange(key, value)}
                        fullWidth
                        sx={{mb: 1}}
                        type={key.toLowerCase().includes('token') || key.toLowerCase().includes('key') ? 'password' : 'text'}
                    />
                );
            })}
        </Box>
    );
}