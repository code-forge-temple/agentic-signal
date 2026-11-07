/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {useCallback, useMemo} from "react";
import {v4 as uuidv4} from "uuid";
import {useGlobalConfig} from "../stores/globalConfig";
import {COMMAND_CONNECTIONS_KEY, CommandConnection, newCommandToken, parseCommandConnections} from "../services/commandConnections";


/** The outside apps allowed to call workflow commands, and adding or removing one. */
export function useCommandConnections () {
    const {globalData, setGlobalData} = useGlobalConfig();
    const raw = globalData[COMMAND_CONNECTIONS_KEY];
    const connections = useMemo(() => parseCommandConnections(raw), [raw]);

    const save = useCallback((next: CommandConnection[]) => {
        setGlobalData(COMMAND_CONNECTIONS_KEY, JSON.stringify(next), true);
    }, [setGlobalData]);

    const addConnection = useCallback((name: string, commands: string[]): CommandConnection => {
        // Not crypto.randomUUID: browsers only offer it on secure pages, and the app may be opened over plain
        // http from another computer.
        const connection: CommandConnection = {id: uuidv4(), name: name.trim(), token: newCommandToken(), commands};

        save([...connections, connection]);

        return connection;
    }, [connections, save]);

    const removeConnection = useCallback((id: string) => {
        save(connections.filter(connection => connection.id !== id));
    }, [connections, save]);

    return {connections, addConnection, removeConnection};
}
