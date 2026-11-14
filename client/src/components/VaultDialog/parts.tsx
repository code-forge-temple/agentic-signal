/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {FormEvent} from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import {dismissVaultPrompt} from "../../stores/vault";
import {MIN_PASSWORD_LENGTH} from "../../services/vault/vault";


type VaultActionsProps = {
    creating: boolean;
    busy: boolean;
    password: string;
    onForgot: () => void;
};

/** The popup's buttons: Forgot password? when unlocking, dismiss, and Create or Unlock (a spinner while it works). */
export function VaultActions ({creating, busy, password, onForgot}: VaultActionsProps) {
    return (
        <>
            {!creating && (
                <Button color="error" onClick={onForgot} disabled={busy} sx={{mr: "auto"}}>
                    Forgot password?
                </Button>
            )}
            <Button onClick={dismissVaultPrompt} disabled={busy}>{creating ? "Cancel" : "Not now"}</Button>
            <Button type="submit" form="vault-password-form" variant="contained" disabled={busy || password === ""}>
                {busy ? <CircularProgress size={20} /> : creating ? "Create" : "Unlock"}
            </Button>
        </>
    );
}

type VaultPasswordFormProps = {
    creating: boolean;
    intro: string;
    password: string;
    confirm: string;
    error: string | null;
    busy: boolean;
    onPassword: (value: string) => void;
    onConfirm: (value: string) => void;
    onSubmit: (event: FormEvent) => void;
};

/** The password field (repeated when creating), what the password does, and why it was turned down. */
export function VaultPasswordForm ({creating, intro, password, confirm, error, busy, onPassword, onConfirm, onSubmit}: VaultPasswordFormProps) {
    return (
        <Box component="form" id="vault-password-form" onSubmit={onSubmit} sx={{display: "flex", flexDirection: "column", gap: 2, pt: 1}}>
            <Typography variant="body2" color="text.secondary">{intro}</Typography>
            <TextField
                label={creating ? "New password" : "Password"}
                type="password"
                autoComplete={creating ? "new-password" : "current-password"}
                value={password}
                onChange={event => onPassword(event.target.value)}
                disabled={busy}
                autoFocus
                fullWidth
                error={error !== null && !creating}
                helperText={creating ? `At least ${MIN_PASSWORD_LENGTH} characters.` : undefined}
            />
            {creating && (
                <TextField
                    label="Repeat the password"
                    type="password"
                    autoComplete="new-password"
                    value={confirm}
                    onChange={event => onConfirm(event.target.value)}
                    disabled={busy}
                    fullWidth
                />
            )}
            {error && <Typography variant="body2" color="error">{error}</Typography>}
        </Box>
    );
}
