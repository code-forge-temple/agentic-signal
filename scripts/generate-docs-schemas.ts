/************************************************************************
 *    Copyright (C) 2025 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

import fs from "fs";
import path from "path";

const SCRIPT_DIR = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, "$1");
const ROOT_DIR = path.resolve(SCRIPT_DIR, "..");
const NODES_DIR = path.join(ROOT_DIR, "client/src/components/nodes");
const SHARED_TYPES_GEN = path.join(ROOT_DIR, "shared/types.gen.ts");
const OUT_FILE = path.join(ROOT_DIR, "docs/src/data/nodeSchemas.gen.json");
const EXTRACT_SCRIPT = path.join(SCRIPT_DIR, "client", "extract-node-schema.ts");
// zod and zod-to-json-schema live in docs/node_modules
const DOCS_NODE_MODULES = path.join(ROOT_DIR, "docs", "node_modules");

function getNodeFolders (): string[] {
    return fs.readdirSync(NODES_DIR).filter((name) => {
        const folderPath = path.join(NODES_DIR, name);

        if (!fs.statSync(folderPath).isDirectory()) return false;

        return fs.existsSync(path.join(folderPath, "types", "workflow.ts"));
    });
}

function getNodeType (folder: string): string | null {
    for (const ext of ["constants.tsx", "constants.ts"]) {
        const constPath = path.join(NODES_DIR, folder, ext);

        if (!fs.existsSync(constPath)) continue;

        const content = fs.readFileSync(constPath, "utf8");

        // Direct assignment: export const NODE_TYPE = "some-type"
        const directMatch = /NODE_TYPE\s*=\s*["'`]([^"'`]+)["'`]/.exec(content);

        if (directMatch) return directMatch[1];

        // Re-export from @shared/types.gen: export {X_NODE_TYPE as NODE_TYPE} from "@shared/types.gen"
        const reExportMatch = /export\s*\{\s*(\w+)\s+as\s+NODE_TYPE\s*\}/.exec(content);

        if (reExportMatch) {
            const constName = reExportMatch[1];
            const sharedContent = fs.readFileSync(SHARED_TYPES_GEN, "utf8");
            const reExportRegex = /export \* from ['"]([^'"]+)['"]/g;
            let entry: RegExpExecArray | null;

            while ((entry = reExportRegex.exec(sharedContent)) !== null) {
                const absPath = path.resolve(path.dirname(SHARED_TYPES_GEN), `${entry[1]}.ts`);

                if (!fs.existsSync(absPath)) continue;

                const fileContent = fs.readFileSync(absPath, "utf8");
                const valueMatch = new RegExp(`${constName}\\s*=\\s*["'\`]([^"'\`]+)["'\`]`).exec(fileContent);

                if (valueMatch) return valueMatch[1];
            }
        }
    }

    return null;
}

export function generateDocsSchemas () {
    const result: Record<string, unknown> = {};
    const folders = getNodeFolders();

    for (const folder of folders) {
        const nodeType = getNodeType(folder);

        if (!nodeType) continue;

        const workflowPath = path.join(NODES_DIR, folder, "types", "workflow.ts");

        // Spawn an isolated subprocess per node so plugin registrations and dynamic
        // imports don't pollute this process. NODE_PATH points to docs/node_modules
        // so symlinked pro-project nodes (which have no local node_modules) resolve
        // `zod` to the same instance as zodToJsonSchema, avoiding empty schemas.
        const proc = Bun.spawnSync(
            ["bun", EXTRACT_SCRIPT, workflowPath, nodeType],
            {env: {...process.env, NODE_PATH: DOCS_NODE_MODULES}},
        );

        if (proc.exitCode !== 0) {
            const stderr = proc.stderr ? new TextDecoder().decode(proc.stderr) : "";

            console.log(`[${folder}] skipped — ${stderr.trim() || `exit ${proc.exitCode}`}`);
            continue;
        }

        try {
            const stdout = proc.stdout ? new TextDecoder().decode(proc.stdout) : "";
            const {schema} = JSON.parse(stdout);

            result[nodeType] = schema;
        } catch {
            console.log(`[${folder}] skipped — could not parse subprocess output`);
        }
    }

    fs.mkdirSync(path.dirname(OUT_FILE), {recursive: true});
    fs.writeFileSync(OUT_FILE, JSON.stringify(result, null, 2));

    console.log(`Generated: ${OUT_FILE} (${Object.keys(result).length} nodes)`);
}

generateDocsSchemas();

