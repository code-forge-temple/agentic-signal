import {defineConfig} from 'vite'
import react from '@vitejs/plugin-react'
import svgr from 'vite-plugin-svgr'
import path from 'path'
import {BACKEND_PORT} from '../shared/constants';

// https://vite.dev/config/
// eslint-disable-next-line no-restricted-exports
export default defineConfig({
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
        alias: {
            '@shared': path.resolve(__dirname, '../shared'),
        }
    },
    server: {
        host: '0.0.0.0',
        proxy: {
            '/graphql': `http://localhost:${BACKEND_PORT}`
        }
    }
})
