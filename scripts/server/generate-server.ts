import fs from "fs";
import path from "path";
import mustache from "mustache";

function getFoldersWithMod (dir: string): string[] {
    return fs
        .readdirSync(dir)
        .filter((f) => {
            const folderPath = path.join(dir, f);

            return (
                fs.statSync(folderPath).isDirectory() &&
                fs.existsSync(path.join(folderPath, "mod.ts"))
            );
        });
}

function hasTypeDefs (folderPath: string): boolean {
    const modPath = path.join(folderPath, "mod.ts");
    const schemaPath = path.join(folderPath, "schema.ts");

    if (fs.existsSync(modPath)) {
        const modContent = fs.readFileSync(modPath, "utf8");

        if (
            /export\s+\*\s+from\s+["']\.\/schema\.ts["'];?/.test(modContent) ||
            /export\s+const\s+typeDefs\s*=/.test(modContent) ||
            /export\s*\{\s*typeDefs\s*\}/.test(modContent)
        ) {
            if (fs.existsSync(schemaPath)) {
                const schemaContent = fs.readFileSync(schemaPath, "utf8");

                return /export\s+const\s+typeDefs\s*=/.test(schemaContent) ||
                       /export\s*\{\s*typeDefs\s*\}/.test(schemaContent);
            }

            return /export\s+const\s+typeDefs\s*=/.test(modContent) ||
                   /export\s*\{\s*typeDefs\s*\}/.test(modContent);
        }
    }

    return false;
}

function hasSubscriptionDefs (folderPath: string): boolean {
    const modPath = path.join(folderPath, "mod.ts");
    const schemaPath = path.join(folderPath, "schema.ts");

    // Check if mod.ts exports subscriptionDefs
    if (fs.existsSync(modPath)) {
        const modContent = fs.readFileSync(modPath, "utf8");

        if (
            /export\s+\*\s+from\s+["']\.\/schema\.ts["'];?/.test(modContent) ||
            /export\s+const\s+subscriptionDefs\s*=/.test(modContent) ||
            /export\s*\{\s*subscriptionDefs\s*\}/.test(modContent)
        ) {
            // If mod.ts references schema.ts, check schema.ts
            if (fs.existsSync(schemaPath)) {
                const schemaContent = fs.readFileSync(schemaPath, "utf8");

                return /export\s+const\s+subscriptionDefs\s*=/.test(schemaContent) ||
                       /export\s*\{\s*subscriptionDefs\s*\}/.test(schemaContent);
            }

            return /export\s+const\s+subscriptionDefs\s*=/.test(modContent) ||
                   /export\s*\{\s*subscriptionDefs\s*\}/.test(modContent);
        }
    }

    return false;
}

function hasMutationDefs (folderPath: string): boolean {
    const modPath = path.join(folderPath, "mod.ts");
    const schemaPath = path.join(folderPath, "schema.ts");

    // Check if mod.ts exports mutationDefs (for future use)
    if (fs.existsSync(modPath)) {
        const modContent = fs.readFileSync(modPath, "utf8");

        if (
            /export\s+\*\s+from\s+["']\.\/schema\.ts["'];?/.test(modContent) ||
            /export\s+const\s+mutationDefs\s*=/.test(modContent) ||
            /export\s*\{\s*mutationDefs\s*\}/.test(modContent)
        ) {
            if (fs.existsSync(schemaPath)) {
                const schemaContent = fs.readFileSync(schemaPath, "utf8");

                return /export\s+const\s+mutationDefs\s*=/.test(schemaContent) ||
                       /export\s*\{\s*mutationDefs\s*\}/.test(schemaContent);
            }

            return /export\s+const\s+mutationDefs\s*=/.test(modContent) ||
                   /export\s*\{\s*mutationDefs\s*\}/.test(modContent);
        }
    }

    return false;
}

function generateRegistry ({
    baseDir,
    templateFile,
    outputFile,
    itemKey
}: {
    baseDir: string;
    templateFile: string;
    outputFile: string;
    itemKey: string;
}) {
    const templatePath = path.join(baseDir, templateFile);
    const outputPath = path.join(baseDir, outputFile);

    const folders = getFoldersWithMod(baseDir);
    const items = folders.map(name => {
        const folderPath = path.join(baseDir, name);

        return {
            [itemKey]: name,
            hasTypeDefs: hasTypeDefs(folderPath),
            hasSubscriptionDefs: hasSubscriptionDefs(folderPath),
            hasMutationDefs: hasMutationDefs(folderPath)
        };
    });

    const template = fs.readFileSync(templatePath, "utf8");
    const content = mustache.render(template, {[itemKey === "toolName" ? "tools" : "nodes"]: items});

    fs.writeFileSync(outputPath, content);
    console.log(`Generated: ${outputPath}`);
}

export function generateServer () {
    generateRegistry({
        baseDir: path.resolve("server/tools"),
        templateFile: "toolsRegistry.gen.mustache",
        outputFile: "toolsRegistry.gen.ts",
        itemKey: "toolName"
    });

    generateRegistry({
        baseDir: path.resolve("server/nodes"),
        templateFile: "nodesRegistry.gen.mustache",
        outputFile: "nodesRegistry.gen.ts",
        itemKey: "nodeName"
    });
}