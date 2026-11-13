/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import Typography from "@mui/material/Typography";
import {Trash} from "iconoir-react";


type ModelListProps = {
    models: string[];
    /** A new host hasn't answered yet: a spinner instead of the list. */
    checking: boolean;
    onDelete: (model: string) => void;
};

/** The Ollama host's models, each with a delete button. */
export function ModelList ({models, checking, onDelete}: ModelListProps) {
    if (checking) {
        return (
            <Box sx={{display: "flex", alignItems: "center", gap: 1.5, mt: 3}}>
                <CircularProgress size={18} />
                <Typography variant="body2" color="text.secondary">Checking the Ollama host…</Typography>
            </Box>
        );
    }

    return (
        <Box sx={{mt: 3, maxHeight: "100%", overflowY: "auto"}}>
            <List>
                {models.map(model => (
                    <ListItem
                        key={model}
                        // CSS hover, not state: a state change per row entered would redraw the whole dialog.
                        sx={{"&:hover": {backgroundColor: "action.hover"}, transition: "background 0.2s"}}
                        secondaryAction={
                            <IconButton edge="end" aria-label="delete" onClick={() => onDelete(model)} size="small">
                                <Trash style={{fontSize: 16}} />
                            </IconButton>
                        }
                    >
                        <ListItemText primary={model} />
                    </ListItem>
                ))}
            </List>
        </Box>
    );
}
