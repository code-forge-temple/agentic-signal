import {defineConfig} from 'vitest/config'
import path from 'path'


// Separate from vite.config.ts on purpose — keeps test-only concerns (environment,
// setup files) out of the dev/build config instead of merging them together.
// eslint-disable-next-line no-restricted-exports
export default defineConfig({
    resolve: {
        alias: {
            '@shared': path.resolve(__dirname, '../shared'),
        }
    },
    test: {
        // jsdom globally (not per-file) — this is a React project, and jsdom also gives
        // pure-logic tests a working `localStorage`/`document` for free, no manual stubs.
        environment: 'jsdom',
        setupFiles: ['./vitest.setup.ts'],
    }
})
