import { describe, expect, it } from "@effect/vitest"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as R from "effect/Record"
import { configSync } from "../src/commands/ConfigSync/ConfigSync.rules.ts"
import { Repo } from "../src/Repo.service.ts"
import { syncSentence } from "../src/Sync.schema.ts"
import { cycle, lines } from "./support/sync.ts"
import { json } from "./support/tree.ts"

// An install that writes a lockfile from the scratchpad's package.json as it is when the install runs, as bun does:
// no network, nothing installed. A test then sees in bun.lock what the install was given.
const install = Effect.gen(function* () {
  const repo = yield* Repo
  const scratch = repo.join(repo.root, "scratchpad", "package.json")
  const text = (yield* repo.exists(scratch)) ? yield* repo.text(scratch) : ""
  yield* repo.write(repo.join(repo.root, "bun.lock"), `locked from: ${text}`)
  return { code: 0, output: "" }
})

const run = (tree: Record<string, string>, files: ReadonlyArray<string> = []) =>
  cycle({ tree, command: (mode) => configSync(mode, install), sentence: syncSentence, files })

// A package that already has every script turbo runs in it, so a test of something else stays about that.
const scripts = { check: "tsrs -p tsconfig.json", lint: "oxlint --quiet src" }
const agrees = (places: number) => [`out: config-sync OK  ${places} places agree with what they are derived from`]

describe("config-sync", () => {
  it.effect("writes syncpack's sources from the workspace patterns, and a second run changes nothing", () =>
    Effect.gen(function* () {
      const result = yield* run(
        {
          "package.json": json({ name: "root", workspaces: ["apps/*", "packages/*", "packages/group/*"] }),
          ".syncpackrc.json": lines([
            "{",
            "  // what syncpack reads",
            '  "source": ["package.json", "packages/*/package.json"],',
            '  "semverGroups": []',
            "}"
          ]),
          "apps/shop/package.json": json({ name: "@x/shop", scripts }),
          "apps/shop/tsconfig.json": "{}",
          "packages/kernel/package.json": json({ name: "@x/kernel", scripts }),
          "packages/kernel/tsconfig.json": "{}",
          "packages/group/web/package.json": json({ name: "@x/web", scripts }),
          "packages/group/web/tsconfig.json": "{}"
        },
        [".syncpackrc.json"]
      )
      expect(result.failed).toBe(true)
      expect(result.before).toEqual([
        "err: config-sync FAIL  1 place differs from what it is derived from (`bun run config-sync` writes it)",
        "err:   .syncpackrc.json:3  `source`, from the `workspaces` of package.json: found package.json, packages/*/package.json, expected package.json, apps/*/package.json, packages/*/package.json, packages/group/*/package.json"
      ])
      expect(result.written).toEqual([
        "out: config-sync  wrote 1 place in 1 file",
        "out:   .syncpackrc.json:3  `source`, from the `workspaces` of package.json: package.json, packages/*/package.json -> package.json, apps/*/package.json, packages/*/package.json, packages/group/*/package.json"
      ])
      expect(result.files[".syncpackrc.json"]).toBe(
        lines([
          "{",
          "  // what syncpack reads",
          '  "source": ["package.json", "apps/*/package.json", "packages/*/package.json", "packages/group/*/package.json"],',
          '  "semverGroups": []',
          "}"
        ])
      )
      expect(result.after).toEqual(agrees(16))
      expect(result.again).toEqual(agrees(16))
    })
  )

  it.effect("writes syncpack's catalog group from the root's catalog, and asks for the group when there is none", () =>
    Effect.gen(function* () {
      const root = json({
        name: "root",
        workspaces: ["packages/*"],
        catalog: { vitest: "^5.1.0", effect: "4.1.5" }
      })
      const packages = {
        "packages/kernel/package.json": json({ name: "@x/kernel", scripts, dependencies: { effect: "catalog:" } }),
        "packages/kernel/tsconfig.json": "{}"
      }
      const config = (dependencies: string) =>
        lines([
          "{",
          '  "source": ["package.json", "packages/*/package.json"],',
          '  "versionGroups": [',
          '    { "label": "kept files", "dependencies": ["alchemy"], "isIgnored": true },',
          `    { "label": "the catalog", "policy": "catalog", "dependencies": ${dependencies} },`,
          '    { "label": "after", "dependencies": ["react"], "isIgnored": true }',
          "  ]",
          "}"
        ])
      const result = yield* run({ "package.json": root, ".syncpackrc.json": config('["effect"]'), ...packages }, [
        ".syncpackrc.json"
      ])
      expect(result.before).toEqual([
        "err: config-sync FAIL  1 place differs from what it is derived from (`bun run config-sync` writes it)",
        "err:   .syncpackrc.json:5  the catalog group's `dependencies`, from the `catalog` of package.json: found effect, expected effect, vitest"
      ])
      expect(result.files[".syncpackrc.json"]).toBe(config('["effect", "vitest"]'))
      expect(result.again.length).toBe(1)
      const none = yield* run(
        {
          "package.json": root,
          ".syncpackrc.json": lines(["{", '  "source": ["package.json", "packages/*/package.json"]', "}"]),
          ...packages
        },
        [".syncpackrc.json"]
      )
      expect(none.before).toEqual([
        "err: config-sync FAIL  1 problem needs a person, and no command repairs it",
        'err:   .syncpackrc.json: has no version group that holds the catalog: add { "label": "...", "policy": "catalog", "dependencies": [], "dependencyTypes": ["prod", "dev", "peer"] } to "versionGroups" and run `bun run config-sync`, or a dependency of the root\'s catalog can be written as a version in one package.json'
      ])
    })
  )

  it.effect(
    "the catalog group is the one that says so, whatever order its keys are in and whatever else it holds",
    () =>
      Effect.gen(function* () {
        const root = json({ name: "root", workspaces: ["packages/*"], catalog: { vitest: "^5.1.0", effect: "4.1.5" } })
        const config = (dependencies: string) =>
          lines([
            "{",
            '  "source": ["package.json", "packages/*/package.json"],',
            '  "versionGroups": [',
            '    { "label": "kept {files}", "dependencies": ["alchemy"], "isIgnored": true },',
            "    {",
            '      "label": "the } catalog",',
            `      "dependencies": ${dependencies},`,
            '      "severity": { "NotUsingCatalog": "error" },',
            '      "policy": "catalog"',
            "    }",
            "  ]",
            "}"
          ])
        const result = yield* run(
          {
            "package.json": root,
            ".syncpackrc.json": config('["effect"]'),
            "packages/kernel/package.json": json({ name: "@x/kernel", scripts, dependencies: { effect: "catalog:" } }),
            "packages/kernel/tsconfig.json": "{}"
          },
          [".syncpackrc.json"]
        )
        expect(result.before).toEqual([
          "err: config-sync FAIL  1 place differs from what it is derived from (`bun run config-sync` writes it)",
          "err:   .syncpackrc.json:7  the catalog group's `dependencies`, from the `catalog` of package.json: found effect, expected effect, vitest"
        ])
        expect(result.files[".syncpackrc.json"]).toBe(config('["effect", "vitest"]'))
        expect(result.again.length).toBe(1)
      })
  )

  it.effect("a catalog group on one line whose list no longer fits there is written one key a line", () =>
    Effect.gen(function* () {
      const names = A.map(A.range(10, 21), (n) => `@scope/a-dependency-${n}`)
      const root = json({
        name: "root",
        workspaces: ["packages/*"],
        catalog: R.fromEntries(A.map(names, (name) => [name, "1.0.0"] as const))
      })
      const config = (group: ReadonlyArray<string>) =>
        lines([
          "{",
          '  "source": ["package.json", "packages/*/package.json"],',
          '  "versionGroups": [',
          ...group,
          "  ]",
          "}"
        ])
      const result = yield* run(
        {
          "package.json": root,
          ".syncpackrc.json": config([
            '    { "label": "...", "policy": "catalog", "dependencies": [], "dependencyTypes": ["prod", "dev", "peer"] }'
          ]),
          "packages/kernel/package.json": json({ name: "@x/kernel", scripts }),
          "packages/kernel/tsconfig.json": "{}"
        },
        [".syncpackrc.json"]
      )
      expect(result.files[".syncpackrc.json"]).toBe(
        config([
          "    {",
          '      "label": "...",',
          '      "policy": "catalog",',
          '      "dependencies": [',
          ...A.map(names, (name, index) => `        "${name}"${index === names.length - 1 ? "" : ","}`),
          "      ],",
          '      "dependencyTypes": ["prod", "dev", "peer"]',
          "    }"
        ])
      )
      expect(result.again.length).toBe(1)
    })
  )

  it.effect("a list too long for one line is written one item a line, as the formatter leaves it", () =>
    Effect.gen(function* () {
      const patterns = ["apps/*", "packages/*", "packages/catalog/*", "packages/access/*", "packages/foundation/*/*"]
      const result = yield* run(
        {
          "package.json": json({ name: "root", workspaces: patterns }),
          ".syncpackrc.json": lines(["{", '  "source": []', "}"]),
          "apps/shop/package.json": json({ name: "@x/shop", scripts }),
          "apps/shop/tsconfig.json": "{}",
          "packages/kernel/package.json": json({ name: "@x/kernel", scripts }),
          "packages/kernel/tsconfig.json": "{}",
          "packages/catalog/model/package.json": json({ name: "@x/model", scripts }),
          "packages/catalog/model/tsconfig.json": "{}",
          "packages/access/model/package.json": json({ name: "@x/access", scripts }),
          "packages/access/model/tsconfig.json": "{}",
          "packages/foundation/modeling/csv/package.json": json({ name: "@x/csv", scripts }),
          "packages/foundation/modeling/csv/tsconfig.json": "{}"
        },
        [".syncpackrc.json"]
      )
      expect(result.files[".syncpackrc.json"]).toBe(
        lines([
          "{",
          '  "source": [',
          '    "package.json",',
          '    "apps/*/package.json",',
          '    "packages/*/package.json",',
          '    "packages/catalog/*/package.json",',
          '    "packages/access/*/package.json",',
          '    "packages/foundation/*/*/package.json"',
          "  ]",
          "}"
        ])
      )
      expect(result.again).toEqual(result.after)
      expect(result.after[0]).toMatch(/^out: config-sync OK /)
    })
  )

  it.effect("names a package no workspace pattern covers and a pattern that names none: neither is repaired", () =>
    Effect.gen(function* () {
      const result = yield* run({
        "package.json": json({ name: "root", workspaces: ["packages/*", "extras/*"] }),
        "packages/kernel/package.json": json({ name: "@x/kernel", scripts }),
        "packages/kernel/tsconfig.json": "{}",
        "packages/drivers/d1/package.json": json({ name: "@x/d1", scripts }),
        "packages/drivers/d1/tsconfig.json": "{}"
      })
      const problems = [
        "err: config-sync FAIL  2 problems need a person, and no command repairs them",
        "err:   packages/drivers/d1/package.json: is a package no `workspaces` pattern of the root's package.json covers: bun does not install it, and `deps:lint` and `deps:update` do not read it. Add a pattern for it",
        'err:   package.json: the `workspaces` pattern "extras/*" names no package: remove it, or the package it was written for has moved'
      ]
      expect(result.before).toEqual(problems)
      expect(result.written).toEqual(problems)
      expect(result.after).toEqual(problems)
    })
  )

  it.effect("writes a `$schema`, an `extends` and a script's path for the depth of the folder they are in", () =>
    Effect.gen(function* () {
      const result = yield* run(
        {
          "package.json": json({ name: "root", workspaces: ["packages/*", "packages/group/*"] }),
          "tsconfig.base.json": "{}",
          ".oxlintrc.web.json": "{}",
          ".oxlintrc.shadcn.json": "{}",
          "node_modules/tool/schema.json": "{}",
          "packages/kernel/package.json": json({ name: "@x/kernel", scripts }),
          // Right for its depth, and an address: both are left alone.
          "packages/kernel/tsconfig.json": lines([
            "{",
            '  "extends": "../../tsconfig.base.json",',
            '  "$schema": "https://example.test/schema.json"',
            "}"
          ]),
          "packages/group/web/package.json": lines([
            "{",
            '  "name": "@x/web",',
            '  "scripts": {',
            '    "check": "tsrs -p tsconfig.json",',
            '    "lint": "oxlint --quiet src; oxlint -c ../../.oxlintrc.shadcn.json src"',
            "  }",
            "}"
          ]),
          // Moved one folder down: every path is still written for the folder above.
          "packages/group/web/tsconfig.json": lines([
            "{",
            '  // "extends": "../commented.json",',
            '  "extends": "../../tsconfig.base.json",',
            '  "$schema": "node_modules/tool/schema.json"',
            "}"
          ]),
          "packages/group/web/.oxlintrc.json": lines([
            "{",
            '  "extends": ["../../.oxlintrc.web.json", "./missing.json"]',
            "}"
          ])
        },
        ["packages/group/web/package.json", "packages/group/web/tsconfig.json", "packages/group/web/.oxlintrc.json"]
      )
      expect(result.before).toEqual([
        "err: config-sync FAIL  4 places differ from what they are derived from (`bun run config-sync` writes them); 1 problem needs a person, and no command repairs it",
        "err:   packages/group/web/.oxlintrc.json:2  `extends`, from the folder's depth: found ../../.oxlintrc.web.json, expected ../../../.oxlintrc.web.json",
        "err:   packages/group/web/package.json:5  a script's path, from the folder's depth: found ../../.oxlintrc.shadcn.json, expected ../../../.oxlintrc.shadcn.json",
        "err:   packages/group/web/tsconfig.json:3  `extends`, from the folder's depth: found ../../tsconfig.base.json, expected ../../../tsconfig.base.json",
        "err:   packages/group/web/tsconfig.json:4  `$schema`, from the folder's depth: found node_modules/tool/schema.json, expected ../../../node_modules/tool/schema.json",
        "err:   packages/group/web/.oxlintrc.json: line 2: `extends` names ./missing.json, which is not beside it: write the file's new name"
      ])
      expect(result.files).toEqual({
        "packages/group/web/package.json": lines([
          "{",
          '  "name": "@x/web",',
          '  "scripts": {',
          '    "check": "tsrs -p tsconfig.json",',
          '    "lint": "oxlint --quiet src; oxlint -c ../../../.oxlintrc.shadcn.json src"',
          "  }",
          "}"
        ]),
        "packages/group/web/tsconfig.json": lines([
          "{",
          '  // "extends": "../commented.json",',
          '  "extends": "../../../tsconfig.base.json",',
          '  "$schema": "../../../node_modules/tool/schema.json"',
          "}"
        ]),
        "packages/group/web/.oxlintrc.json": lines([
          "{",
          '  "extends": ["../../../.oxlintrc.web.json", "./missing.json"]',
          "}"
        ])
      })
      const left = [
        "err: config-sync FAIL  1 problem needs a person, and no command repairs it",
        "err:   packages/group/web/.oxlintrc.json: line 2: `extends` names ./missing.json, which is not beside it: write the file's new name"
      ]
      expect(result.after).toEqual(left)
      expect(result.again).toEqual(left)
    })
  )

  it.effect("a solution file references every project beside it, the root's every package's test project", () =>
    Effect.gen(function* () {
      const result = yield* run(
        {
          "package.json": json({ name: "root", workspaces: ["apps/*", "packages/*"] }),
          "tsconfig.base.json": "{}",
          "tsconfig.config.json": "{}",
          // One reference names nothing any more, one is a person's own and is kept.
          "tsconfig.json": lines([
            "{",
            "  // which project owns a test",
            '  "files": [],',
            '  "references": [{ "path": "./packages/gone/tsconfig.test.json" }, { "path": "./packages/kernel" }]',
            "}"
          ]),
          "apps/shop/package.json": json({ name: "@x/shop", scripts: { check: "tsrs -b", lint: "oxlint" } }),
          "apps/shop/tsconfig.base.json": "{}",
          "apps/shop/tsconfig.app.json": "{}",
          "apps/shop/tsconfig.worker.json": "{}",
          "apps/shop/tools/tsconfig.json": "{}",
          "apps/shop/tsconfig.json": lines([
            "{",
            '  "files": [],',
            '  "references": [',
            "    {",
            '      "path": "./tsconfig.app.json"',
            "    },",
            "    {",
            '      "path": "./tools"',
            "    }",
            "  ]",
            "}"
          ]),
          "packages/kernel/package.json": json({
            name: "@x/kernel",
            scripts: { ...scripts, check: "tsrs -p tsconfig.json && tsrs -p tsconfig.test.json" }
          }),
          "packages/kernel/tsconfig.json": "{}",
          "packages/kernel/tsconfig.test.json": "{}",
          "packages/ui/package.json": json({ name: "@x/ui", scripts }),
          "packages/ui/tsconfig.json": "{}"
        },
        ["tsconfig.json", "apps/shop/tsconfig.json"]
      )
      expect(result.before).toEqual([
        "err: config-sync FAIL  2 places differ from what they are derived from (`bun run config-sync` writes them)",
        "err:   apps/shop/tsconfig.json:3  `references`, from the projects beside it: found ./tsconfig.app.json, ./tools, expected ./tsconfig.app.json, ./tools, ./tsconfig.worker.json",
        "err:   tsconfig.json:4  `references`, from the projects beside it and each package's projects other than its tsconfig.json: found ./packages/gone/tsconfig.test.json, ./packages/kernel, expected ./packages/kernel, ./tsconfig.config.json, ./packages/kernel/tsconfig.test.json"
      ])
      expect(result.files).toEqual({
        "tsconfig.json": lines([
          "{",
          "  // which project owns a test",
          '  "files": [],',
          '  "references": [',
          '    { "path": "./packages/kernel" },',
          '    { "path": "./tsconfig.config.json" },',
          '    { "path": "./packages/kernel/tsconfig.test.json" }',
          "  ]",
          "}"
        ]),
        "apps/shop/tsconfig.json": lines([
          "{",
          '  "files": [],',
          '  "references": [{ "path": "./tsconfig.app.json" }, { "path": "./tools" }, { "path": "./tsconfig.worker.json" }]',
          "}"
        ])
      })
      expect(result.after[0]).toMatch(/^out: config-sync OK /)
      expect(result.again).toEqual(result.after)
    })
  )

  it.effect("a package's own project references are left as written: no rule derives them", () =>
    Effect.gen(function* () {
      const references = lines([
        "{",
        '  "references": [{ "path": "../../schema" }, { "path": "./tsconfig.json" }]',
        "}"
      ])
      const result = yield* run(
        {
          "package.json": json({ name: "root", workspaces: ["packages/*", "packages/catalog/*"] }),
          "packages/schema/package.json": json({ name: "@x/schema", scripts }),
          "packages/schema/tsconfig.json": "{}",
          "packages/catalog/model/package.json": json({
            name: "@x/model",
            scripts,
            dependencies: { "@x/schema": "workspace:*" },
            devDependencies: { "@x/kernel": "workspace:*" }
          }),
          "packages/catalog/model/tsconfig.json": references
        },
        ["packages/catalog/model/tsconfig.json"]
      )
      expect(result.before[0]).toMatch(/^out: config-sync OK /)
      expect(result.files).toEqual({ "packages/catalog/model/tsconfig.json": references })
    })
  )

  it.effect("a `./` path that names nothing beside it is a problem, never the root's file of that name", () =>
    Effect.gen(function* () {
      const project = lines(["{", '  "extends": "./tsconfig.base.json"', "}"])
      const result = yield* run(
        {
          "package.json": json({ name: "root", workspaces: ["packages/*"] }),
          "tsconfig.base.json": "{}",
          "packages/web/package.json": json({ name: "@x/web", scripts }),
          // Its own base was renamed: the root's base is another file, with other options.
          "packages/web/tsconfig.json": project
        },
        ["packages/web/tsconfig.json"]
      )
      expect(result.before).toEqual([
        "err: config-sync FAIL  1 problem needs a person, and no command repairs it",
        "err:   packages/web/tsconfig.json: line 2: `extends` names ./tsconfig.base.json, which is not beside it: write the file's new name"
      ])
      expect(result.files).toEqual({ "packages/web/tsconfig.json": project })
    })
  )

  it.effect("a list with a comment inside is never rewritten whole: the comment would be lost", () =>
    Effect.gen(function* () {
      const syncpack = lines(["{", '  "source": [', "    // the root first", '    "package.json"', "  ]", "}"])
      const result = yield* run(
        {
          "package.json": json({ name: "root", workspaces: ["packages/*"] }),
          ".syncpackrc.json": syncpack,
          "packages/kernel/package.json": json({ name: "@x/kernel", scripts }),
          "packages/kernel/tsconfig.json": "{}"
        },
        [".syncpackrc.json"]
      )
      expect(result.before).toEqual([
        "err: config-sync FAIL  1 problem needs a person, and no command repairs it",
        "err:   .syncpackrc.json: line 2: `source`, from the `workspaces` of package.json differs (found package.json; expected package.json, packages/*/package.json), and writing it would lose the comment inside it: change it by hand"
      ])
      expect(result.files).toEqual({ ".syncpackrc.json": syncpack })
    })
  )

  it.effect("the formatter reads again a package that stopped being vendored", () =>
    Effect.gen(function* () {
      const result = yield* run(
        {
          "package.json": json({ name: "root", workspaces: ["apps/*", "packages/*"] }),
          ".oxfmtrc.json": lines(["{", '  "ignorePatterns": ["**/dist/**", "packages/once-kit/**"]', "}"]),
          "apps/shop/package.json": json({ name: "@x/shop", scripts }),
          "apps/shop/tsconfig.json": "{}",
          // No vendor.json any more: the repository's own code.
          "packages/once-kit/package.json": json({ name: "@x/once-kit", scripts }),
          "packages/once-kit/tsconfig.json": "{}"
        },
        [".oxfmtrc.json"]
      )
      expect(result.before).toEqual([
        "err: config-sync FAIL  1 place differs from what it is derived from (`bun run config-sync` writes it)",
        "err:   .oxfmtrc.json:2  `ignorePatterns`, from the packages with a vendor.json: found with packages/once-kit/**, which is no vendored package, expected every vendored package, and no package of the repository's own"
      ])
      expect(result.files).toEqual({
        ".oxfmtrc.json": lines(["{", '  "ignorePatterns": ["**/dist/**"]', "}"])
      })
    })
  )

  it.effect("gives a package the scripts turbo runs for what it holds", () =>
    Effect.gen(function* () {
      const result = yield* run(
        {
          "package.json": json({ name: "root", workspaces: ["packages/*"] }),
          // Has a test project, tests and a ceiling file, and a check that knows of none of them.
          "packages/web/package.json": lines([
            "{",
            '  "name": "@x/web",',
            '  "scripts": {',
            '    "check": "tsrs -p tsconfig.json"',
            "  }",
            "}"
          ]),
          "packages/web/tsconfig.json": "{}",
          "packages/web/tsconfig.test.json": "{}",
          "packages/web/strict-ceiling.json": "{}",
          "packages/web/vitest.config.ts": "",
          "packages/web/src/a.ts": "",
          "packages/web/test/a.test.ts": "",
          // Vendored: copied as published, so it is not linted.
          "packages/kit/package.json": lines(["{", '  "name": "@x/kit",', '  "scripts": {}', "}"]),
          "packages/kit/tsconfig.json": "{}",
          "packages/kit/vendor.json": "{}",
          "packages/kit/src/a.ts": "",
          // Nothing to say what turbo would run: a person adds the block.
          "packages/bare/package.json": json({ name: "@x/bare" }),
          "packages/bare/tsconfig.json": "{}"
        },
        ["packages/web/package.json", "packages/kit/package.json"]
      )
      expect(result.before).toEqual([
        "err: config-sync FAIL  3 places differ from what they are derived from (`bun run config-sync` writes them); 1 problem needs a person, and no command repairs it",
        "err:   packages/kit/package.json:3  `scripts`, from what the package holds: found no check, expected check: tsrs -p tsconfig.json",
        "err:   packages/web/package.json:3  `scripts`, from what the package holds: found no lint, test, expected lint: oxlint --quiet src test, test: vitest run",
        "err:   packages/web/package.json:4  the `check` script, from the package's projects and ceiling file: found without tsrs -p tsconfig.test.json, beep-cli quality strict strict-ceiling.json, expected with tsrs -p tsconfig.test.json, beep-cli quality strict strict-ceiling.json",
        'err:   packages/bare/package.json: has no "scripts", and turbo runs check, lint in a package like it: add "scripts": {} and run `bun run config-sync`'
      ])
      expect(result.files).toEqual({
        "packages/web/package.json": lines([
          "{",
          '  "name": "@x/web",',
          '  "scripts": {',
          '    "lint": "oxlint --quiet src test",',
          '    "test": "vitest run",',
          '    "check": "tsrs -p tsconfig.json && tsrs -p tsconfig.test.json && beep-cli quality strict strict-ceiling.json"',
          "  }",
          "}"
        ]),
        "packages/kit/package.json": lines([
          "{",
          '  "name": "@x/kit",',
          '  "scripts": {',
          '    "check": "tsrs -p tsconfig.json"',
          "  }",
          "}"
        ])
      })
      const left = [
        "err: config-sync FAIL  1 problem needs a person, and no command repairs it",
        'err:   packages/bare/package.json: has no "scripts", and turbo runs check, lint in a package like it: add "scripts": {} and run `bun run config-sync`'
      ]
      expect(result.after).toEqual(left)
      expect(result.again).toEqual(left)
    })
  )

  it.effect("the three checks run every root task turbo.json defines, and the formatter skips a vendored package", () =>
    Effect.gen(function* () {
      const result = yield* run(
        {
          "package.json": lines([
            "{",
            '  "name": "root",',
            '  "workspaces": ["packages/*"],',
            '  "scripts": {',
            '    "check": "turbo run check lint //#format:check //#gone:check",',
            '    "check:full": "turbo run check lint build //#format:check //#docs:check",',
            '    "check:ci": "turbo run check lint //#format:check //#docs:check //#keys:check //#gone:check",',
            '    "format:check": "oxfmt --check",',
            '    "docs:check": "beep docs check"',
            "  }",
            "}"
          ]),
          "turbo.json": lines([
            "{",
            '  "tasks": {',
            "    // a package's task",
            '    "check": {},',
            '    "//#format:check": {},',
            '    "//#docs:check": {},',
            '    "//#keys:check": {}',
            "  }",
            "}"
          ]),
          ".oxfmtrc.json": lines(["{", '  "ignorePatterns": ["**/dist/**"]', "}"]),
          "packages/kit/package.json": json({ name: "@x/kit", scripts: { check: "tsrs -p tsconfig.json" } }),
          "packages/kit/tsconfig.json": "{}",
          "packages/kit/vendor.json": "{}"
        },
        ["package.json", ".oxfmtrc.json"]
      )
      expect(result.before).toEqual([
        "err: config-sync FAIL  4 places differ from what they are derived from (`bun run config-sync` writes them); 1 problem needs a person, and no command repairs it",
        "err:   .oxfmtrc.json:2  `ignorePatterns`, from the packages with a vendor.json: found without packages/kit/**, expected every vendored package, and no package of the repository's own",
        "err:   package.json:5  the `check` script, from the root tasks of turbo.json: found without //#docs:check, //#keys:check, with //#gone:check, which is no task, expected every root task turbo.json defines, and no other",
        "err:   package.json:6  the `check:full` script, from the root tasks of turbo.json: found without //#keys:check, expected every root task turbo.json defines, and no other",
        "err:   package.json:7  the `check:ci` script, from the root tasks of turbo.json: found with //#gone:check, which is no task, expected every root task turbo.json defines, and no other",
        'err:   turbo.json: defines the root task //#keys:check and the root\'s package.json has no script "keys:check": add the script, or remove the task'
      ])
      expect(result.files).toEqual({
        "package.json": lines([
          "{",
          '  "name": "root",',
          '  "workspaces": ["packages/*"],',
          '  "scripts": {',
          '    "check": "turbo run check lint //#format:check //#docs:check //#keys:check",',
          '    "check:full": "turbo run check lint build //#format:check //#docs:check //#keys:check",',
          '    "check:ci": "turbo run check lint //#format:check //#docs:check //#keys:check",',
          '    "format:check": "oxfmt --check",',
          '    "docs:check": "beep docs check"',
          "  }",
          "}"
        ]),
        ".oxfmtrc.json": lines(["{", '  "ignorePatterns": ["**/dist/**", "packages/kit/**"]', "}"])
      })
      const left = [
        "err: config-sync FAIL  1 problem needs a person, and no command repairs it",
        'err:   turbo.json: defines the root task //#keys:check and the root\'s package.json has no script "keys:check": add the script, or remove the task'
      ]
      expect(result.after).toEqual(left)
      expect(result.again).toEqual(left)
    })
  )

  it.effect("the scratchpad is no workspace and is not read: its manifest and configuration are the CLI's", () =>
    Effect.gen(function* () {
      const scratch = lines(["{", '  "name": "@x/scratchpad",', '  "dependencies": { "left-pad": "^1.0.0" }', "}"])
      const result = yield* run(
        {
          "package.json": json({ name: "root", workspaces: ["packages/*"] }),
          ".syncpackrc.json": lines(["{", '  "source": ["package.json", "packages/*/package.json"]', "}"]),
          "packages/kernel/package.json": json({ name: "@x/kernel", scripts }),
          "packages/kernel/tsconfig.json": "{}",
          "scratchpad/package.json": scratch,
          "scratchpad/tsconfig.json": lines(["{", '  "extends": "../../tsconfig.base.json"', "}"])
        },
        ["scratchpad/package.json", "scratchpad/tsconfig.json"]
      )
      expect(result.before[0]).toMatch(/^out: config-sync OK /)
      expect(result.files).toEqual({
        "scratchpad/package.json": scratch,
        "scratchpad/tsconfig.json": lines(["{", '  "extends": "../../tsconfig.base.json"', "}"])
      })
    })
  )

  it.effect("a `scratchpad` pattern with no scratchpad behind it is a problem", () =>
    Effect.gen(function* () {
      const result = yield* run({
        "package.json": json({ name: "root", workspaces: ["packages/*", "scratchpad"] }),
        "packages/kernel/package.json": json({ name: "@x/kernel", scripts }),
        "packages/kernel/tsconfig.json": "{}"
      })
      expect(result.before).toEqual([
        "err: config-sync FAIL  1 problem needs a person, and no command repairs it",
        'err:   package.json: the `workspaces` pattern "scratchpad" names no package: remove it, or the package it was written for has moved'
      ])
    })
  )
})
