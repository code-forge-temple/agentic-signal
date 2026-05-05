// Called by generate-docs-schemas.ts as a subprocess:
//   bun extract-node-schema.ts <workflowPath> <nodeType>
//
// NODE_PATH is set by the caller to docs/node_modules so that symlinked
// pro-project nodes resolve `zod` to the same instance as this script.

import {plugin} from "bun";
import {zodToJsonSchema} from "zod-to-json-schema";
import fs from "fs";
import os from "os";
import path from "path";

const [,, workflowPath, nodeType] = process.argv;
const SCRIPT_DIR = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, "$1");
const ROOT_DIR = path.resolve(SCRIPT_DIR, "..", "..");

if (!workflowPath || !nodeType) {
    console.error("Usage: extract-node-schema.ts <workflowPath> <nodeType>");
    process.exit(1);
}

// Scan the workflow file for named imports or re-exports from @shared/* so the virtual stub
// exports exactly those names. Without this, Bun's ESM linker throws a
// SyntaxError when workflow.ts re-exports a value that isn't present in a
// static stub file.
function buildSharedStubContent (filePath: string): string {
    let content: string;

    try {
        content = fs.readFileSync(filePath, "utf8");
    } catch {
        return "export default {};";
    }

    const importRegex = /(import|export)\s+(?:type\s+)?\{([^}]+)\}\s+from\s+['"]@shared\/[^'"]*['"]/g;
    const names = new Set<string>();
    let m: RegExpExecArray | null;

    while ((m = importRegex.exec(content)) !== null) {
        for (const raw of m[2].split(",")) {
            const name = raw
                .trim()
                .replace(/^type\s+/, "") // strip inline `type` keyword
                .split(/\s+as\s+/)[0] // take the original name, not the alias
                .trim();

            if (name && /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(name)) names.add(name);
        }
    }

    if (names.size === 0) return "export default {};";

    return [...names].map((n) => `export const ${n} = () => {};`).join("\n");
}

// Write stub to a real temp file so Bun can resolve it from any context
// (virtual namespaces break when @shared/* is imported transitively from
// symlinked pro-project files).
const tmpStub = path.join(os.tmpdir(), `shared-stub-${process.pid}.ts`);

fs.writeFileSync(tmpStub, buildSharedStubContent(workflowPath));

plugin({
    name: "stub-shared-imports",
    setup (build) {
        build.onResolve({filter: /^@shared\//}, (args) => {
            const relativePath = args.path.slice("@shared/".length);
            const actualPath = path.resolve(ROOT_DIR, "shared", `${relativePath}.ts`);

            if (fs.existsSync(actualPath)) {
                return {path: actualPath};
            }

            return {path: tmpStub};
        });
    },
});

let mod: Record<string, unknown>;

try {
    mod = await import(workflowPath);
} catch (err) {
    console.error(`[extract-node-schema] import failed for ${workflowPath}: ${err}`);
    process.exit(2);
}

const schemaExport = Object.entries(mod).find(
    ([key, val]) => key.endsWith("Schema") && typeof (val as any)?.parse === "function"
);

if (!schemaExport) {
    console.error(`[extract-node-schema] no *Schema export found in ${workflowPath}`);
    process.exit(3);
}

const [, schema] = schemaExport;
const jsonSchema = zodToJsonSchema(schema as any, {
    name: nodeType,
    errorMessages: false,
    $refStrategy: "none",
}) as any;

const resolved = jsonSchema.definitions?.[nodeType] ?? jsonSchema;

// Write to stdout so the parent process can collect the result without temp files
process.stdout.write(JSON.stringify({nodeType, schema: resolved}));

try { fs.unlinkSync(tmpStub); } catch { /* best-effort cleanup */ }
