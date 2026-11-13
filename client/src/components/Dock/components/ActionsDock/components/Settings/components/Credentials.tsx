/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import {Copy, Trash} from "iconoir-react";
import {useSnackbar} from "notistack";
import {useCredentials} from "../../../../../../../hooks/useCredentials";
import {copyText} from "../../../../../../../utils/clipboard";
import {AddCredentialForm} from "./AddCredentialForm";
import {CredentialIcons} from "./CredentialIcons";
import {errorMessage} from "@shared/utils";


/* The tokens, API keys and secrets kept across reloads (encrypted in the vault), for the nodes and tools that use them. */
export function Credentials () {
    const {enqueueSnackbar} = useSnackbar();
    const {known, saved, save, remove, locked} = useCredentials();

    const reportError = (error: unknown) => enqueueSnackbar(`Couldn't change the vault: ${errorMessage(error)}`, {variant: "error"});

    const handleAdd = (name: string, value: string) => {
        const replacing = saved.some(credential => credential.key === name);

        save(name, value).then((done) => {
            if (done) enqueueSnackbar(`${replacing ? "Replaced" : "Saved"} ${name}.`, {variant: "success"});
        }).catch(reportError);
    };

    const handleRemove = (name: string) => {
        remove(name).catch(reportError);
    };

    // The placeholder, not the value: it goes into a URL as is, and needs no password.
    const handleCopy = (name: string) => {
        copyText(`{{${name}}}`)
            .then(() => enqueueSnackbar(`Copied {{${name}}}.`, {variant: "success"}))
            .catch(() => enqueueSnackbar("Couldn't copy the placeholder.", {variant: "error"}));
    };

    return (
        // A column that may shrink below its content, so a long list scrolls inside itself (as the Ollama
        // tab's models do) rather than stretching the tab and scrolling the whole dialog.
        <Box sx={{display: "flex", flexDirection: "column", minHeight: 0, mt: 1}}>
            {/* Only what isn't saved yet: a saved one is in the list below. */}
            <AddCredentialForm known={known.filter(({key}) => !saved.some(credential => credential.key === key))} onAdd={handleAdd} />
            <Typography variant="caption" color="text.secondary" sx={{mt: 0.5}}>
                Kept on this computer, encrypted with your vault password, and never written into workflow files. Nodes that use the same key share
                its value: changing it in a node changes it everywhere until the app reloads, and saving it here keeps it.
                {locked && " The vault is locked: adding or removing a key asks for your password."}
                {" "}A custom key's name may use letters, digits, _ . and -. Copy a saved key's {"{{name}}"} to use it in a GET Data or Fetch Web Page URL.
            </Typography>
            {/* The part that gives way: it shrinks to what's left, down to a row, and scrolls. */}
            {saved.length > 0 && (
                <List dense disablePadding sx={{mt: 1, minHeight: 56, overflowY: "auto"}}>
                    {saved.map(credential => (
                        <ListItem
                            key={credential.key}
                            disableGutters
                            // Room for both buttons: the list's own padding leaves room for one.
                            sx={{pr: 10}}
                            secondaryAction={
                                <>
                                    <Tooltip title="Copy placeholder">
                                        <IconButton size="small" aria-label={`Copy {{${credential.key}}}`} onClick={() => handleCopy(credential.key)}>
                                            <Copy style={{fontSize: 16}} />
                                        </IconButton>
                                    </Tooltip>
                                    <Tooltip title="Remove">
                                        <IconButton size="small" aria-label={`Remove ${credential.key}`} onClick={() => handleRemove(credential.key)}>
                                            <Trash style={{fontSize: 16}} />
                                        </IconButton>
                                    </Tooltip>
                                </>
                            }
                        >
                            <CredentialIcons owners={credential.owners} />
                            <ListItemText
                                // A custom name has no spaces to wrap at.
                                sx={{ml: 1.5, overflowWrap: "anywhere"}}
                                primary={credential.key}
                                secondary={credential.owners.length > 0 ? credential.owners.map(owner => owner.title).join(", ") : "Custom"}
                            />
                        </ListItem>
                    ))}
                </List>
            )}
        </Box>
    );
}
