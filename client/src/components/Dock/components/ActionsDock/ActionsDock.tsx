/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import React, {useEffect, useRef, useState} from "react";
import "./ActionsDock.scss";
import {Button, ThemeProvider} from "@mui/material";
import {darkTheme} from "../../../../utils";
import {BinFull, FloppyDisk, FolderPlus, Import, Settings as SettingsIcon, HelpCircle as Docs, OffTag} from "iconoir-react";
import {BaseDialog} from "../../../BaseDialog";
import {ConfirmDialog} from "../../../ConfirmDialog";
import {DockItem} from "../DockItem";
import {Settings} from "./components/Settings";
import {isTauri} from "../../../../utils";
import {clearPersistedGlobalData} from "../../../../stores/globalConfig";
import {AI_LAYER_READ_ONLY_HINT} from "../../../../context/LayersContextBase";
import {useSnackbar} from "notistack";
import {useSettings} from "../../../../hooks/useSettings";
import {workflowsFolderPath} from "../../../../services/workflowsService";
import {openWorkflowFileNatively} from "./nativeWorkflowFile";
import {VAULT_STORAGE_KEY} from "../../../../services/vault/vault";


// Set just before Clear App Data reloads the page, so the Settings dialog comes back open.
// sessionStorage survives a reload of the same tab; the flag is consumed on the next mount.
const REOPEN_SETTINGS_FLAG = "agentic-signal.reopenSettings";

type WorkflowActionsProps = {
    readOnly: boolean;
    onSave: () => void;
    onSaveToFolder: () => void;
    onClear: () => void;
    /** The browser's file picker chose a file. */
    onLoad: (event: React.ChangeEvent<HTMLInputElement>) => void;
    /** The desktop app's own dialog chose a file: its JSON and name. */
    onLoadWorkflow: (json: string, fileName: string) => void;
};

export function ActionsDock ({readOnly, onSave, onSaveToFolder, onLoad, onLoadWorkflow, onClear}: WorkflowActionsProps) {
    const readOnlyReason = readOnly ? AI_LAYER_READ_ONLY_HINT : undefined;
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [openSettings, setOpenSettings] = useState(false);
    const [openClearAppData, setOpenClearAppData] = useState(false);
    const {settings} = useSettings();
    const {enqueueSnackbar} = useSnackbar();

    // The desktop app's own dialog opens in the workflows folder; the browser's can't be pointed at a folder
    // (it reopens wherever a file was last picked).
    const handleLoadClick = () => {
        if (!isTauri()) {
            fileInputRef.current?.click();

            return;
        }

        void (async () => {
            try {
                const folder = await workflowsFolderPath(settings.workflowsFolder).catch(() => undefined);
                const picked = await openWorkflowFileNatively(folder);

                if (picked !== null) onLoadWorkflow(picked.json, picked.fileName);
            } catch (error) {
                enqueueSnackbar(`Couldn't open the workflow: ${error instanceof Error ? error.message : String(error)}`, {variant: "error"});
            }
        })();
    };

    useEffect(() => {
        if (sessionStorage.getItem(REOPEN_SETTINGS_FLAG)) {
            sessionStorage.removeItem(REOPEN_SETTINGS_FLAG);
            setOpenSettings(true);
        }
    }, []);

    const handleOpenDocs = async () => {
        const url = "https://agentic-signal.com";

        if (isTauri()) {
            try {
                const shell = await import("@tauri-apps/plugin-shell");

                await shell.open(url);
            } catch (error) {
                console.error("Failed to open URL with Tauri:", error);
            }
        } else {
            window.open(url, "_blank", "noopener,noreferrer");
        }
    };

    const handleCloseApp = async () => {
        if (isTauri()) {
            try {
                const {invoke} = await import('@tauri-apps/api/core');

                await invoke('kill_backend_process');

                const {Window} = await import('@tauri-apps/api/window');

                await Window.getCurrent().close();
            } catch { /* empty */ }
        }
    };

    const handleClearAppData = () => {
        clearPersistedGlobalData();
        // Written straight to localStorage by SettingsContext, outside the global store's prefix.
        localStorage.removeItem("ollamaHost");
        localStorage.removeItem("browserPath");
        localStorage.removeItem("workflowsFolder");
        // The vault is an entry of its own, apart from the global store's keys.
        localStorage.removeItem(VAULT_STORAGE_KEY);
        sessionStorage.setItem(REOPEN_SETTINGS_FLAG, "1");
        // Reload so every in-memory copy (settings, global store, API keys) starts from empty.
        window.location.reload();
    };

    return (
        <ThemeProvider theme={darkTheme}>
            <div className="actions-dock">
                <div className="dock-items">
                    <DockItem title="Settings" icon={<SettingsIcon />} onClick={() => setOpenSettings(true)} />
                    <BaseDialog
                        open={openSettings}
                        onClose={() => setOpenSettings(false)}
                        title="Application Settings"
                        compactTop
                        actions={
                            <>
                                <Button color="error" onClick={() => setOpenClearAppData(true)} sx={{mr: "auto"}}>
                                    Clear App Data
                                </Button>
                                <Button autoFocus onClick={() => setOpenSettings(false)}>
                                    Close
                                </Button>
                            </>
                        }
                    >
                        <Settings />
                    </BaseDialog>
                    <ConfirmDialog
                        open={openClearAppData}
                        onClose={() => setOpenClearAppData(false)}
                        title="Clear App Data"
                        // eslint-disable-next-line max-len
                        message="This removes all saved settings (Ollama host, browser path, workflows folder, AI Assistant model and chat settings) and the vault with your saved credentials and outside connections, then reloads the app. Any unsaved workflow on the canvas will be lost. Workflows already saved to the folder stay."
                        confirmLabel="Clear and Reload"
                        maximizable={false}
                        onConfirm={handleClearAppData}
                    />
                    {isTauri() && <DockItem title="Close App" icon={<OffTag />} onClick={() => void handleCloseApp()} />}
                    <DockItem title="Open Documentation" icon={<Docs />} onClick={() => void handleOpenDocs()} />
                    {/* Saving works on the AI Buddy layer too: that's how a command's workflow (say, the built-in
                        research) becomes the user's own, to change and save back over it.
                        The desktop app saves to the workflows folder (a download would only land in Downloads),
                        so it has the one button; the browser downloads, or saves to the folder separately.
                        Saved workflows with a Workflow Input become the chat's commands. */}
                    <DockItem title="Save Workflow" icon={<FloppyDisk />} onClick={isTauri() ? onSaveToFolder : onSave} />
                    {!isTauri() && <DockItem title="Save to Workflows Folder" icon={<FolderPlus />} onClick={onSaveToFolder} />}
                    <DockItem title="Clear Workflow" icon={<BinFull />} onClick={onClear} disabledReason={readOnlyReason} />
                    <DockItem title="Load Workflow" icon={<Import />} onClick={handleLoadClick} disabledReason={readOnlyReason} />
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="application/json"
                        style={{display: "none"}}
                        onChange={onLoad}
                    />
                </div>
            </div>
        </ThemeProvider>
    );
}