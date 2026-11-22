import { describe, expect, it } from "@effect/vitest"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as R from "effect/Record"
import * as Str from "effect/String"
import {
  asksIn,
  depsSentence,
  depsUpdate,
  newerThan,
  type PackageManager,
  versionOf,
  writtenAs
} from "../src/commands/Deps/Deps.rules.ts"
import { Repo } from "../src/Repo.service.ts"
import { render } from "../src/Report.schema.ts"
import { lines } from "./support/sync.ts"
import { inTree, json, printed, type Tree } from "./support/tree.ts"

// A registry that answers from a table, and an install that only leaves a mark: no network, nothing installed.
const registry = (newest: Record<string, string>, installCode = 0): PackageManager => ({
  newest: (name) => Effect.succeed(R.get(newest, name)),
  install: Effect.gen(function* () {
    const repo = yield* Repo
    yield* repo.write(repo.join(repo.root, "installed"), "yes\n")
    return { code: installCode, output: "error: lockfile had changes\nline two" }
  })
})

const held = json({
  updateGroups: [
    { label: "Patched at install: it moves by hand", dependencies: ["typescript", "@tool/**"], isIgnored: true },
    { label: "A group that only limits how far", dependencies: ["react"], target: "minor" }
  ]
})

const manifest = (effect: string, vitest: string, extra: ReadonlyArray<string> = []) =>
  lines([
    "{",
    '  "name": "@x/kernel",',
    '  "dependencies": {',
    '    "@x/schema": "workspace:*",',
    `    "effect": "${effect}"${extra.length === 0 ? "" : ","}`,
    ...extra,
    "  },",
    '  "devDependencies": {',
    `    "@effect/vitest": "${effect}",`,
    '    "@tool/patcher": "0.70.0",',
    '    "typescript": "~7.0.2",',
    `    "vitest": "${vitest}",`,
    '    "xlsx": "https://cdn.example.test/xlsx-0.20.3.tgz"',
    "  }",
    "}"
  ])

const tree = (extra: ReadonlyArray<string> = []): Tree => ({
  "package.json": lines([
    "{",
    '  "name": "root",',
    '  "workspaces": ["packages/*"],',
    '  "devDependencies": {',
    '    "typescript": "~7.0.2"',
    "  }",
    "}"
  ]),
  ".syncpackrc.json": held,
  "packages/kernel/package.json": manifest("4.1.4", "^5.1.0", extra),
  "packages/schema/package.json": json({ name: "@x/schema", dependencies: { effect: "4.1.4" } }),
  "README.md": "Effect 4.1.4\n"
})

const newest = {
  effect: "4.1.5",
  "@effect/vitest": "4.1.5",
  vitest: "5.2.0",
  typescript: "8.0.0",
  "@tool/patcher": "0.73.2"
}

const run = (files: Tree, packages: PackageManager, mode: "write" | "dry-run", read: ReadonlyArray<string>) =>
  inTree(
    files,
    Effect.gen(function* () {
      const repo = yield* Repo
      const first = yield* Effect.map(depsUpdate(mode, packages), render(depsSentence))
      const second = yield* Effect.map(depsUpdate(mode, packages), render(depsSentence))
      const texts = yield* Effect.forEach(
        read,
        (file) => Effect.map(repo.text(repo.join(repo.root, file)), (text) => [file, text] as const),
        { concurrency: 1 }
      )
      const installed = yield* repo.exists(repo.join(repo.root, "installed"))
      return { first, second, files: R.fromEntries(texts), installed }
    })
  )

describe("deps update", () => {
  it.effect("a dry run says what would move and what is held with its reason, and writes nothing", () =>
    Effect.gen(function* () {
      const result = yield* run(tree(), registry(newest), "dry-run", ["packages/kernel/package.json"])
      expect(printed(result.first)).toEqual([
        "out: deps:update  3 package.json files, 6 dependencies: 3 to move, 2 held, 1 not compared (nothing written)",
        "out:   held  @tool/patcher 0.70.0 (newest 0.73.2): Patched at install: it moves by hand",
        "out:   held  typescript ~7.0.2 (newest 8.0.0): Patched at install: it moves by hand",
        "out:   skip  xlsx https://cdn.example.test/xlsx-0.20.3.tgz: not written as a version the registry can be asked about",
        "out:   move   @effect/vitest 4.1.4 -> 4.1.5 (1 package.json)",
        "out:   move   effect 4.1.4 -> 4.1.5 (2 package.json files)",
        "out:   move   vitest ^5.1.0 -> ^5.2.0 (1 package.json)"
      ])
      expect(result.first.failed).toBe(false)
      expect(result.files["packages/kernel/package.json"]).toBe(manifest("4.1.4", "^5.1.0"))
      expect(result.installed).toBe(false)
      expect(printed(result.second)).toEqual(printed(result.first))
    })
  )

  it.effect("writes every package.json, installs, brings the documents along, and a second run moves nothing", () =>
    Effect.gen(function* () {
      const result = yield* run(tree(), registry(newest), "write", [
        "packages/kernel/package.json",
        "packages/schema/package.json",
        "package.json",
        "README.md"
      ])
      expect(printed(result.first)).toEqual([
        "out: deps:update  3 package.json files, 6 dependencies: 3 moved, 2 held, 1 not compared",
        "out:   held  @tool/patcher 0.70.0 (newest 0.73.2): Patched at install: it moves by hand",
        "out:   held  typescript ~7.0.2 (newest 8.0.0): Patched at install: it moves by hand",
        "out:   skip  xlsx https://cdn.example.test/xlsx-0.20.3.tgz: not written as a version the registry can be asked about",
        "out:   moved  @effect/vitest 4.1.4 -> 4.1.5 (1 package.json)",
        "out:   moved  effect 4.1.4 -> 4.1.5 (2 package.json files)",
        "out:   moved  vitest ^5.1.0 -> ^5.2.0 (1 package.json)",
        "out: deps:update  bun install ran: bun.lock and node_modules follow the new versions",
        "out: version-sync  wrote 1 place in 1 file",
        "out:   README.md:1  Effect's version, from the `effect` the package.json files state: 4.1.4 -> 4.1.5"
      ])
      expect(result.files).toEqual({
        "packages/kernel/package.json": manifest("4.1.5", "^5.2.0"),
        "packages/schema/package.json": json({ name: "@x/schema", dependencies: { effect: "4.1.5" } }),
        "package.json": tree()["package.json"],
        "README.md": "Effect 4.1.5\n"
      })
      expect(result.installed).toBe(true)
      expect(printed(result.second)).toEqual([
        "out: deps:update  3 package.json files, 6 dependencies: 0 moved, 2 held, 1 not compared",
        "out:   held  @tool/patcher 0.70.0 (newest 0.73.2): Patched at install: it moves by hand",
        "out:   held  typescript ~7.0.2 (newest 8.0.0): Patched at install: it moves by hand",
        "out:   skip  xlsx https://cdn.example.test/xlsx-0.20.3.tgz: not written as a version the registry can be asked about"
      ])
    })
  )

  it.effect("Effect and its packages move to one version or not at all", () =>
    Effect.gen(function* () {
      const behind = { ...newest, "@effect/vitest": "4.1.4" }
      const result = yield* run(tree(), registry(behind), "write", ["packages/kernel/package.json"])
      expect(printed(result.first)).toEqual([
        "out: deps:update  3 package.json files, 6 dependencies: 1 moved, 2 held, 1 not compared",
        "out:   held  @tool/patcher 0.70.0 (newest 0.73.2): Patched at install: it moves by hand",
        "out:   held  typescript ~7.0.2 (newest 8.0.0): Patched at install: it moves by hand",
        "out:   skip  xlsx https://cdn.example.test/xlsx-0.20.3.tgz: not written as a version the registry can be asked about",
        "out:   wait  effect and the @effect/* packages released with it are not at one newest version (@effect/vitest 4.1.4, effect 4.1.5): none of them moves until they are",
        "out:   moved  vitest ^5.1.0 -> ^5.2.0 (1 package.json)",
        "out: deps:update  bun install ran: bun.lock and node_modules follow the new versions",
        "out: version-sync OK  2 places agree with what they are derived from"
      ])
      expect(result.files["packages/kernel/package.json"]).toBe(manifest("4.1.4", "^5.2.0"))
    })
  )

  it.effect("a dependency the registry does not know, and one already newer than its newest, stay", () =>
    Effect.gen(function* () {
      const result = yield* run(
        tree(['    "left-alone": "2.0.0-beta.3",', '    "unknown-here": "^1.0.0"']),
        registry({ "left-alone": "1.9.0" }),
        "dry-run",
        []
      )
      expect(printed(result.first)).toEqual([
        "out: deps:update  3 package.json files, 8 dependencies: 0 to move, 2 held, 5 not compared (nothing written)",
        "out:   skip  @effect/vitest 4.1.4: the registry named no newest version for it",
        "out:   held  @tool/patcher 0.70.0: Patched at install: it moves by hand",
        "out:   skip  effect 4.1.4: the registry named no newest version for it",
        "out:   held  typescript ~7.0.2: Patched at install: it moves by hand",
        "out:   skip  unknown-here ^1.0.0: the registry named no newest version for it",
        "out:   skip  vitest ^5.1.0: the registry named no newest version for it",
        "out:   skip  xlsx https://cdn.example.test/xlsx-0.20.3.tgz: not written as a version the registry can be asked about"
      ])
    })
  )

  it.effect("a registry that answers for nothing is said, and nothing is written", () =>
    Effect.gen(function* () {
      const error = yield* inTree(tree(), Effect.flip(depsUpdate("write", registry({}))))
      expect(error.message).toBe(
        "deps:update could not learn the newest version of any of the 5 dependencies it asked about: `bun info <name> version` answered for none. Is the registry reachable? Nothing was written"
      )
    })
  )

  it.effect("the scratchpad is not read: a library an experiment added is the experiment's to move", () =>
    Effect.gen(function* () {
      const scratch = json({ name: "@x/scratchpad", dependencies: { effect: "4.1.4", zod: "^3.0.0" } })
      const result = yield* run(
        { ...tree(), "scratchpad/package.json": scratch },
        registry({ ...newest, zod: "4.0.0" }),
        "write",
        ["scratchpad/package.json"]
      )
      expect(A.filter(printed(result.first), Str.includes("zod"))).toEqual([])
      expect(printed(result.first)[0]).toBe(
        "out: deps:update  3 package.json files, 6 dependencies: 3 moved, 2 held, 1 not compared"
      )
      // `effect` follows through version-sync, which runs after the move; `zod` stays where the experiment put it.
      expect(result.files["scratchpad/package.json"]).toBe(
        json({ name: "@x/scratchpad", dependencies: { effect: "4.1.5", zod: "^3.0.0" } })
      )
    })
  )

  it.effect("an install that fails is said with what bun printed, after the files were written", () =>
    Effect.gen(function* () {
      const result = yield* run(tree(), registry(newest, 1), "write", ["packages/kernel/package.json"])
      expect(result.first.failed).toBe(true)
      expect(A.last(printed(result.first))).toEqual(
        O.some(
          "err: deps:update FAIL  bun install did not finish after the versions were written. The package.json files hold the new versions; bun.lock may not. bun said:\nerror: lockfile had changes\nline two"
        )
      )
      expect(result.files["packages/kernel/package.json"]).toBe(manifest("4.1.5", "^5.2.0"))
    })
  )

  it("reads how a dependency is written, and which version came later", () => {
    const later = (candidate: string, current: string) =>
      O.getOrElse(
        O.zipWith(versionOf(candidate), versionOf(current), (a, b) => newerThan(b)(a)),
        () => false
      )
    expect(later("4.1.5", "4.1.4")).toBe(true)
    expect(later("4.1.4", "4.1.4")).toBe(false)
    expect(later("4.10.0", "4.9.9")).toBe(true)
    expect(later("2.0.0", "2.0.0-beta.87")).toBe(true)
    expect(later("2.0.0-beta.100", "2.0.0-beta.87")).toBe(true)
    expect(later("2.0.0-beta.87", "2.0.0")).toBe(false)
    expect(O.map(writtenAs("^1.2.3"), (found) => found.lead)).toEqual(O.some("^"))
    expect(O.map(writtenAs("1.2.3"), (found) => found.lead)).toEqual(O.some(""))
    expect(
      A.map(["workspace:*", "catalog:", "https://x.test/a.tgz", ">=1 <3", "latest", "1.2"], (spec) =>
        O.isNone(writtenAs(spec))
      )
    ).toEqual([true, true, true, true, true, true])
  })

  it("finds every place a package.json asks for a dependency, the root's catalog too", () => {
    const text = lines([
      "{",
      '  "name": "root",',
      '  "catalog": { "effect": "4.1.4" },',
      '  "dependencies": { "effect": "catalog:", "react": "^19.3.1" },',
      '  "peerDependenciesMeta": { "react": { "optional": true } }',
      "}"
    ])
    expect(A.map(asksIn("package.json")(text), (ask) => `${ask.name} ${ask.spec.value} line ${ask.line}`)).toEqual([
      "effect catalog: line 4",
      "react ^19.3.1 line 4",
      "effect 4.1.4 line 3"
    ])
  })
})
