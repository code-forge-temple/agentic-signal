import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default tseslint.config(
    { ignores: ['dist', 'src-tauri'] },
    {
        extends: [js.configs.recommended, ...tseslint.configs.recommended],
        files: ['**/*.{ts,tsx}'],
        languageOptions: {
            ecmaVersion: 2020,
            globals: globals.browser,
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
)
