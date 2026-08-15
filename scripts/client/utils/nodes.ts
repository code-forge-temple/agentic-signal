import fs from "fs";
import path from "path";
import {capitalize, hasDescriptorFile} from "./common";

// Descriptors aren't executed at generation time (they import React components, zod
// schemas, etc.), so the `order` field driving nodes-dock placement is read via a
// regex over the source text rather than importing the module.
function getDescriptorOrder (folder: string, folderPath: string): number {
    const descriptorPath = fs.existsSync(path.join(folderPath, "descriptor.ts"))
        ? path.join(folderPath, "descriptor.ts")
        : path.join(folderPath, "descriptor.tsx");
    const content = fs.readFileSync(descriptorPath, "utf8");
    const match = /order:\s*(-?\d+)/.exec(content);

    if (!match) {
        throw new Error(`"${folder}" is missing the required "order" field in its descriptor.`);
    }

    return Number(match[1]);
}

export function getNodeFoldersWithDescriptor (dir: string): string[] {
    const folders = fs
        .readdirSync(dir)
        .filter((f) => {
            const folderPath = path.join(dir, f);

            return fs.statSync(folderPath).isDirectory() && hasDescriptorFile(folderPath);
        });

    return folders
        .map((folder) => ({folder, order: getDescriptorOrder(folder, path.join(dir, folder))}))
        .sort((a, b) => a.order - b.order)
        .map(({folder}) => folder);
}

export function getNodeDescriptorInfo (folder: string) {
    const descriptorName = `${capitalize(folder)}Descriptor`;
    const typeName = `${capitalize(folder)}`;
    const typeConst = `${folder.toUpperCase()}_NODE_TYPE`;

    return {folder, descriptorName, typeName, typeConst};
}