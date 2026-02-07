/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import React, {useRef, useState} from "react";
import "./ActionsDock.scss";
import {ThemeProvider} from "@mui/material";
import {darkTheme} from "../../../../utils";
import {BinFull, FloppyDiskArrowIn, FloppyDiskArrowOut, Settings as SettingsIcon, HelpCircle as Docs} from "iconoir-react";
import {BaseDialog} from "../../../BaseDialog";
import {DockItem} from "../DockItem";
import {Settings} from "./components/Settings";
import {isTauri} from "../../../../utils";


type WorkflowActionsProps = {
    onSave: () => void;
    onClear: () => void;
    onLoad: (event: React.ChangeEvent<HTMLInputElement>) => void;
};

export function ActionsDock ({onSave, onLoad, onClear}: WorkflowActionsProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [openSettings, setOpenSettings] = useState(false);

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

    return (
        <ThemeProvider theme={darkTheme}>
            <div className="actions-dock">
                <div className="dock-items">
                    <DockItem title="Settings" icon={<SettingsIcon />} onClick={() => setOpenSettings(true)} />
                    <BaseDialog
                        open={openSettings}
                        onClose={() => setOpenSettings(false)}
                        title="Application Settings"
                    >
                        <Settings />
                    </BaseDialog>
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