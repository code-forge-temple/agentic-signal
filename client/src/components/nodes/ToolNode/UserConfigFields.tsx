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

type FieldSchema = NonNullable<UserConfigSchema[string]>;

type FieldProps = {
    fieldKey: string;
    schema: FieldSchema;
    label: string;
    /** The saved value, else the schema's default, else "". */
    value: unknown;
    onConfigChange: UserConfigFieldsProps["onConfigChange"];
};

/** The field's description (or its key), starred when it's required. */
const fieldLabel = (key: string, {description, required}: FieldSchema) => `${description || key}${required ? ' *' : ''}`;

/** The value as a text field shows it: numbers as they are, anything else as text. */
const textValue = (value: unknown) => (typeof value === "number" ? value : String(value));

/** Keys and tokens are typed as passwords. */
const isSecretField = (key: string) => key.toLowerCase().includes('token') || key.toLowerCase().includes('key');

/** The typed number kept within the schema's minimum and maximum; null when the text isn't a number, as in a cleared field. */
function clampedNumber (typed: string, {minimum, maximum}: FieldSchema): number | null {
    let value = Number(typed);

    if (typed.trim() === "" || Number.isNaN(value)) return null;

    if (minimum !== undefined) value = Math.max(minimum, value);

    if (maximum !== undefined) value = Math.min(maximum, value);

    return value;
}

function BooleanField ({fieldKey, label, value, onConfigChange}: FieldProps) {
    return (
        <FormControlLabel
            control={
                <Switch
                    checked={!!value}
                    onChange={e => onConfigChange(fieldKey, e.target.checked)}
                />
            }
            label={label}
            sx={{mb: 1}}
        />
    );
}

function NumberField ({fieldKey, schema, label, value, onConfigChange}: FieldProps) {
    return (
        <DebouncedTextField
            label={label}
            type="number"
            value={textValue(value)}
            onChange={typed => {
                const saved = clampedNumber(typed, schema);

                // A cleared field saves nothing (the setting keeps its value until a number is typed), as saveCountWithin does.
                if (saved === null) return undefined;

                onConfigChange(fieldKey, saved);

                // Shown in place of what was typed when they differ (42 typed, 10 the maximum saved).
                return String(saved);
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

function TextConfigField ({fieldKey, label, value, onConfigChange}: FieldProps) {
    return (
        <DebouncedTextField
            label={label}
            value={textValue(value)}
            onChange={typed => onConfigChange(fieldKey, typed)}
            fullWidth
            sx={{mb: 1}}
            type={isSecretField(fieldKey) ? 'password' : 'text'}
        />
    );
}

type UserConfigFieldProps = Omit<FieldProps, "label" | "value"> & {userConfig: UserConfigFieldsProps["userConfig"]};

/** The input for one setting, by its type; none for oauth settings, which need the tool's own renderConfig. */
function UserConfigField ({fieldKey, schema, userConfig, onConfigChange}: UserConfigFieldProps) {
    const type = schema.type || "string";

    if (type === "oauth") return null;

    const value: unknown = userConfig?.[fieldKey] ?? schema.default ?? "";
    const field = {fieldKey, schema, label: fieldLabel(fieldKey, schema), value, onConfigChange};

    if (type === "boolean") return <BooleanField {...field} />;

    if (type === "integer" || type === "number") return <NumberField {...field} />;

    return <TextConfigField {...field} />;
}

export function UserConfigFields ({userConfigSchema, userConfig, onConfigChange}: UserConfigFieldsProps) {
    if (!userConfigSchema) {
        return null;
    }

    return (
        <Box sx={{mb: 2}}>
            {Object.entries(userConfigSchema).map(([key, schema]) => schema && (
                <UserConfigField key={key} fieldKey={key} schema={schema} userConfig={userConfig} onConfigChange={onConfigChange} />
            ))}
        </Box>
    );
}