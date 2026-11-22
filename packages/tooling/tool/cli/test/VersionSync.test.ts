import { describe, expect, it } from "@effect/vitest"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as Str from "effect/String"
import { asWritten, named, versionSync } from "../src/commands/VersionSync/VersionSync.rules.ts"
import { syncSentence } from "../src/Sync.schema.ts"
import { cycle, lines } from "./support/sync.ts"
import { json } from "./support/tree.ts"

const run = (tree: Record<string, string>, files: ReadonlyArray<string> = []) =>
  cycle({ tree, command: versionSync, sentence: syncSentence, files })

const workflow = (node: string, checkout: string, bun: ReadonlyArray<string>) =>
  lines([
    "jobs:",
    "  check:",
    "    steps:",
    `      - uses: actions/checkout@${checkout}`,
    "      - uses: actions/setup-node@v4",
    "        with:",
    `          node-version: ${node}`,
    "      - uses: oven-sh/setup-bun@v2",
    "        with:",
    ...bun
  ])

describe("version-sync", () => {
  it.effect("bun, Node and an action's version follow their one source, in files and in sentences", () =>
    Effect.gen(function* () {
      const result = yield* run(
        {
          ".bun-version": "1.4.4\n",
          "package.json": lines([
            "{",
            '  "name": "root",',
            '  "workspaces": ["packages/*"],',
            '  "engines": { "node": ">=22" },',
            '  "packageManager": "bun@1.4.3"',
            "}"
          ]),
          ".github/workflows/ci.yml": workflow("22", "v5", ["          bun-version-file: .bun-version"]),
          ".github/workflows/deploy.yml": workflow("20", "v4", ["          bun-version: 1.4.2"]),
          "README.md": "Needs Bun 1.4.3 and Node 20 or newer. One script needs Node 22.18 or newer.\n",
          // A record of what was true when it was written: never rewritten.
          "goals/setup/PLAN.md": "Measured on Bun 1.4.0 and Node 18 or newer.\n",
          "docs/qa/run.md": "Bun 1.3.9\n"
        },
        ["package.json", ".github/workflows/deploy.yml", "README.md", "goals/setup/PLAN.md", "docs/qa/run.md"]
      )
      expect(result.failed).toBe(true)
      expect(result.before).toEqual([
        "err: version-sync FAIL  6 places differ from what they are derived from (`bun run version-sync -- --write` writes them)",
        "err:   .github/workflows/deploy.yml:4  actions/checkout's version, from .github/workflows/ci.yml: found v4, expected v5",
        "err:   .github/workflows/deploy.yml:7  Node's version, from `engines.node` of the root's package.json: found 20, expected 22",
        "err:   .github/workflows/deploy.yml:10  `bun-version`, from .bun-version: found 1.4.2, expected 1.4.4",
        "err:   README.md:1  bun's version, from .bun-version: found 1.4.3, expected 1.4.4",
        "err:   README.md:1  Node's version, from `engines.node` of the root's package.json: found 20, expected 22",
        "err:   package.json:5  `packageManager`, from .bun-version: found 1.4.3, expected 1.4.4"
      ])
      expect(result.written[0]).toBe("out: version-sync  wrote 6 places in 3 files")
      expect(result.files).toEqual({
        "package.json": lines([
          "{",
          '  "name": "root",',
          '  "workspaces": ["packages/*"],',
          '  "engines": { "node": ">=22" },',
          '  "packageManager": "bun@1.4.4"',
          "}"
        ]),
        ".github/workflows/deploy.yml": workflow("22", "v5", ["          bun-version: 1.4.4"]),
        "README.md": "Needs Bun 1.4.4 and Node 22 or newer. One script needs Node 22.18 or newer.\n",
        "goals/setup/PLAN.md": "Measured on Bun 1.4.0 and Node 18 or newer.\n",
        "docs/qa/run.md": "Bun 1.3.9\n"
      })
      expect(result.after).toEqual(["out: version-sync OK  9 places agree with what they are derived from"])
      expect(result.again).toEqual(result.after)
    })
  )

  it.effect(
    "Effect's packages, the documents and what vendor sync writes follow the `effect` every package states",
    () =>
      Effect.gen(function* () {
        const vendorSync = (effect: string, vitest: string) =>
          lines([
            `const kit = [["effect", "${effect}"] as const, ["@effect/vitest", "${effect}"], ["vitest", "${vitest}"]]`
          ])
        const cli = (effect: string) =>
          json({
            name: "@beep/repo-cli",
            version: "0.2.0",
            dependencies: { effect, "@effect/platform-bun": effect, "@x/kernel": "workspace:*" },
            devDependencies: { "@effect/vitest": effect, vitest: "^5.1.0" }
          })
        const result = yield* run(
          {
            "package.json": json({
              name: "root",
              workspaces: ["packages/*"],
              devDependencies: { "@effect/tsgo": "0.70.0", typescript: "~7.0.2" }
            }),
            "packages/kernel/package.json": lines([
              "{",
              '  "name": "@x/kernel",',
              '  "dependencies": {',
              '    "@effect/sql-d1": "4.1.4",',
              '    "better-auth": "1.7.22",',
              '    "effect": "4.2.0"',
              "  },",
              '  "devDependencies": {',
              '    "@effect/tsgo": "0.70.0",',
              '    "@effect/vitest": "4.2.0",',
              '    "vitest": "^5.1.0"',
              "  }",
              "}"
            ]),
            "packages/cli/package.json": cli("4.2.0"),
            "packages/cli/src/bin.ts": 'Command.run(root, { version: "0.0.0" })\n',
            "packages/cli/src/commands/Vendor/VendorSync.rules.ts": vendorSync("4.1.4", "^5.0.0"),
            "CLAUDE.md": "This repo uses Effect 4.1. Checked in `effect` 4.1.4's source; Effect 4 only.\n",
            "docs/auth.md": "Better Auth 1.7.20 (pinned). TypeScript 7.0.1 with @effect/tsgo 0.68.1.\n",
            "docs/standards/schema.md":
              "No such schema in 4.1.4; side-effect 4.1.4 and @effect/vitest 4.1.4 are not Effect's, and no effect 1.5 s later.\n"
          },
          [
            "packages/kernel/package.json",
            "packages/cli/src/bin.ts",
            "packages/cli/src/commands/Vendor/VendorSync.rules.ts",
            "CLAUDE.md",
            "docs/auth.md",
            "docs/standards/schema.md"
          ]
        )
        expect(result.before).toEqual([
          "err: version-sync FAIL  10 places differ from what they are derived from (`bun run version-sync -- --write` writes them)",
          "err:   CLAUDE.md:1  Effect's version, from the `effect` the package.json files state: found 4.1, expected 4.2",
          "err:   CLAUDE.md:1  Effect's version, from the `effect` the package.json files state: found 4.1.4, expected 4.2.0",
          "err:   docs/auth.md:1  Better Auth's version, from the `better-auth` the package.json files state: found 1.7.20, expected 1.7.22",
          "err:   docs/auth.md:1  TypeScript's version, from the `typescript` the package.json files state: found 7.0.1, expected 7.0.2",
          "err:   docs/auth.md:1  @effect/tsgo's version, from the `@effect/tsgo` the package.json files state: found 0.68.1, expected 0.70.0",
          "err:   packages/cli/src/bin.ts:1  the CLI's version, from packages/cli/package.json: found 0.0.0, expected 0.2.0",
          "err:   packages/cli/src/commands/Vendor/VendorSync.rules.ts:1  the `effect` a vendored package is given, from the package.json files: found 4.1.4, expected 4.2.0",
          "err:   packages/cli/src/commands/Vendor/VendorSync.rules.ts:1  the `@effect/vitest` a vendored package is given, from the package.json files: found 4.1.4, expected 4.2.0",
          "err:   packages/cli/src/commands/Vendor/VendorSync.rules.ts:1  the `vitest` a vendored package is given, from the package.json files: found ^5.0.0, expected ^5.1.0",
          "err:   packages/kernel/package.json:4  an Effect package's version, from `effect`: found 4.1.4, expected 4.2.0"
        ])
        expect(result.files).toEqual({
          "packages/kernel/package.json": lines([
            "{",
            '  "name": "@x/kernel",',
            '  "dependencies": {',
            '    "@effect/sql-d1": "4.2.0",',
            '    "better-auth": "1.7.22",',
            '    "effect": "4.2.0"',
            "  },",
            '  "devDependencies": {',
            '    "@effect/tsgo": "0.70.0",',
            '    "@effect/vitest": "4.2.0",',
            '    "vitest": "^5.1.0"',
            "  }",
            "}"
          ]),
          "packages/cli/src/bin.ts": 'Command.run(root, { version: "0.2.0" })\n',
          "packages/cli/src/commands/Vendor/VendorSync.rules.ts": vendorSync("4.2.0", "^5.1.0"),
          "CLAUDE.md": "This repo uses Effect 4.2. Checked in `effect` 4.2.0's source; Effect 4 only.\n",
          "docs/auth.md": "Better Auth 1.7.22 (pinned). TypeScript 7.0.2 with @effect/tsgo 0.70.0.\n",
          "docs/standards/schema.md":
            "No such schema in 4.1.4; side-effect 4.1.4 and @effect/vitest 4.1.4 are not Effect's, and no effect 1.5 s later.\n"
        })
        expect(result.after[0]).toMatch(/^out: version-sync OK /)
        expect(result.again).toEqual(result.after)
      })
  )

  it.effect(
    "two packages at different versions of `effect` are a problem a person settles, and nothing is written",
    () =>
      Effect.gen(function* () {
        const result = yield* run(
          {
            "package.json": json({ name: "root", workspaces: ["packages/*"] }),
            "packages/a/package.json": json({ name: "@x/a", dependencies: { effect: "4.1.4" } }),
            "packages/b/package.json": json({ name: "@x/b", dependencies: { effect: "4.1.5" } }),
            "README.md": "Effect 4.1.3\n"
          },
          ["README.md"]
        )
        const problem = [
          "err: version-sync FAIL  1 problem needs a person, and no command repairs it",
          "err:   package.json: `effect` is asked for at more than one version (4.1.4 in packages/a/package.json; 4.1.5 in packages/b/package.json): nothing can follow it until they agree. `bun run deps:lint` names them"
        ]
        expect(result.before).toEqual(problem)
        expect(result.written).toEqual(problem)
        expect(result.files).toEqual({ "README.md": "Effect 4.1.3\n" })
      })
  )

  it.effect("with a catalog at the root, the catalog is the source", () =>
    Effect.gen(function* () {
      const result = yield* run(
        {
          "package.json": json({ name: "root", workspaces: ["packages/*"], catalog: { effect: "4.3.0" } }),
          "packages/a/package.json": json({ name: "@x/a", dependencies: { effect: "catalog:" } }),
          "README.md": "Effect 4.1.4\n"
        },
        ["README.md"]
      )
      expect(result.before[1]).toBe(
        "err:   README.md:1  Effect's version, from the `effect` the package.json files state: found 4.1.4, expected 4.3.0"
      )
      expect(result.files).toEqual({ "README.md": "Effect 4.3.0\n" })
      expect(result.again).toEqual(result.after)
    })
  )

  it.effect("the compatibility date follows the app's wrangler.jsonc, and Alchemy's packages follow `alchemy`", () =>
    Effect.gen(function* () {
      const stack = (date: string) =>
        lines([
          "export const worker = Worker({",
          `  compatibility: { date: "${date}", flags: ["nodejs_compat"] }`,
          "})"
        ])
      const result = yield* run(
        {
          "package.json": json({ name: "root", workspaces: ["apps/*", "packages/*"] }),
          "apps/shop/package.json": json({ name: "@x/shop" }),
          "apps/shop/wrangler.jsonc": lines(["{", "  // the date", '  "compatibility_date": "2026-11-01"', "}"]),
          "packages/d1/package.json": json({ name: "@x/d1" }),
          "packages/d1/wrangler.d1-test.jsonc": lines(["{", '  "compatibility_date": "2026-10-01"', "}"]),
          "packages/infra/package.json": lines([
            "{",
            '  "name": "@x/infra",',
            '  "dependencies": {',
            '    "@alchemy.run/cloudflare": "2.0.0-beta.86",',
            '    "alchemy": "2.0.0-beta.87"',
            "  }",
            "}"
          ]),
          "packages/infra/src/Shop.stack.ts": stack("2026-09-15"),
          "docs/infra.md": "Deployed with Alchemy 2.0.0-beta.80.\n"
        },
        [
          "packages/d1/wrangler.d1-test.jsonc",
          "packages/infra/package.json",
          "packages/infra/src/Shop.stack.ts",
          "docs/infra.md"
        ]
      )
      expect(result.before).toEqual([
        "err: version-sync FAIL  4 places differ from what they are derived from (`bun run version-sync -- --write` writes them)",
        "err:   docs/infra.md:1  Alchemy's version, from the `alchemy` the package.json files state: found 2.0.0-beta.80, expected 2.0.0-beta.87",
        "err:   packages/d1/wrangler.d1-test.jsonc:2  the compatibility date, from apps/shop/wrangler.jsonc: found 2026-10-01, expected 2026-11-01",
        "err:   packages/infra/package.json:4  an Alchemy package's version, from `alchemy`: found 2.0.0-beta.86, expected 2.0.0-beta.87",
        "err:   packages/infra/src/Shop.stack.ts:2  the compatibility date, from apps/shop/wrangler.jsonc: found 2026-09-15, expected 2026-11-01"
      ])
      expect(result.files).toEqual({
        "packages/d1/wrangler.d1-test.jsonc": lines(["{", '  "compatibility_date": "2026-11-01"', "}"]),
        "packages/infra/package.json": lines([
          "{",
          '  "name": "@x/infra",',
          '  "dependencies": {',
          '    "@alchemy.run/cloudflare": "2.0.0-beta.87",',
          '    "alchemy": "2.0.0-beta.87"',
          "  }",
          "}"
        ]),
        "packages/infra/src/Shop.stack.ts": stack("2026-11-01"),
        "docs/infra.md": "Deployed with Alchemy 2.0.0-beta.87.\n"
      })
      expect(result.again).toEqual(result.after)
      expect(result.after[0]).toMatch(/^out: version-sync OK /)
    })
  )

  it.effect("Alchemy kept as files: each dependency is its version at the pinned commit, each override its file", () =>
    Effect.gen(function* () {
      const result = yield* run(
        {
          "package.json": lines([
            "{",
            '  "name": "root",',
            '  "workspaces": ["packages/*"],',
            '  "overrides": {',
            '    "@alchemy.run/cloudflare": "file:vendor/alchemy/alchemy.run-cloudflare-aaa1111.tgz",',
            '    "alchemy": "file:vendor/alchemy/alchemy-bbb2222.tgz"',
            "  }",
            "}"
          ]),
          "vendor/alchemy/sources.json": json({
            commit: "bbb2222",
            packages: [
              { package: "alchemy", version: "2.0.0-beta.88", file: "alchemy-bbb2222.tgz" },
              {
                package: "@alchemy.run/cloudflare",
                version: "2.0.0-beta.88",
                file: "alchemy.run-cloudflare-bbb2222.tgz"
              }
            ]
          }),
          "packages/infra/package.json": lines([
            "{",
            '  "name": "@x/infra",',
            '  "dependencies": {',
            '    "@alchemy.run/cloudflare": "2.0.0-beta.87-aaa1111",',
            '    "alchemy": "2.0.0-beta.88-bbb2222"',
            "  }",
            "}"
          ]),
          // An experiment that uses a kept package asks for it as a package does.
          "scratchpad/package.json": json({
            name: "@x/scratchpad",
            dependencies: { "@alchemy.run/cloudflare": "2.0.0-beta.87-aaa1111" }
          })
        },
        ["package.json", "packages/infra/package.json", "scratchpad/package.json"]
      )
      expect(result.before).toEqual([
        "err: version-sync FAIL  3 places differ from what they are derived from (`bun run version-sync -- --write` writes them)",
        "err:   package.json:5  a kept package's override, from vendor/alchemy/sources.json: found file:vendor/alchemy/alchemy.run-cloudflare-aaa1111.tgz, expected file:vendor/alchemy/alchemy.run-cloudflare-bbb2222.tgz",
        "err:   packages/infra/package.json:4  a kept package's version and commit, from vendor/alchemy/sources.json: found 2.0.0-beta.87-aaa1111, expected 2.0.0-beta.88-bbb2222",
        "err:   scratchpad/package.json:1  the scratchpad's `@alchemy.run/cloudflare`, from the package.json files: found 2.0.0-beta.87-aaa1111, expected 2.0.0-beta.88-bbb2222"
      ])
      expect(result.files["scratchpad/package.json"]).toContain('"@alchemy.run/cloudflare":"2.0.0-beta.88-bbb2222"')
      expect(result.files["packages/infra/package.json"]).toContain(
        '"@alchemy.run/cloudflare": "2.0.0-beta.88-bbb2222"'
      )
      expect(result.files["package.json"]).toContain("file:vendor/alchemy/alchemy.run-cloudflare-bbb2222.tgz")
      expect(result.after[0]).toMatch(/^out: version-sync OK /)
      expect(result.again).toEqual(result.after)
    })
  )

  it.effect("a tsconfig's `$schema` is the installed Effect language service's, not the one in its repository", () =>
    Effect.gen(function* () {
      const result = yield* run(
        {
          "package.json": json({ name: "root", workspaces: ["packages/*"] }),
          "node_modules/@effect/tsgo/schema.json": "{}",
          "tsconfig.base.json": lines([
            "{",
            '  "$schema": "https://raw.githubusercontent.com/Effect-TS/tsgo/refs/heads/main/schema.json"',
            "}"
          ]),
          "packages/a/package.json": json({ name: "@x/a" }),
          "packages/a/tsconfig.json": lines([
            "{",
            '  "$schema": "https://raw.githubusercontent.com/Effect-TS/tsgo/refs/heads/main/schema.json"',
            "}"
          ])
        },
        ["tsconfig.base.json", "packages/a/tsconfig.json"]
      )
      expect(result.files).toEqual({
        "tsconfig.base.json": lines(["{", '  "$schema": "./node_modules/@effect/tsgo/schema.json"', "}"]),
        "packages/a/tsconfig.json": lines(["{", '  "$schema": "../../node_modules/@effect/tsgo/schema.json"', "}"])
      })
      expect(result.again).toEqual(result.after)
    })
  )

  it.effect("the scratchpad runs on the packages' versions, and an experiment's own library is left alone", () =>
    Effect.gen(function* () {
      const scratch = (effect: string, vitest: string) =>
        lines([
          "{",
          '  "name": "@x/scratchpad",',
          '  "dependencies": {',
          '    "@x/kernel": "workspace:*",',
          `    "effect": "${effect}",`,
          '    "zod": "^3.0.0"',
          "  },",
          '  "devDependencies": {',
          `    "vitest": "${vitest}"`,
          "  }",
          "}"
        ])
      const result = yield* run(
        {
          "package.json": json({ name: "root", workspaces: ["packages/*", "scratchpad"] }),
          "packages/kernel/package.json": json({
            name: "@x/kernel",
            dependencies: { effect: "4.1.5" },
            devDependencies: { vitest: "^5.1.1" }
          }),
          "scratchpad/package.json": scratch("4.1.4", "^5.1.0")
        },
        ["scratchpad/package.json"]
      )
      expect(result.before).toEqual([
        "err: version-sync FAIL  2 places differ from what they are derived from (`bun run version-sync -- --write` writes them)",
        "err:   scratchpad/package.json:5  the scratchpad's `effect`, from the package.json files: found 4.1.4, expected 4.1.5",
        "err:   scratchpad/package.json:9  the scratchpad's `vitest`, from the package.json files: found ^5.1.0, expected ^5.1.1"
      ])
      expect(result.files).toEqual({ "scratchpad/package.json": scratch("4.1.5", "^5.1.1") })
      expect(result.after).toEqual(["out: version-sync OK  2 places agree with what they are derived from"])
      expect(result.again).toEqual(result.after)
    })
  )

  it("reads a version as precisely as a sentence states it, and only after its own name", () => {
    expect(asWritten("4.2.0")("4.1")).toBe("4.2")
    expect(asWritten("4.2.0")("4.1.4")).toBe("4.2.0")
    const found = (text: string) =>
      A.map(A.fromIterable(Str.matchAll(named(["Effect", "effect"]))(text)), (match) => match[1])
    expect(found("Effect 4.1. `effect` 4.1.4's source, effect's 4.1.5 and Effect v4.2.0-beta.1.")).toEqual([
      "4.1",
      "4.1.4",
      "4.1.5",
      "4.2.0-beta.1"
    ])
    expect(found("Effect 4 only; side-effect 4.1.4; @effect/vitest 4.1.4; effect/Schema 4.1.4; in 4.1.4")).toEqual([])
  })
})
