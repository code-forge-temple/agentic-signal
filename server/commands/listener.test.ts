/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {join} from "node:path";
import {CommandsListener, reachableAddresses} from "./listener.ts";


// Hand-rolled, like keyedLock.test.ts: the server has no test dependencies.
function assertEquals<T> (actual: T, expected: T): void {
    const a = JSON.stringify(actual);
    const b = JSON.stringify(expected);

    if (a !== b) throw new Error(`Expected ${b}, got ${a}`);
}

async function assertRejects (work: () => Promise<unknown>, message: string): Promise<void> {
    try {
        await work();
    } catch (error) {
        assertEquals(error instanceof Error && error.message.includes(message), true);

        return;
    }

    throw new Error(`Expected it to fail with "${message}"`);
}

/**
 * A listener on a fake server, with its settings file in a fresh folder: `events` records what it listened on
 * and shut down. `busy` makes binding that address fail, as a port another program holds would.
 */
async function listenerWith ({env = {}, settings, busy}: {env?: Record<string, string>; settings?: object; busy?: string} = {}) {
    const folder = await Deno.makeTempDir();
    const settingsFile = join(folder, ".agentic-signal", "settings.json");
    const events: string[] = [];

    if (settings) {
        await Deno.mkdir(join(folder, ".agentic-signal"));
        await Deno.writeTextFile(settingsFile, JSON.stringify(settings));
    }

    const listener = new CommandsListener({
        port: 8001,
        settingsFile,
        env: (name) => env[name],
        serve: ({hostname, port, onListen}) => {
            if (hostname === busy) throw new Error("Address in use");

            events.push(`listen ${hostname}`);
            onListen({hostname, port});

            return {shutdown: () => {
                events.push(`shutdown ${hostname}`);

                return Promise.resolve();
            }};
        },
        addresses: () => ["192.168.0.21"],
    });

    await listener.start();

    return {listener, events, settingsFile};
}

Deno.test("takes calls from this computer only, at first", async () => {
    const {listener, events} = await listenerWith();

    assertEquals(events, ["listen 127.0.0.1"]);
    assertEquals(listener.networkAccess(), {enabled: false, lockedBy: null, port: 8001, addresses: ["192.168.0.21"]});
    assertEquals(listener.endpoint(), "http://127.0.0.1:8001/workflows/");
});

Deno.test("switched on, reopens the port to the network and remembers it", async () => {
    const {listener, events, settingsFile} = await listenerWith({settings: {somethingElse: 1}});

    assertEquals((await listener.setNetworkAccess(true)).enabled, true);
    assertEquals(events, ["listen 127.0.0.1", "shutdown 127.0.0.1", "listen 0.0.0.0"]);
    assertEquals(listener.endpoint(), "http://localhost:8001/workflows/");
    // The rest of the file is kept.
    assertEquals(JSON.parse(await Deno.readTextFile(settingsFile)), {somethingElse: 1, commandsNetworkAccess: true});
});

Deno.test("a restart starts where the switch was left", async () => {
    const {listener, events} = await listenerWith({settings: {commandsNetworkAccess: true}});

    assertEquals(events, ["listen 0.0.0.0"]);
    assertEquals(listener.networkAccess().enabled, true);
});

Deno.test("switched off, takes calls from this computer only again", async () => {
    const {listener, events} = await listenerWith({settings: {commandsNetworkAccess: true}});

    assertEquals((await listener.setNetworkAccess(false)).enabled, false);
    assertEquals(events, ["listen 0.0.0.0", "shutdown 0.0.0.0", "listen 127.0.0.1"]);
});

Deno.test("setting it to what it already is reopens nothing", async () => {
    const {listener, events} = await listenerWith();

    await listener.setNetworkAccess(false);
    assertEquals(events, ["listen 127.0.0.1"]);
});

Deno.test("if the port can't be opened to the network, it stays as it was, unsaved", async () => {
    const {listener, events, settingsFile} = await listenerWith({busy: "0.0.0.0"});

    await assertRejects(() => listener.setNetworkAccess(true), "Address in use");
    assertEquals(events, ["listen 127.0.0.1", "shutdown 127.0.0.1", "listen 127.0.0.1"]);
    assertEquals(listener.networkAccess().enabled, false);
    assertEquals(await Deno.stat(settingsFile).then(() => true, () => false), false);
});

Deno.test("an address the backend was started with decides, and the switch can't change it", async () => {
    const {listener, events} = await listenerWith({env: {AGENTIC_SIGNAL_COMMANDS_HOST: "0.0.0.0"}, settings: {commandsNetworkAccess: false}});

    assertEquals(events, ["listen 0.0.0.0"]);
    assertEquals(listener.networkAccess(), {enabled: true, lockedBy: "AGENTIC_SIGNAL_COMMANDS_HOST", port: 8001, addresses: ["192.168.0.21"]});
    await assertRejects(() => listener.setNetworkAccess(false), "AGENTIC_SIGNAL_COMMANDS_HOST decides this");
});

Deno.test("in Docker (AGENTIC_SIGNAL_HOST) it's open, with no addresses: the container's own are no use outside", async () => {
    const {listener} = await listenerWith({env: {AGENTIC_SIGNAL_HOST: "0.0.0.0"}});

    assertEquals(listener.networkAccess(), {enabled: true, lockedBy: "AGENTIC_SIGNAL_HOST", port: 8001, addresses: []});
});

Deno.test("lists only the addresses other computers can reach: no loopback, link-local, VM or container adapters", () => {
    const adapter = (name: string, address: string, mac: string, family = "IPv4") => ({family, name, address, mac});

    assertEquals(reachableAddresses([
        adapter("Ethernet 2", "192.168.56.1", "0a:00:27:00:00:04"), // VirtualBox's host-only network
        adapter("Wi-Fi", "192.168.0.21", "d0:37:45:11:aa:23"),
        adapter("Loopback Pseudo-Interface 1", "127.0.0.1", "00:00:00:00:00:00"),
        adapter("vEthernet (WSL)", "172.29.16.1", "00:15:5d:a1:b2:c3"),
        adapter("VMware Network Adapter VMnet8", "192.168.153.1", "00:50:56:c0:00:08"),
        adapter("docker0", "172.17.0.1", "02:42:7a:11:22:33"),
        adapter("eth0", "192.168.0.42", "48:b0:2d:01:02:03"),
        adapter("wlan0", "169.254.10.20", "48:b0:2d:01:02:04"),
        adapter("eth0", "fe80::1", "48:b0:2d:01:02:03", "IPv6"),
        adapter("Wi-Fi", "192.168.0.21", "d0:37:45:11:aa:23"),
    ]), ["192.168.0.21", "192.168.0.42"]);
});
