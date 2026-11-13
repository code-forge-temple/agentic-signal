import {defineConfig} from 'vitest/config'
import path from 'path'


// Separate from vite.config.ts on purpose — keeps test-only concerns (environment,
// setup files) out of the dev/build config instead of merging them together.
// eslint-disable-next-line no-restricted-exports
export default defineConfig({
    resolve: {
        alias: {
            '@shared': path.resolve(__dirname, '../shared'),
        },
        preserveSymlinks: true,
    },
    test: {
        // Node by default: setting up jsdom takes seconds per file. A file that renders, or uses
        // document, window or localStorage, says `// @vitest-environment jsdom` under its header.
        environment: 'node',
        // Worker threads start faster than a process per test file (on Windows, about half the run).
        pool: 'threads',
        setupFiles: ['./vitest.setup.ts'],
        // iconoir-react can only be imported whole (1,385 icons, a file each): bundled once instead of loaded file by file.
        deps: {
            optimizer: {
                ssr: {enabled: true, include: ['iconoir-react']},
                client: {enabled: true, include: ['iconoir-react']},
            },
        },
    }
})
