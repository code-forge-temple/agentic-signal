/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {commandGateway, CommandConnection} from "./service.ts";
import {webSocketManager} from "../ws/webSocketManager.ts";

// App-wide, not a node's: the app's connection list comes with its subscription, so a reconnect brings it back too.
// The log says when an app starts and stops listening, and on which socket: outside calls reach only a listening app.
webSocketManager.registerSubscriptionType('commandRequests', (_nodeId, handler, variables, {socket}) => {
    const connections = Array.isArray(variables.connections) ? variables.connections as CommandConnection[] : [];
    const disconnect = commandGateway.connectApp(connections, handler);
    const count = `${connections.length} connection${connections.length === 1 ? "" : "s"}`;

    console.log(`WebSocket ${socket}: app listening for outside calls (${count})`);

    return (reason) => {
        disconnect();
        console.log(`WebSocket ${socket}: app stopped listening for outside calls (${reason})`);
    };
}, {nodeScoped: false});
