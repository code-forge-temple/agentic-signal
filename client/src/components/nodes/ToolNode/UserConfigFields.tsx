/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {Box, FormControlLabel, Switch} from "@mui/material";
import {DebouncedTextField} from "../../DebouncedTextField";

type UserConfigSchema = {
    [key: string]: {
        type?: string;
        description?: string;
        minimum?: number;
        maximum?: number;
        default?: any;
        required?: boolean;
        [key: string]: any;
    } | undefined;
};

type UserConfigFieldsProps = {
    userConfigSchema?: UserConfigSchema;
    userConfig: Record<string, any>;
    onConfigChange: (key: string, value: string|number|boolean) => void;
};

export function UserConfigFields ({userConfigSchema, userConfig, onConfigChange}: UserConfigFieldsProps) {
    if (!userConfigSchema) {
        return null;
    }

    return (
        <Box sx={{mb: 2}}>
            {Object.entries(userConfigSchema).map(([key, schema]) => {
                if (!schema) return null;

                const value = userConfig?.[key] ?? schema.default ?? "";
                const type = schema.type || "string";
                const isRequired = schema.required || false;
                const fieldLabel = `${schema.description || key}${isRequired ? ' *' : ''}`;

                // oauth fields require tool-specific renderConfig — skip here
                if (type === "oauth") {
                    return null;
                }

                if (type === "boolean") {
                    return (
                        <FormControlLabel
                            key={key}
                            control={
                                <Switch
                                    checked={!!value}
                                    onChange={e => onConfigChange(key, e.target.checked)}
                                />
                            }
                            label={fieldLabel}
                            sx={{mb: 1}}
                        />
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