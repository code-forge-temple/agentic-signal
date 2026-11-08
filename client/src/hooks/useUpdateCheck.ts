/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {useEffect, useState} from "react";
import {useSettings} from "./useSettings";
import {fetchLatestRelease, isNewerVersion, Release} from "../services/updateCheck";


/**
 * The newer release on GitHub, when there is one and the check is on; null otherwise. It asks once per start, and
 * again when the check is switched back on. Offline, or with GitHub unreachable, there's simply nothing to show.
 */
export function useUpdateCheck (): Release | null {
    const {settings} = useSettings();
    const [release, setRelease] = useState<Release | null>(null);

    useEffect(() => {
        if (!settings.checkForUpdates) {
            setRelease(null);

            return;
        }

        let cancelled = false;

        fetchLatestRelease()
            .then((latest) => {
                if (!cancelled && isNewerVersion(latest.version, __APP_VERSION__)) setRelease(latest);
            })
            .catch(() => {});

        return () => {
            cancelled = true;
        };
    }, [settings.checkForUpdates]);

    return release;
}
