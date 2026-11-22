/**
 * The scratchpad's own configuration, kept here: `scratch new` writes a file that is missing, `scratch check` names one
 * that differs, and the slow test of the templates builds its scratchpad from these texts. So CI reads nothing of the
 * scratchpad (decision "the scratchpad", 2026-11-22, its install: out of the workspaces, its own lock). The
 * package.json is written only when missing: an experiment's libraries change it afterwards.
 *
 * @packageDocumentation
 */
import * as A from "effect/Array"
import type { TemplateFile } from "./Scratch.templates.ts"

const lines = (all: ReadonlyArray<string>): string => `${A.join(all, "\n")}\n`

/**
 * The scratchpad's files, from its folder.
 *
 * @category data
 */
export const scratchpadFiles: ReadonlyArray<TemplateFile> = [
  {
    name: "package.json",
    text: lines([
      "{",
      '  "name": "@inventory/scratchpad",',
      '  "version": "0.0.0",',
      '  "private": true,',
      '  "description": "A place to try an idea against the repository\'s own packages, which resolve from the root\'s install. It lists only the libraries an experiment added, installed here with their own lockfile",',
      '  "license": "MIT",',
      '  "type": "module",',
      '  "scripts": {',
      '    "types": "tsrs -p tsconfig.json",',
      '    "tests": "vitest run",',
      '    "serve": "vite --config vite.config.ts"',
      "  },",
      '  "dependencies": {},',
      '  "devDependencies": {}',
      "}"
    ])
  },
  {
    name: "tsconfig.json",
    text: lines([
      "{",
      "  // One project for every experiment: the repository's profile with nothing turned off, so the type-checker and the",
      "  // Effect diagnostics say of an experiment what they would say of a package. Nothing but `bun run scratch:check`",
      "  // reads it. An experiment may draw a screen, so the browser's types and JSX are on. The scratchpad's own configuration",
      "  // files are in it too: the experiments' isolation (their port, their cache) rests on them.",
      '  "extends": "../tsconfig.base.json",',
      '  "$schema": "../node_modules/@effect/tsgo/schema.json",',
      '  "compilerOptions": {',
      '    "lib": ["ESNext", "DOM", "DOM.Iterable"],',
      '    "module": "esnext",',
      '    "moduleResolution": "bundler",',
      '    "types": ["node", "vite/client"],',
      '    "jsx": "react-jsx"',
      "  },",
      '  "include": ["experiments", "*.config.ts"]',
      "}"
    ])
  },
  {
    name: "vitest.config.ts",
    text: lines([
      'import { defineConfig } from "vitest/config"',
      "",
      "// Every experiment's tests, on Node as the repository's tests run. An empty scratchpad passes. The limits are the",
      "// repository's (vitest.shared.ts at the root), written out: the scratchpad keeps its own lockfile and imports",
      "// nothing from the workspaces.",
      "export default defineConfig({",
      "  test: {",
      '    include: ["experiments/**/*.test.{ts,tsx}"],',
      "    passWithNoTests: true,",
      "    testTimeout: 30_000,",
      "    hookTimeout: 60_000",
      "  }",
      "})"
    ])
  },
  {
    name: "vite.config.ts",
    text: lines([
      'import tailwindcss from "@tailwindcss/vite"',
      'import react from "@vitejs/plugin-react"',
      'import { defineConfig } from "vite"',
      "",
      "// Serves one experiment's page: `bun run scratch:serve experiments/<name>`. Its cache is that experiment's own, in its",
      "// ignored `.state` folder (a relative `cacheDir` is read from the folder served). Its port is the first free one from",
      "// 5273 upward, so two experiments can be served at once, and never the app's 5173. The app's build never reads this",
      "// file or an experiment.",
      "export default defineConfig({",
      "  plugins: [react(), tailwindcss()],",
      '  cacheDir: ".state/vite",',
      "  server: { port: 5273, strictPort: false }",
      "})"
    ])
  }
]
