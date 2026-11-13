/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {FormEvent, useEffect, useState} from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import {BaseDialog} from "../BaseDialog";
import {ConfirmDialog} from "../ConfirmDialog";
import {dismissVaultPrompt, resetVault, unlockVault, useVaultStore, VaultPrompt, VaultPurpose} from "../../stores/vault";
import {WrongPasswordError} from "../../services/vault/crypto";
import {MIN_PASSWORD_LENGTH} from "../../services/vault/vault";
import {createVaultKeepingSaved} from "../../services/vault/migration";
import {VAULT_RESET_MESSAGE} from "./constants";
import {errorMessage} from "@shared/utils";


const TITLES: Record<VaultPrompt, string> = {
    create: "Create a Vault Password",
    unlock: "Unlock the Vault",
};

// The first sentence says why the popup appeared, when a save opened it.
const CREATE_REASONS: Record<VaultPurpose, string> = {
    credential: "Before the credential is saved, you need to create a vault password. ",
    connection: "Before the outside connection is saved, you need to create a vault password. ",
};

const INTROS: Record<VaultPrompt, string> = {
    create: "Saved credentials and outside connections' tokens are encrypted with this password. It's never stored and can't be recovered: "
        + "if you forget it, the vault has to be reset and its contents entered again.",
    unlock: "Your saved credentials and outside connections' tokens are encrypted. Enter your vault password to use them until the app reloads.",
};

/**
 * The vault's password popup, mounted once for the app. It asks for a new password when the first secret is saved, and
 * for the password at startup or when a locked vault is needed.
 */
export function VaultDialog () {
    const prompt = useVaultStore(state => state.prompt);
    const purpose = useVaultStore(state => state.purpose);
    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [confirmReset, setConfirmReset] = useState(false);
    const creating = prompt === "create";

    // Each time it opens, it starts empty.
    useEffect(() => {
        setPassword("");
        setConfirm("");
        setError(null);
        setBusy(false);
    }, [prompt]);

    const submit = async () => {
        if (creating && password.length < MIN_PASSWORD_LENGTH) {
            setError(`Use at least ${MIN_PASSWORD_LENGTH} characters.`);

            return;
        }

        if (creating && password !== confirm) {
            setError("The two passwords don't match.");

            return;
        }

        setBusy(true);
        setError(null);

        try {
            if (creating) await createVaultKeepingSaved(password);
            else await unlockVault(password);
        } catch (err) {
            setError(err instanceof WrongPasswordError ? "Wrong password." : `Couldn't open the vault: ${errorMessage(err)}`);
            setBusy(false);
        }
    };

    const handleSubmit = (event: FormEvent) => {
        event.preventDefault();
        void submit();
    };

    // Not while the vault is being made or opened: whoever asked for it would hear "no" while it opens after all.
    const handleClose = () => {
        if (!busy) dismissVaultPrompt();
    };

    return (
        <>
            <BaseDialog
                open={prompt !== null}
                onClose={handleClose}
                title={prompt ? TITLES[prompt] : ""}
                width={480}
                maximizable={false}
                actions={
                    <>
                        {!creating && (
                            <Button color="error" onClick={() => setConfirmReset(true)} disabled={busy} sx={{mr: "auto"}}>
                                Forgot password?
                            </Button>
                        )}
                        <Button onClick={dismissVaultPrompt} disabled={busy}>{creating ? "Cancel" : "Not now"}</Button>
                        <Button type="submit" form="vault-password-form" variant="contained" disabled={busy || password === ""}>
                            {busy ? <CircularProgress size={20} /> : creating ? "Create" : "Unlock"}
                        </Button>
                    </>
                }
            >
                <Box component="form" id="vault-password-form" onSubmit={handleSubmit} sx={{display: "flex", flexDirection: "column", gap: 2, pt: 1}}>
                    <Typography variant="body2" color="text.secondary">{creating && purpose ? CREATE_REASONS[purpose] : ""}{prompt ? INTROS[prompt] : ""}</Typography>
                    <TextField
                        label={creating ? "New password" : "Password"}
                        type="password"
                        autoComplete={creating ? "new-password" : "current-password"}
                        value={password}
                        onChange={event => setPassword(event.target.value)}
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
                            onChange={event => setConfirm(event.target.value)}
                            disabled={busy}
                            fullWidth
                        />
                    )}
                    {error && <Typography variant="body2" color="error">{error}</Typography>}
                </Box>
            </BaseDialog>
            <ConfirmDialog
                open={confirmReset}
                onClose={() => setConfirmReset(false)}
                title="Reset the Vault"
                message={VAULT_RESET_MESSAGE}
                confirmLabel="Reset"
                maximizable={false}
                onConfirm={resetVault}
            />
        </>
    );
}
