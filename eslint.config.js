import js from '@eslint/js'
import {defineConfig, globalIgnores} from 'eslint/config'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import {codeHealthConfig} from './eslint.code-health.js'

export default defineConfig(
    globalIgnores(['dist', 'src-tauri', '**/*.gen.ts']),
    {
        extends: [js.configs.recommended, tseslint.configs.recommended],
        files: ['**/*.{ts,tsx}'],
        languageOptions: {
            ecmaVersion: 2020,
            globals: globals.browser,
            parserOptions: {
                // type-aware rules below (no-floating-promises etc.) need the TS program for each file
                projectService: {
                    // not in any tsconfig (adding them would pull them into `tsc -b`)
                    allowDefaultProject: ['client/vitest.config.ts', 'client/vitest.setup.ts'],
                },
                tsconfigRootDir: import.meta.dirname,
            },
        },
        plugins: {
            'react-hooks': reactHooks,
            'react-refresh': reactRefresh,
        },
        rules: {
            ...reactHooks.configs.recommended.rules,
            'no-restricted-exports': ['error', {
                'restrictDefaultExports': {
                    'direct': true,
                    'named': false,
                    'defaultFrom': true,
                    'namedFrom': false,
                    'namespaceFrom': false
                }
            }],
            'react-refresh/only-export-components': [
                'warn',
                { allowConstantExport: true },
            ],
            "@typescript-eslint/no-floating-promises": "error", // a promise is awaited, caught, or marked `void`
            "@typescript-eslint/no-misused-promises": "error", // no async function where a void callback is expected
            "@typescript-eslint/unbound-method": "error", // methods handed around keep their `this`
            "@typescript-eslint/no-unsafe-assignment": "error", // `any` values don't spread silently
            'max-len': ['error', { code: 180 }],
            'indent': ['error', 4, { "SwitchCase": 1 }],
            '@typescript-eslint/no-explicit-any': 'off',
            'no-trailing-spaces': 'error', // Disallow trailing spaces
            'no-multi-spaces': 'error', // Disallow multiple spaces
            'no-irregular-whitespace': 'error', // Disallow irregular whitespace
            'space-in-parens': ['error', 'never'], // Enforce spacing inside parentheses
            'space-before-function-paren': ['error', 'always'], // Enforce spacing before function parenthesis
            'comma-spacing': ['error', { before: false, after: true }], // Enforce spacing after commas
            'object-curly-spacing': ['error', 'never'], // Enforce spacing inside curly braces
            'padding-line-between-statements': [
                'error',
                // Blank line before returns
                { blankLine: 'always', prev: '*', next: 'return' },
                
                // Blank line after variable declarations
                { blankLine: 'always', prev: ['const', 'let', 'var'], next: '*' },
                { blankLine: 'any', prev: ['const', 'let', 'var'], next: ['const', 'let', 'var'] },
                
                // Blank line after imports
                { blankLine: 'always', prev: 'import', next: '*' },
                { blankLine: 'any', prev: 'import', next: 'import' },
                
                // Blank line before exports
                { blankLine: 'always', prev: '*', next: 'export' },
                
                // Blank line around functions
                { blankLine: 'always', prev: '*', next: 'function' },
                { blankLine: 'always', prev: 'function', next: '*' },
                
                // Blank line around classes
                { blankLine: 'always', prev: '*', next: 'class' },
                { blankLine: 'always', prev: 'class', next: '*' },
                
                // Blank line before control flow
                { blankLine: 'always', prev: '*', next: ['if', 'for', 'while', 'switch', 'try'] },

                // Blank line after control flow
                { blankLine: 'always', prev: ['if', 'for', 'while', 'switch', 'try'], next: '*' },

                // Blank line after blocks
                { blankLine: 'always', prev: 'block', next: '*' }
            ],
        },
    },
    {
        // Deno server resolvers keep underscore-prefixed GraphQL args (_parent, _args, _context)
        // for signature clarity even when unused; base no-unused-vars is off via tseslint recommended.
        files: ['server/**/*.{ts,tsx}'],
        // Plain TypeScript can't resolve Deno's `npm:`/`jsr:` specifiers or the `Deno` global, so values
        // from them come through as error types and no-unsafe-assignment flags them falsely.
        rules: {
            '@typescript-eslint/no-unused-vars': 'off',
            '@typescript-eslint/no-unsafe-assignment': 'off',
        },
    },
    ...codeHealthConfig,
)
