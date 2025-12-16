import fs from "fs";
import path from "path";
import mustache from "mustache";

const SRC = path.resolve("src-tauri", "src");
const TOOLS = path.join(SRC, "tools");
const NODES = path.join(SRC, "nodes");
const MAIN_TEMPLATE = path.join(SRC, "main.gen.rs.mustache");
const MAIN_OUT = path.join(SRC, "main.gen.rs");
const NODES_MOD_TEMPLATE = path.join(SRC, "nodes", "mod.gen.rs.mustache");
const NODES_MOD_OUT = path.join(SRC, "nodes", "mod.gen.rs");
const TOOLS_MOD_TEMPLATE = path.join(SRC, "tools", "mod.gen.rs.mustache");
const TOOLS_MOD_OUT = path.join(SRC, "tools", "mod.gen.rs");

function findCommandsRecursive (dir: string, cratePrefix: string, relSegments: string[] = []): string[] {
    let commands: string[] = [];

    for (const name of fs.readdirSync(dir)) {
        const entryPath = path.join(dir, name);
        let isDir = false;

        try {
            isDir = fs.statSync(entryPath).isDirectory();
        } catch {
            isDir = false;
        }

        if (isDir) {
            commands = commands.concat(findCommandsRecursive(entryPath, cratePrefix, [...relSegments, name]));
        } else if (name.endsWith(".rs")) {
            const content = fs.readFileSync(entryPath, "utf8");
            const regex = /#\[tauri::command\][\s\S]*?pub (async )?fn (\w+)/g;
            let match;

            while ((match = regex.exec(content))) {
                const fnName = match[2];
                const fileBase = name.replace(/\.rs$/, "");
                const segments = fileBase === "mod"
                    ? [cratePrefix, ...relSegments]
                    : [cratePrefix, ...relSegments, fileBase];
                const fqPath = `crate::${segments.join("::") }::${fnName}`;

                commands.push(fqPath);
            }
        }
    }

    return commands;
}

function findSubmodules (dir: string): string[] {
    return fs.readdirSync(dir)
        .filter((name) => {
            const entryPath = path.join(dir, name);

            if (name.endsWith(".rs") && name !== "mod.rs" && name !== "mod.gen.rs") {
                return true;
            }

            try {
                return fs.statSync(entryPath).isDirectory();
            } catch {
                return false;
            }
        })
        .map((name) => name.endsWith(".rs") ? name.replace(/\.rs$/, "") : name);
}

function generateModFile (templatePath: string, outPath: string, modules: string[]) {
    const template = fs.readFileSync(templatePath, "utf8");
    const rendered = mustache.render(template, {modules});

    fs.writeFileSync(outPath, rendered);
    console.log(`Generated: ${outPath}`);
}

function generateMainFile () {
    const toolsCommands = findCommandsRecursive(TOOLS, "tools");
    const nodesCommands = findCommandsRecursive(NODES, "nodes");
    const template = fs.readFileSync(MAIN_TEMPLATE, "utf8");
    const rendered = mustache.render(template, {
        nodesAndToolsCommands: [...toolsCommands, ...nodesCommands]
    });

    fs.writeFileSync(MAIN_OUT, rendered);
    console.log(`Generated: ${MAIN_OUT}`);
}

export function generateSrcTauri () {
    generateModFile(NODES_MOD_TEMPLATE, NODES_MOD_OUT, findSubmodules(NODES));

    generateModFile(TOOLS_MOD_TEMPLATE, TOOLS_MOD_OUT, findSubmodules(TOOLS));

    generateMainFile();
}