import fs from "fs";
import path from "path";
import {capitalize, hasDescriptorFile} from "./common";


export function getToolFoldersWithDescriptor (dir: string): string[] {
    return fs
        .readdirSync(dir)
        .filter((f) => {
            const folderPath = path.join(dir, f);

            return fs.statSync(folderPath).isDirectory() && hasDescriptorFile(folderPath);
        });
}

export function getToolDescriptorInfo (folder: string) {
    const descriptorName = `${capitalize(folder)}Descriptor`;

    return {folder, descriptorName};
}