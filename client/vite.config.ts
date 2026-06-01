import {defineConfig} from 'vite'
import react from '@vitejs/plugin-react'
import svgr from 'vite-plugin-svgr'
import path from 'path'
import {BACKEND_PORT} from '../shared/constants';
import {readFileSync} from 'fs';
import {preprocessor} from "../plugins/preprocessor";


const pkg = JSON.parse(readFileSync(path.resolve(__dirname, '../package.json'), 'utf-8'));

function getBuildFlag (name: string): boolean {
    const envValue = process.env[name];

    if (envValue !== undefined) {
        return envValue === "true" || envValue === "1" || envValue === "yes";
    }

    const arg = process.argv.find(arg =>
        arg === name ||
        arg === `--${name}` ||
        arg.startsWith(`${name}=`) ||
        arg.startsWith(`--${name}=`)
    );

    if (!arg) {
        return false;
    }

    if (arg.includes("=")) {
        const value = arg.split("=")[1];

        return value === "true" || value === "1" || value === "yes";
    }

    return true;
}

// https://vite.dev/config/
// eslint-disable-next-line no-restricted-exports
export default defineConfig({
    define: {
        '__APP_VERSION__': JSON.stringify(pkg.version),
    },
    plugins: [
        preprocessor({
            defines: {
                LOGS: getBuildFlag("LOGS"),
            },
        }),
        react(),
        svgr({
            svgrOptions: {
                icon: true,
                exportType: 'default',
            },
            include: '**/*.svg',
        }),
    ],
    resolve: {
        preserveSymlinks: true,
        alias: {
            '@shared': path.resolve(__dirname, '../shared'),
        }
    },
    server: {
        host: '0.0.0.0',
        port: 8080,
        proxy: {
            '/graphql': `http://localhost:${BACKEND_PORT}`
        },
    }
})
