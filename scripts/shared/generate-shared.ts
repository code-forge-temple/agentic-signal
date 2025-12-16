import fs from "fs";
import path from "path";
import mustache from "mustache";


function getFoldersWithTypes (dir: string): string[] {
    return fs
        .readdirSync(dir)
        .filter((f) => {
            const folderPath = path.join(dir, f);

            return (
                fs.statSync(folderPath).isDirectory() &&
                fs.existsSync(path.join(folderPath, "types.ts"))
            );
        });
}

export function generateShared () {
    const serverToolsDir = path.resolve("server/tools");
    const serverNodesDir = path.resolve("server/nodes");
    const sharedDir = path.resolve("shared");
    const templatePath = path.join(sharedDir, "types.gen.mustache");
    const outputPath = path.join(sharedDir, "types.gen.ts");

    const toolTypes = getFoldersWithTypes(serverToolsDir).map(tool => ({tool}));
    const nodeTypes = getFoldersWithTypes(serverNodesDir).map(node => ({node}));

    const template = fs.readFileSync(templatePath, "utf8");
    const content = mustache.render(template, {toolTypes, nodeTypes});

    fs.writeFileSync(outputPath, content);

    console.log(`Generated: ${outputPath}`);
}