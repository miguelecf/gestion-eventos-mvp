import fs from 'node:fs'
import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

const boundaryMessage = 'Ver docs/arquitectura.md#frontend'
const featureDirectories = fs.readdirSync('src/features', { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)

const restrictedFeatureImports = (featureNames) => ({
  'no-restricted-imports': [
    'error',
    {
      paths: [{ name: '@/features', message: boundaryMessage }],
      patterns: featureNames.flatMap((name) => [
        { group: [`@/features/${name}`, `@/features/${name}/**`], message: boundaryMessage },
      ]),
    },
  ],
})

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['src/services/**', 'src/store/**'],
    rules: restrictedFeatureImports(['*']),
  },
  ...featureDirectories.map((feature) => ({
    files: [`src/features/${feature}/**`],
    rules: restrictedFeatureImports(
      featureDirectories.filter((other) => other !== feature && other !== 'auth'),
    ),
  })),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs['recommended-latest'],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
])
