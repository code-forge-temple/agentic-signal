/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import React, {useEffect, useRef, useState} from "react";
import "./ActionsDock.scss";
import {Button, ThemeProvider} from "@mui/material";
import {darkTheme} from "../../../../utils";
import {BinFull, FloppyDiskArrowIn, FloppyDiskArrowOut, Settings as SettingsIcon, HelpCircle as Docs, OffTag} from "iconoir-react";
import {BaseDialog} from "../../../BaseDialog";
import {ConfirmDialog} from "../../../ConfirmDialog";
import {DockItem} from "../DockItem";
import {Settings} from "./components/Settings";
import {isTauri} from "../../../../utils";
import {clearPersistedGlobalData} from "../../../../stores/globalConfig";


// Set just before Clear App Data reloads the page, so the Settings dialog comes back open.
// sessionStorage survives a reload of the same tab; the flag is consumed on the next mount.
const REOPEN_SETTINGS_FLAG = "agentic-signal.reopenSettings";

type WorkflowActionsProps = {
    onSave: () => void;
    onClear: () => void;
    onLoad: (event: React.ChangeEvent<HTMLInputElement>) => void;
};

export function ActionsDock ({onSave, onLoad, onClear}: WorkflowActionsProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [openSettings, setOpenSettings] = useState(false);
    const [openClearAppData, setOpenClearAppData] = useState(false);

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
                        message="This removes all saved settings (Ollama host, browser path, AI Assistant model and chat settings) and any API keys, then reloads the app. Any unsaved workflow on the canvas will be lost."
                        confirmLabel="Clear and Reload"
                        onConfirm={handleClearAppData}
                    />
                    {isTauri() && <DockItem title="Close App" icon={<OffTag />} onClick={handleCloseApp} />}
                    <DockItem title="Open Documentation" icon={<Docs />} onClick={handleOpenDocs} />
                    <DockItem title="Save workflow" icon={<FloppyDiskArrowIn />} onClick={onSave} />
                    <DockItem title="Clear workflow" icon={<BinFull />} onClick={onClear} />
                    <DockItem title="Load workflow" icon={<FloppyDiskArrowOut />} onClick={() => fileInputRef.current?.click()} />
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