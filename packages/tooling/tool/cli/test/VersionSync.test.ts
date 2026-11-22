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

  it.effect(
    "Node's types are for the Node that engines and the workflows name, or a person writes the newest of it",
    () =>
      Effect.gen(function* () {
        const result = yield* run(
          {
            "package.json": json({
              name: "root",
              workspaces: ["packages/*"],
              engines: { node: ">=22" },
              devDependencies: { "@types/node": "^22.20.5" }
            }),
            ".github/workflows/ci.yml": workflow("24", "v4", ["          bun-version-file: .bun-version"]),
            "packages/a/package.json": lines([
              "{",
              '  "name": "@x/a",',
              '  "devDependencies": {',
              '    "@types/node": "^24.19.2"',
              "  }",
              "}"
            ])
          },
          ["packages/a/package.json"]
        )
        const problem =
          "err:   packages/a/package.json: line 4: @types/node ^24.19.2 is not for Node 22, which `engines.node` and the workflows name: write the newest 22.x (`bun info @types/node@22 version`), then `bun install`"
        expect(result.before).toEqual([
          "err: version-sync FAIL  1 place differs from what it is derived from (`bun run version-sync -- --write` writes it); 1 problem needs a person, and no command repairs it",
          "err:   .github/workflows/ci.yml:7  Node's version, from `engines.node` of the root's package.json: found 24, expected 22",
          problem
        ])
        // The workflow is written; the types' version is the person's, since only the registry knows the newest 22.x.
        expect(result.files["packages/a/package.json"]).toContain('"@types/node": "^24.19.2"')
        expect(result.after).toEqual([
          "err: version-sync FAIL  1 problem needs a person, and no command repairs it",
          problem
        ])
      })
  )

  it.effect(
    "a write leaves nothing for the next check when an Effect package lags `effect`, type-fest's pin included",
    () =>
      Effect.gen(function* () {
        const result = yield* run(
          {
            "package.json": json({ name: "root", workspaces: ["packages/*"] }),
            "packages/a/package.json": json({
              name: "@x/a",
              dependencies: { effect: "4.2.0", "type-fest": "^6.2.0" },
              devDependencies: { "@effect/vitest": "4.1.5" }
            }),
            "packages/cli/package.json": json({ name: "@beep/repo-cli" }),
            "packages/cli/src/commands/Vendor/VendorSync.rules.ts": lines([
              'const kit = [["@effect/vitest", "4.1.5"]]',
              'const versionOf = (name: string) => (name === "type-fest" ? "^6.0.1" : "workspace:*")'
            ])
          },
          ["packages/cli/src/commands/Vendor/VendorSync.rules.ts"]
        )
        expect(result.files).toEqual({
          "packages/cli/src/commands/Vendor/VendorSync.rules.ts": lines([
            'const kit = [["@effect/vitest", "4.2.0"]]',
            'const versionOf = (name: string) => (name === "type-fest" ? "^6.2.0" : "workspace:*")'
          ])
        })
        // One write, and the next check agrees.
        expect(result.after[0]).toMatch(/^out: version-sync OK /)
      })
  )

  it.effect("a value in a comment is not a place, and a value that only looks like a version is left alone", () =>
    Effect.gen(function* () {
      const workflow = lines([
        "jobs:",
        "  check:",
        "    steps:",
        "      # node-version: 20 broke the build once",
        "      - uses: actions/setup-node@v4 # node-version: 18",
        "        with:",
        "          node-version: lts/*",
        "      - uses: actions/checkout@0123456789abcdef0123456789abcdef01234567 # v4.2.2"
      ])
      const wrangler = lines([
        "{",
        '  // "compatibility_date": "2025-06-01" was needed once',
        '  "compatibility_date": "2026-11-01"',
        "}"
      ])
      const result = yield* run(
        {
          ".bun-version": "1.4.4\n",
          "package.json": json({
            name: "root",
            workspaces: ["apps/*", "packages/*"],
            engines: { node: ">=22" },
            packageManager: "bun@1.4.4+sha512.abc123"
          }),
          ".github/workflows/ci.yml": lines(["jobs:", "  check:", "    steps:", "      - uses: actions/checkout@v5"]),
          ".github/workflows/deploy.yml": workflow,
          "apps/shop/package.json": json({ name: "@x/shop" }),
          "apps/shop/wrangler.jsonc": lines(["{", '  "compatibility_date": "2026-11-01"', "}"]),
          "packages/d1/package.json": json({ name: "@x/d1" }),
          "packages/d1/wrangler.test.jsonc": wrangler
        },
        [".github/workflows/deploy.yml", "packages/d1/wrangler.test.jsonc", "package.json"]
      )
      expect(result.before[0]).toMatch(/^out: version-sync OK /)
      expect(result.files[".github/workflows/deploy.yml"]).toBe(workflow)
      expect(result.files["packages/d1/wrangler.test.jsonc"]).toBe(wrangler)
      expect(result.files["package.json"]).toContain('"packageManager":"bun@1.4.4+sha512.abc123"')
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

  it.effect(
    "a catalogued package that follows `effect`, written as a version, is named once: `catalog:`, never the version too",
    () =>
      Effect.gen(function* () {
        const result = yield* run(
          {
            "package.json": json({
              name: "root",
              workspaces: ["packages/*"],
              catalog: { effect: "4.1.5", "@effect/vitest": "4.1.5" }
            }),
            "packages/a/package.json": json({
              name: "@x/a",
              dependencies: { effect: "catalog:" },
              devDependencies: { "@effect/vitest": "4.1.4" }
            })
          },
          ["package.json", "packages/a/package.json"]
        )
        expect(result.before).toEqual([
          "err: version-sync FAIL  1 place differs from what it is derived from (`bun run version-sync -- --write` writes it)",
          "err:   packages/a/package.json:1  `@effect/vitest`, which the catalog of the root's package.json holds (then `bun install`): found 4.1.4, expected catalog:"
        ])
        expect(result.files["packages/a/package.json"]).toEqual(
          json({
            name: "@x/a",
            dependencies: { effect: "catalog:" },
            devDependencies: { "@effect/vitest": "catalog:" }
          })
        )
      })
  )

  it.effect(
    "a version written beside the catalog is a place that differs: the catalog holds it, so it says `catalog:`",
    () =>
      Effect.gen(function* () {
        const result = yield* run(
          {
            "package.json": json({
              name: "root",
              workspaces: ["packages/*"],
              devDependencies: { react: "catalog:" },
              catalog: { effect: "4.1.5", react: "19.2.0" }
            }),
            "packages/a/package.json": json({ name: "@x/a", dependencies: { effect: "4.1.4", react: "catalog:" } }),
            "packages/b/package.json": json({
              name: "@x/b",
              dependencies: { effect: "catalog:", "left-pad": "1.3.0" },
              peerDependencies: { react: "^19.0.0" }
            })
          },
          ["packages/a/package.json", "packages/b/package.json"]
        )
        expect(result.before).toEqual([
          "err: version-sync FAIL  2 places differ from what they are derived from (`bun run version-sync -- --write` writes them)",
          "err:   packages/a/package.json:1  `effect`, which the catalog of the root's package.json holds (then `bun install`): found 4.1.4, expected catalog:",
          "err:   packages/b/package.json:1  `react`, which the catalog of the root's package.json holds (then `bun install`): found ^19.0.0, expected catalog:"
        ])
        expect(result.files).toEqual({
          "packages/a/package.json": json({ name: "@x/a", dependencies: { effect: "catalog:", react: "catalog:" } }),
          "packages/b/package.json": json({
            name: "@x/b",
            dependencies: { effect: "catalog:", "left-pad": "1.3.0" },
            peerDependencies: { react: "catalog:" }
          })
        })
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
          ])
        },
        ["package.json", "packages/infra/package.json"]
      )
      expect(result.before).toEqual([
        "err: version-sync FAIL  2 places differ from what they are derived from (`bun run version-sync -- --write` writes them)",
        "err:   package.json:5  a kept package's override, from vendor/alchemy/sources.json: found file:vendor/alchemy/alchemy.run-cloudflare-aaa1111.tgz, expected file:vendor/alchemy/alchemy.run-cloudflare-bbb2222.tgz",
        "err:   packages/infra/package.json:4  a kept package's version and commit, from vendor/alchemy/sources.json: found 2.0.0-beta.87-aaa1111, expected 2.0.0-beta.88-bbb2222"
      ])
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

  it.effect("the scratchpad is not read: its libraries are its experiments', at their own versions", () =>
    Effect.gen(function* () {
      const scratch = json({ name: "@x/scratchpad", dependencies: { "left-pad": "^1.0.0", effect: "4.1.4" } })
      const result = yield* run(
        {
          "package.json": json({ name: "root", workspaces: ["packages/*"] }),
          "packages/kernel/package.json": json({ name: "@x/kernel", dependencies: { effect: "4.1.5" } }),
          "scratchpad/package.json": scratch
        },
        ["scratchpad/package.json"]
      )
      expect(result.before[0]).toMatch(/^out: version-sync OK /)
      expect(result.files).toEqual({ "scratchpad/package.json": scratch })
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
