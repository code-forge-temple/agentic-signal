/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import React, {useRef, useState} from "react";
import "./ActionsDock.scss";
import {ThemeProvider} from "@mui/material";
import {darkTheme} from "../../../../utils";
import {BinFull, FloppyDiskArrowIn, FloppyDiskArrowOut, Settings as SettingsIcon} from "iconoir-react";
import {BaseDialog} from "../../../BaseDialog";
import {DockItem} from "../DockItem";
import {Settings} from "./components/Settings";

type WorkflowActionsProps = {
    onSave: () => void;
    onClear: () => void;
    onLoad: (event: React.ChangeEvent<HTMLInputElement>) => void;
};

export function ActionsDock ({onSave, onLoad, onClear}: WorkflowActionsProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [openSettings, setOpenSettings] = useState(false);


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