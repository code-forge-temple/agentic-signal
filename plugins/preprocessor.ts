import type {Plugin} from "vite";


interface Options {
  defines: Record<string, boolean>;
}

function escapeRegex (str: string) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function preprocessor (options: Options): Plugin {
    return {
        name: "preprocessor",
        enforce: "pre",

        transform (code: string, id: string) {
            const path = id.split("?")[0];

            if (!/\.(ts|tsx|js|jsx)$/.test(path)) {
                return null;
            }

            let result = code;

            for (const [key, value] of Object.entries(options.defines)) {
                const escapedKey = escapeRegex(key);
                const regex = new RegExp(
                    `/\\*\\s*#if\\s+${escapedKey}\\s*\\*/([\\s\\S]*?)/\\*\\s*#endif\\s*\\*/`,
                    "g"
                );

                result = result.replace(
                    regex,
                    value ? "$1" : ""
                );
            }

            return result === code ? null : result;
        },
    };
}