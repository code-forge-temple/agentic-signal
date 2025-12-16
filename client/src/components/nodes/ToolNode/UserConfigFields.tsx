/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {Box, Typography, Button, Chip} from "@mui/material";
import {FieldsetGroup} from "../../FieldsetGroup";
import {DebouncedTextField} from "../../DebouncedTextField";

type UserConfigSchema = {
    [key: string]: {
        type?: string;
        description?: string;
        minimum?: number;
        maximum?: number;
        default?: any;
        required?: boolean;
        provider?: string;
        scope?: string;
        oauthHandler?: (params: {
            clientId?: string;
            scope?: string;
            onConfigChange: (key: string, value: string) => void;
        }) => void;
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
                    const oauthHandler = schema.oauthHandler;

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
                                            if (oauthHandler) {
                                                oauthHandler({
                                                    clientId: userConfig?.googleClientId,
                                                    scope: schema.scope,
                                                    onConfigChange: (key: string, value: string) => onConfigChange(key, value)
                                                });
                                            } else {
                                                alert("No OAuth handler defined for this tool.");
                                            }
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