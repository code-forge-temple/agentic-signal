/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {FormEvent, useEffect, useState} from "react";
import {BaseDialog} from "../BaseDialog";
import {ConfirmDialog} from "../ConfirmDialog";
import {dismissVaultPrompt, resetVault, unlockVault, useVaultStore} from "../../stores/vault";
import {createVaultKeepingSaved} from "../../services/vault/migration";
import {VAULT_RESET_MESSAGE} from "./constants";
import {passwordProblem, TITLES, vaultIntro, vaultOpenError} from "./utils";
import {VaultActions, VaultPasswordForm} from "./parts";


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
        const problem = passwordProblem(creating, password, confirm);

        if (problem) {
            setError(problem);

            return;
        }

        setBusy(true);
        setError(null);

        try {
            if (creating) await createVaultKeepingSaved(password);
            else await unlockVault(password);
        } catch (err) {
            setError(vaultOpenError(err));
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
                actions={<VaultActions creating={creating} busy={busy} password={password} onForgot={() => setConfirmReset(true)} />}
            >
                <VaultPasswordForm
                    creating={creating}
                    intro={vaultIntro(prompt, purpose)}
                    password={password}
                    confirm={confirm}
                    error={error}
                    busy={busy}
                    onPassword={setPassword}
                    onConfirm={setConfirm}
                    onSubmit={handleSubmit}
                />
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
