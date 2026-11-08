/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {FormEvent, useState} from "react";
import {Box, Button, CircularProgress, TextField, Typography} from "@mui/material";
import {useSnackbar} from "notistack";
import {BaseDialog} from "../../../../../../BaseDialog";
import {ConfirmDialog} from "../../../../../../ConfirmDialog";
import {VAULT_RESET_MESSAGE} from "../../../../../../VaultDialog";
import {useCommandConnections} from "../../../../../../../hooks/useCommandConnections";
import {changeVaultPassword, lockVault, requestVaultAccess, resetVault, useVaultStore} from "../../../../../../../stores/vault";
import {WrongPasswordError} from "../../../../../../../services/vault/crypto";
import {MIN_PASSWORD_LENGTH} from "../../../../../../../services/vault/vault";


const plural = (count: number, one: string) => `${count} ${one}${count === 1 ? "" : "s"}`;

function ChangePasswordDialog ({open, onClose}: {open: boolean; onClose: () => void}) {
    const {enqueueSnackbar} = useSnackbar();
    const [current, setCurrent] = useState("");
    const [next, setNext] = useState("");
    const [confirm, setConfirm] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const close = () => {
        setCurrent("");
        setNext("");
        setConfirm("");
        setError(null);
        onClose();
    };

    const submit = async () => {
        if (next.length < MIN_PASSWORD_LENGTH) return setError(`Use at least ${MIN_PASSWORD_LENGTH} characters.`);

        if (next !== confirm) return setError("The two new passwords don't match.");

        setBusy(true);
        setError(null);

        try {
            await changeVaultPassword(current, next);
            enqueueSnackbar("Vault password changed.", {variant: "success"});
            close();
        } catch (err) {
            setError(err instanceof WrongPasswordError ? "The current password is wrong." : `Couldn't change it: ${err instanceof Error ? err.message : String(err)}`);
        } finally {
            setBusy(false);
        }
    };

    const handleSubmit = (event: FormEvent) => {
        event.preventDefault();
        void submit();
    };

    return (
        <BaseDialog
            open={open}
            onClose={close}
            title="Change the Vault Password"
            width={480}
            maximizable={false}
            actions={
                <>
                    <Button onClick={close} disabled={busy}>Cancel</Button>
                    <Button type="submit" form="vault-change-password-form" variant="contained" disabled={busy || !current || !next}>
                        {busy ? <CircularProgress size={20} /> : "Change"}
                    </Button>
                </>
            }
        >
            <Box component="form" id="vault-change-password-form" onSubmit={handleSubmit} sx={{display: "flex", flexDirection: "column", gap: 2, pt: 1}}>
                <TextField
                    label="Current password"
                    type="password"
                    autoComplete="current-password"
                    value={current}
                    onChange={event => setCurrent(event.target.value)}
                    disabled={busy}
                    autoFocus
                    fullWidth
                />
                <TextField
                    label="New password"
                    type="password"
                    autoComplete="new-password"
                    value={next}
                    onChange={event => setNext(event.target.value)}
                    disabled={busy}
                    fullWidth
                    helperText={`At least ${MIN_PASSWORD_LENGTH} characters.`}
                />
                <TextField
                    label="Repeat the new password"
                    type="password"
                    autoComplete="new-password"
                    value={confirm}
                    onChange={event => setConfirm(event.target.value)}
                    disabled={busy}
                    fullWidth
                />
                {error && <Typography variant="body2" color="error">{error}</Typography>}
            </Box>
        </BaseDialog>
    );
}

/* The vault: where saved credentials and outside connections' tokens are kept, encrypted with the user's password. */
export function Vault () {
    const file = useVaultStore(state => state.file);
    const unlocked = useVaultStore(state => state.key !== null);
    const {connections} = useCommandConnections();
    const [changingPassword, setChangingPassword] = useState(false);
    const [confirmReset, setConfirmReset] = useState(false);

    const status = file === null
        ? "No vault yet. It's created, with a password you choose, when you first save a credential or add an outside connection."
        : unlocked
            ? "Unlocked until the app reloads."
            : "Locked. Nodes can't use your saved credentials, and tokens can't be copied, until you unlock. Outside calls keep working.";

    return (
        <Box sx={{display: "flex", flexDirection: "column", gap: 2, mt: 2}}>
            <Typography variant="body1">{status}</Typography>
            {file !== null && (
                <Typography variant="body2" color="text.secondary">
                    It holds {plural(file.credentialKeys.length, "saved credential")} and the tokens of {plural(connections.length, "outside connection")}.
                </Typography>
            )}
            {file !== null && (
                <Box sx={{display: "flex", gap: 1, flexWrap: "wrap"}}>
                    {unlocked
                        ? <Button variant="outlined" onClick={lockVault}>Lock Now</Button>
                        : <Button variant="contained" onClick={() => void requestVaultAccess()}>Unlock</Button>}
                    <Button variant="outlined" onClick={() => setChangingPassword(true)}>Change Password</Button>
                    <Button variant="outlined" color="error" onClick={() => setConfirmReset(true)}>Reset Vault</Button>
                </Box>
            )}
            <Typography variant="caption" color="text.secondary">
                Encrypted with AES-256, using a key made from your password (PBKDF2-SHA256, 600,000 rounds). The password is never stored and
                can&apos;t be recovered: if you forget it, Reset Vault deletes the saved credentials and outside connections, so you can start again.
            </Typography>
            <ChangePasswordDialog open={changingPassword} onClose={() => setChangingPassword(false)} />
            <ConfirmDialog
                open={confirmReset}
                onClose={() => setConfirmReset(false)}
                title="Reset the Vault"
                message={VAULT_RESET_MESSAGE}
                confirmLabel="Reset"
                maximizable={false}
                onConfirm={resetVault}
            />
        </Box>
    );
}
