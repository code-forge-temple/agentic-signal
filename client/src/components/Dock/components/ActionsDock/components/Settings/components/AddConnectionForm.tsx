/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {useState} from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import {parseCommandList} from "../../../../../../../services/commandConnections";


type AddConnectionFormProps = {
    /** Adds the connection; the form then empties. */
    onAdd: (name: string, commands: string[]) => void;
};

/*
 * Name, commands and Add. What's typed stays here, so a keystroke redraws this row only, not the
 * list of connections; and Add reads exactly what's in the fields, with no debounce to lag behind.
 */
export function AddConnectionForm ({onAdd}: AddConnectionFormProps) {
    const [name, setName] = useState("");
    const [commands, setCommands] = useState("");

    const handleAdd = () => {
        onAdd(name, parseCommandList(commands));
        setName("");
        setCommands("");
    };

    return (
        // Stretched, so Add is as tall as the fields beside it.
        <Box sx={{display: "flex", gap: 1, alignItems: "stretch"}}>
            <TextField
                size="small"
                label="Name"
                placeholder="My script"
                value={name}
                onChange={(event) => setName(event.target.value)}
            />
            <TextField
                size="small"
                label="Commands"
                placeholder="All, or: research, echo"
                value={commands}
                onChange={(event) => setCommands(event.target.value)}
                sx={{flex: 1}}
            />
            <Button variant="outlined" onClick={handleAdd} disabled={!name.trim()}>
                Add
            </Button>
        </Box>
    );
}
