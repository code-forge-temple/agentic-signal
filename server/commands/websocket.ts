/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {commandGateway, CommandConnection} from "./service.ts";
import {webSocketManager} from "../ws/webSocketManager.ts";

// App-wide, not a node's: the app's connection list comes with its subscription, so a reconnect brings it back too.
webSocketManager.registerSubscriptionType('commandRequests', (_nodeId, handler, variables) => {
    const connections = Array.isArray(variables.connections) ? variables.connections as CommandConnection[] : [];

    return commandGateway.connectApp(connections, handler);
}, {nodeScoped: false});
