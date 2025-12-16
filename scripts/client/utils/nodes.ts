import fs from "fs";
import path from "path";
import {capitalize, hasDescriptorFile} from "./common";


export function getNodeFoldersWithDescriptor (dir: string): string[] {
    return fs
        .readdirSync(dir)
        .filter((f) => {
            const folderPath = path.join(dir, f);

            return fs.statSync(folderPath).isDirectory() && hasDescriptorFile(folderPath);
        });
}

export function getNodeDescriptorInfo (folder: string) {
    const descriptorName = `${capitalize(folder)}Descriptor`;
    const typeName = `${capitalize(folder)}`;
    const typeConst = `${folder.toUpperCase()}_NODE_TYPE`;

    return {folder, descriptorName, typeName, typeConst};
}