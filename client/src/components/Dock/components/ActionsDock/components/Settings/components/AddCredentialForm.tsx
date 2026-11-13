/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {useState} from "react";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import {CREDENTIAL_NAME, KnownCredential} from "../../../../../../../services/credentials";
import {CredentialIcons} from "./CredentialIcons";


type AddCredentialFormProps = {
    /** The credentials nodes and tools declare, offered in the key's list. */
    known: KnownCredential[];
    onAdd: (name: string, value: string) => void;
};

/*
 * Key, value and Add. The key is picked from the declared ones or typed. What's typed stays here, so a keystroke
 * redraws this row only, not the list of credentials.
 */
export function AddCredentialForm ({known, onAdd}: AddCredentialFormProps) {
    const [picked, setPicked] = useState<KnownCredential | string | null>(null);
    const [name, setName] = useState("");
    const [value, setValue] = useState("");
    const trimmedName = name.trim();
    const validName = CREDENTIAL_NAME.test(trimmedName);

    const handleAdd = () => {
        onAdd(trimmedName, value);
        setPicked(null);
        setName("");
        setValue("");
    };

    return (
        <Box sx={{display: "flex", gap: 1, alignItems: "stretch"}}>
            <Autocomplete
                freeSolo
                options={known}
                value={picked}
                onChange={(_event, option) => setPicked(option)}
                inputValue={name}
                onInputChange={(_event, text) => setName(text)}
                getOptionLabel={(option) => typeof option === "string" ? option : option.key}
                renderOption={({key, ...props}, option) => (
                    <li key={key} {...props}>
                        <CredentialIcons owners={option.owners} />
                        <Box component="span" sx={{ml: 1.5}}>{option.key}</Box>
                    </li>
                )}
                renderInput={(params) => (
                    <TextField {...params} size="small" label="Key" placeholder="Pick one, or type your own" error={trimmedName !== "" && !validName} />
                )}
                sx={{flex: 1}}
            />
            <TextField
                size="small"
                type="password"
                label="Value"
                autoComplete="new-password"
                value={value}
                onChange={(event) => setValue(event.target.value)}
                sx={{flex: 1}}
            />
            <Button variant="outlined" onClick={handleAdd} disabled={!validName || !value}>
                Add
            </Button>
        </Box>
    );
}
