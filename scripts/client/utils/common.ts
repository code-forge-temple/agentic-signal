import fs from "fs";
import path from "path";

export const capitalize = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);

export function hasDescriptorFile (folderPath: string): boolean {
    return (
        fs.existsSync(path.join(folderPath, "descriptor.ts")) ||
        fs.existsSync(path.join(folderPath, "descriptor.tsx"))
    );
}