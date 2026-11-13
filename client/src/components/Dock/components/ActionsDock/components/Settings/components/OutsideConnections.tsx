/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {useEffect, useState} from "react";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import {Copy, Trash} from "iconoir-react";
import {useSnackbar} from "notistack";
import {FieldsetGroup} from "../../../../../../FieldsetGroup";
import {useCommandConnections} from "../../../../../../../hooks/useCommandConnections";
import {CommandConnection} from "../../../../../../../services/commandConnections";
import {fetchCommandsEndpoint} from "../../../../../../../services/outsideCommandsService";
import {copyText} from "../../../../../../../utils/clipboard";
import {AddConnectionForm} from "./AddConnectionForm";
import {NetworkAccessSwitch} from "./NetworkAccessSwitch";
import {errorMessage} from "@shared/utils";


const ENDPOINT_PLACEHOLDER = "http://127.0.0.1:8001/workflows/";

/**
 * "/research, /echo · token as_3f9a1c…": what it may call, and enough of the token to tell it apart. The token lives
 * in the vault, so while it's locked the line says so instead.
 */
function describeConnection ({commands}: CommandConnection, token: string | undefined): string {
    const allowed = commands.length > 0 ? commands.map(command => `/${command}`).join(", ") : "All commands";

    return `${allowed} · ${token ? `token ${token.slice(0, 9)}…` : "token locked in the vault"}`;
}

/* The outside apps (Scribe Pal, scripts) allowed to call workflow commands, each with its own token. */
export function OutsideConnections () {
    const {enqueueSnackbar} = useSnackbar();
    const {connections, tokens, getToken, addConnection, removeConnection} = useCommandConnections();
    const [endpoint, setEndpoint] = useState(ENDPOINT_PLACEHOLDER);

    useEffect(() => {
        fetchCommandsEndpoint().then((url) => {
            if (url) setEndpoint(url);
        }).catch(() => {});
    }, []);

    const copyToken = (token: string | null) => {
        if (token === null) return;

        copyText(token)
            .then(() => enqueueSnackbar("Token copied.", {variant: "success"}))
            .catch(() => enqueueSnackbar("Couldn't copy the token.", {variant: "error"}));
    };

    const handleAdd = (name: string, commands: string[]) => {
        addConnection(name, commands)
            .then(copyToken)
            .catch((error: unknown) => enqueueSnackbar(`Couldn't add the connection: ${errorMessage(error)}`, {variant: "error"}));
    };

    const handleCopy = (connection: CommandConnection) => {
        getToken(connection).then(copyToken).catch(() => enqueueSnackbar("Couldn't copy the token.", {variant: "error"}));
    };

    return (
        // "16px", not 16: FieldsetGroup hands `style` to MUI's sx, where a bare number means theme spacing (16 × 8px).
        // A column that may shrink below its content, so a long list scrolls inside itself (as the Ollama
        // tab's models do) rather than stretching the tab and scrolling the whole dialog. Only a window
        // too short even for one row of the list scrolls the group itself.
        <FieldsetGroup title="Outside connections" style={{marginTop: "16px", display: "flex", flexDirection: "column", overflowY: "auto"}}>
            {/* Shown in full when open; the list below gives up the room. */}
            <FieldsetGroup title="Info" collapsible defaultCollapsed>
                <Typography variant="body2" color="text.secondary" component="div">
                    Apps outside Agentic Signal call workflows open in your layers whose Workflow Input has Run on.
                    <ul style={{margin: "8px 0 0", paddingLeft: "20px"}}>
                        <li>
                            Run one: <code>POST {endpoint}&lt;command&gt;</code> with a Data Source as JSON, the same content a Data Source node holds:
                            {" "}<code>{"{\"type\": \"markdown-and-files\", \"value\": {\"text\", \"files\": [{\"name\", \"base64\", \"mimeType\", \"isToolsPayload\"}]}}"}</code>
                            {" "}or <code>{"{\"type\": \"json\", \"value\": …}"}</code>. The answer is <code>{"{\"result\": …}"}</code>.
                        </li>
                        <li>
                            Long runs, for callers that can't wait on one request (a browser extension): add the header <code>Prefer: respond-async</code>.
                            {" "}It answers at once with <code>{"{\"job\": …}"}</code>; then <code>GET {endpoint}jobs/&lt;job&gt;</code> answers
                            {" "}<code>{"{\"status\": \"running\"}"}</code> until the run ends, then what the one call would have.
                            {" "}<code>DELETE {endpoint}jobs/&lt;job&gt;</code> cancels it; a job left unchecked for 2 minutes is cancelled.
                        </li>
                        <li>
                            List them: <code>GET {endpoint}</code> answers <code>{"{\"commands\": [{\"command\", \"description\"}]}"}</code>,
                            the ones the token may call that a layer listens for now.
                        </li>
                        <li>Both need the header <code>Authorization: Bearer &lt;token&gt;</code>.</li>
                    </ul>
                </Typography>
            </FieldsetGroup>
            <NetworkAccessSwitch />
            <AddConnectionForm onAdd={handleAdd} />
            <Typography variant="caption" color="text.secondary">
                Adding a connection copies its token. Copy it again any time from the list.
            </Typography>
            {/* The part that gives way: it shrinks to what's left, down to a row, and scrolls. */}
            {connections.length > 0 && (
                <List dense disablePadding sx={{mt: 1, minHeight: 56, overflowY: "auto"}}>
                    {connections.map(connection => (
                        <ListItem
                            key={connection.id}
                            disableGutters
                            secondaryAction={
                                <>
                                    <Tooltip title="Copy token">
                                        <IconButton size="small" aria-label={`Copy ${connection.name}'s token`} onClick={() => handleCopy(connection)}>
                                            <Copy style={{fontSize: 16}} />
                                        </IconButton>
                                    </Tooltip>
                                    <Tooltip title="Remove">
                                        <IconButton size="small" aria-label={`Remove ${connection.name}`} onClick={() => removeConnection(connection.id)}>
                                            <Trash style={{fontSize: 16}} />
                                        </IconButton>
                                    </Tooltip>
                                </>
                            }
                        >
                            <ListItemText primary={connection.name} secondary={describeConnection(connection, connection.token ?? tokens?.[connection.id])} />
                        </ListItem>
                    ))}
                </List>
            )}
        </FieldsetGroup>
    );
}
