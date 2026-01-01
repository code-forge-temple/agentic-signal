/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {timerService} from "./service.ts";
import {webSocketManager} from "../../ws/webSocketManager.ts";

webSocketManager.registerSubscriptionType('timerTrigger', (nodeId, handler) => {
    return timerService.subscribe(nodeId, handler);
});