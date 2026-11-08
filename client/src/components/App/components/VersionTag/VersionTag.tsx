/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {useEffect} from "react";
import {Button, Chip, Tooltip} from "@mui/material";
import {useSnackbar} from "notistack";
import {useUpdateCheck} from "../../../../hooks/useUpdateCheck";
import {openExternalUrl} from "../../../../utils";


// The newest version already announced: each new version gets one notice, then the tag alone points to it.
export const UPDATE_NOTIFIED_KEY = "agentic-signal.updateNotified";

function announceOnce (version: string): boolean {
    try {
        if (localStorage.getItem(UPDATE_NOTIFIED_KEY) === version) return false;

        localStorage.setItem(UPDATE_NOTIFIED_KEY, version);
    } catch {
        // Without storage, it's announced at each start.
    }

    return true;
}

// A release build updates from the release's downloads. A build made from the code (the web app, Docker, a desktop
// app built by its user, as with the PRO nodes) updates by pulling the code and building again: the release page
// only tells what's new.
const HOW_TO_UPDATE = __RELEASE_BUILD__ ? "" : " Pull the latest code and build again to update.";
const OPEN_LABEL = __RELEASE_BUILD__ ? "Download" : "What's new";
const TAG_TIP = __RELEASE_BUILD__ ? "open its download page" : "pull the latest code and build again. Click for what's new";

/**
 * The app's version, in the top right corner. When a newer release is out, it's highlighted and opens the release's
 * page, and a notice says so once. The same size either way, so the dock's room for it holds.
 */
export function VersionTag () {
    const release = useUpdateCheck();
    const {enqueueSnackbar, closeSnackbar} = useSnackbar();

    useEffect(() => {
        if (!release || !announceOnce(release.version)) return;

        enqueueSnackbar(`Agentic Signal ${release.version} is out (you have ${__APP_VERSION__}).${HOW_TO_UPDATE}`, {
            variant: "info",
            persist: true,
            action: key => (
                <>
                    <Button color="inherit" size="small" onClick={() => {
                        void openExternalUrl(release.url);
                        closeSnackbar(key);
                    }}>
                        {OPEN_LABEL}
                    </Button>
                    <Button color="inherit" size="small" onClick={() => closeSnackbar(key)}>Dismiss</Button>
                </>
            ),
        });
    }, [release, enqueueSnackbar, closeSnackbar]);

    if (!release) return <Chip label={`v${__APP_VERSION__}`} size="small" className="version-tag" />;

    return (
        <Tooltip title={`Version ${release.version} is out: ${TAG_TIP}`} placement="bottom-end">
            <Chip
                label={`v${__APP_VERSION__}`}
                size="small"
                className="version-tag update-available"
                onClick={() => void openExternalUrl(release.url)}
            />
        </Tooltip>
    );
}
