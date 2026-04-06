import {defineConfig} from 'vite'
import react from '@vitejs/plugin-react'
import svgr from 'vite-plugin-svgr'
import path from 'path'
import {BACKEND_PORT} from '../shared/constants';
import {readFileSync} from 'fs';


const pkg = JSON.parse(readFileSync(path.resolve(__dirname, '../package.json'), 'utf-8'));

// https://vite.dev/config/
// eslint-disable-next-line no-restricted-exports
export default defineConfig({
    define: {
        '__APP_VERSION__': JSON.stringify(pkg.version),
    },
    plugins: [
        react(),
        svgr({
            svgrOptions: {
                icon: true,
                exportType: 'default',
            },
            include: '**/*.svg',
        })
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
