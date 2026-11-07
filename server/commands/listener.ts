/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import {dirname, join} from "node:path";
import {COMMANDS_PORT} from "../../shared/constants.ts";
import {commandGateway} from "./service.ts";


/** Whether other computers may call the commands port, as Settings shows it. */
export type CommandsNetworkAccess = {
    enabled: boolean;
    /** The variable the backend was started with that decides this instead of the switch, if any. */
    lockedBy: string | null;
    port: number;
    /** This computer's network addresses, for other computers to call it on. */
    addresses: string[];
};

type Server = {shutdown: () => Promise<void>};

type ServeOptions = {
    hostname: string;
    port: number;
    handler: (request: Request) => Response | Promise<Response>;
    onListen: (address: {hostname: string; port: number}) => void;
};

export type CommandsListenerOptions = {
    port: number;
    /** Where the switch's choice is kept, so it outlasts a restart. */
    settingsFile: string;
    env: (name: string) => string | undefined;
    serve: (options: ServeOptions) => Server;
    addresses: () => string[];
};

const THIS_COMPUTER = "127.0.0.1";
const ANY_COMPUTER = "0.0.0.0";
// An address chosen when the backend was started wins over the switch. AGENTIC_SIGNAL_HOST is Docker's: there
// only the container's own network reaches the port, so it has to be open.
const HOST_VARIABLES = ["AGENTIC_SIGNAL_COMMANDS_HOST", "AGENTIC_SIGNAL_HOST"];
const SETTING = "commandsNetworkAccess";

const isThisComputer = (host: string) => host === THIS_COMPUTER || host === "localhost" || host === "::1";

async function readSettings (file: string): Promise<Record<string, unknown>> {
    try {
        const parsed: unknown = JSON.parse(await Deno.readTextFile(file));

        return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
    } catch {
        return {};
    }
}

/**
 * The port outside apps call workflow commands on. It takes calls from this computer only, unless the switch in
 * Settings opens it to the network (or the backend was started with an address for it). Changing the switch
 * reopens the port on the new address at once; calls already running finish on the old one.
 */
export class CommandsListener {
    private server: Server | null = null;
    private host = THIS_COMPUTER;
    private lockedBy: string | null = null;
    private url = "";

    constructor (private readonly options: CommandsListenerOptions) {}

    async start (): Promise<void> {
        const variable = HOST_VARIABLES.find(name => this.options.env(name));

        if (variable) {
            this.lockedBy = variable;
            this.listen(this.options.env(variable)!);

            return;
        }

        const settings = await readSettings(this.options.settingsFile);

        this.listen(settings[SETTING] === true ? ANY_COMPUTER : THIS_COMPUTER);
    }

    /** Where outside apps on this computer call commands, e.g. "http://127.0.0.1:8001/workflows/". */
    endpoint (): string {
        return this.url;
    }

    networkAccess (): CommandsNetworkAccess {
        let addresses: string[] = [];

        // Docker's own addresses are of no use to anyone outside it.
        if (this.lockedBy !== "AGENTIC_SIGNAL_HOST") {
            try {
                addresses = this.options.addresses();
            } catch {
                addresses = [];
            }
        }

        return {enabled: !isThisComputer(this.host), lockedBy: this.lockedBy, port: this.options.port, addresses};
    }

    async setNetworkAccess (enabled: boolean): Promise<CommandsNetworkAccess> {
        if (this.lockedBy) throw new Error(`${this.lockedBy} decides this: the backend was started with it.`);

        const host = enabled ? ANY_COMPUTER : THIS_COMPUTER;

        if (host !== this.host) {
            const previous = {server: this.server, host: this.host};

            // Stops taking calls at once, which frees the port; the calls it's still answering finish.
            previous.server?.shutdown().catch(() => {});

            try {
                this.listen(host);
            } catch (error) {
                this.listen(previous.host);

                throw error;
            }
        }

        const file = this.options.settingsFile;

        await Deno.mkdir(dirname(file), {recursive: true});
        await Deno.writeTextFile(file, JSON.stringify({...await readSettings(file), [SETTING]: enabled}, null, 4));

        return this.networkAccess();
    }

    private listen (host: string): void {
        this.server = this.options.serve({
            hostname: host,
            port: this.options.port,
            handler: (request) => commandGateway.handle(request),
            onListen: ({hostname, port}) => {
                this.url = `http://${hostname === ANY_COMPUTER ? "localhost" : hostname}:${port}/workflows/`;
                console.log(`Workflow commands: POST ${this.url}<command>${hostname === ANY_COMPUTER ? " (other computers too)" : ""}`);
            },
        });
        this.host = host;
    }
}

// Adapters for virtual machines and containers, by their hardware address's vendor prefix (VirtualBox, VMware,
// Hyper-V and WSL, Docker, Parallels, QEMU/KVM, Xen) or, on Linux, their name: only this computer's own VMs and
// containers reach their addresses, never another computer.
const VIRTUAL_MAC_PREFIXES = ["08:00:27", "0a:00:27", "00:50:56", "00:0c:29", "00:05:69", "00:1c:14", "00:15:5d", "02:42:", "00:1c:42", "52:54:00", "00:16:3e"];
const VIRTUAL_NAMES = /^(docker|br-|veth|virbr|vboxnet|vmnet|lxcbr|lxdbr|cni|flannel)/i;

type NetworkInterface = {family: string; name: string; address: string; mac: string};

/**
 * The IPv4 addresses other computers can call this one on: not the loopback, not a link-local one, and not a
 * virtual machine's or container's adapter.
 */
export function reachableAddresses (interfaces: NetworkInterface[]): string[] {
    const found = interfaces
        .filter(({family, address}) => family === "IPv4" && !address.startsWith("127.") && !address.startsWith("169.254."))
        .filter(({name, mac}) => !VIRTUAL_NAMES.test(name) && !VIRTUAL_MAC_PREFIXES.some(prefix => mac.toLowerCase().startsWith(prefix)))
        .map(({address}) => address);

    return [...new Set(found)];
}

function defaultSettingsFile (): string {
    const home = Deno.env.get("HOME") ?? Deno.env.get("USERPROFILE") ?? Deno.cwd();

    return join(home, ".agentic-signal", "settings.json");
}

export const commandsListener = new CommandsListener({
    port: Number(Deno.env.get("AGENTIC_SIGNAL_COMMANDS_PORT") ?? COMMANDS_PORT),
    settingsFile: defaultSettingsFile(),
    env: (name) => Deno.env.get(name),
    serve: (options) => Deno.serve(options),
    addresses: () => reachableAddresses(Deno.networkInterfaces()),
});
