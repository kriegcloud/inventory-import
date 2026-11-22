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
  heldBecause,
  newerThan,
  type PackageManager,
  versionOf,
  writtenAs
} from "../src/commands/Deps/Deps.rules.ts"
import { Repo } from "../src/Repo.service.ts"
import { render } from "../src/Report.schema.ts"
import { lines } from "./support/sync.ts"
import { inTree, json, printed, type Tree } from "./support/tree.ts"

// A registry that answers from a table, and an install that writes a lockfile from every package.json as it is when
// the install runs, the scratchpad's included, as bun does: no network, nothing installed. A test then sees in
// bun.lock what the install was given. A failing install still writes its lockfile first, as a half-finished one can.
const lockOf = Effect.gen(function* () {
  const repo = yield* Repo
  const workspaces = yield* repo.workspaces
  const scratch = repo.join(repo.root, "scratchpad", "package.json")
  const hasScratch = yield* repo.exists(scratch)
  const files = A.flatten([
    [repo.join(repo.root, "package.json")],
    A.map(workspaces, (workspace) => repo.join(workspace.dir, "package.json")),
    hasScratch ? [scratch] : []
  ])
  const texts = yield* Effect.forEach(
    files,
    (file) => Effect.map(repo.text(file), (text) => `${repo.relative(repo.root, file)} ${text}`),
    { concurrency: 1 }
  )
  yield* repo.write(repo.join(repo.root, "bun.lock"), A.join(texts, ""))
})
const registry = (newest: Record<string, string>, installCode = 0): PackageManager => ({
  newest: (name) => Effect.succeed(R.get(newest, name)),
  install: Effect.gen(function* () {
    yield* lockOf
    return { code: installCode, output: "error: lockfile had changes\nline two" }
  })
})

const held = json({
  updateGroups: [
    {
      label: "Patched at install: it moves by hand. To move: `bun run tool:repin -- main`, then the full check",
      dependencies: ["typescript", "@tool/**"],
      isIgnored: true
    },
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
  "README.md": "Effect 4.1.4\n",
  "bun.lock": "the lockfile before\n"
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
      const lock = yield* repo.text(repo.join(repo.root, "bun.lock"))
      return { first, second, files: R.fromEntries(texts), installed: lock !== "the lockfile before\n", lock }
    })
  )

describe("deps update", () => {
  it.effect("a dry run says what would move and what is held with its reason, and writes nothing", () =>
    Effect.gen(function* () {
      const result = yield* run(tree(), registry(newest), "dry-run", ["packages/kernel/package.json"])
      expect(printed(result.first)).toEqual([
        "out: deps:update  3 package.json files, 6 dependencies: 3 to move, 2 held, 1 not compared (nothing written)",
        "out:   held  @tool/patcher 0.70.0 (newest 0.73.2)",
        "out:   held  typescript ~7.0.2 (newest 8.0.0)",
        "out:         why: Patched at install: it moves by hand.",
        "out:         to move: `bun run tool:repin -- main`, then the full check",
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
        "out:   held  @tool/patcher 0.70.0 (newest 0.73.2)",
        "out:   held  typescript ~7.0.2 (newest 8.0.0)",
        "out:         why: Patched at install: it moves by hand.",
        "out:         to move: `bun run tool:repin -- main`, then the full check",
        "out:   skip  xlsx https://cdn.example.test/xlsx-0.20.3.tgz: not written as a version the registry can be asked about",
        "out:   moved  @effect/vitest 4.1.4 -> 4.1.5 (1 package.json)",
        "out:   moved  effect 4.1.4 -> 4.1.5 (2 package.json files)",
        "out:   moved  vitest ^5.1.0 -> ^5.2.0 (1 package.json)",
        "out: version-sync  wrote 1 place in 1 file",
        "out:   README.md:1  Effect's version, from the `effect` the package.json files state: 4.1.4 -> 4.1.5",
        "out: deps:update  bun install ran: bun.lock and node_modules follow the new versions"
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
        "out:   held  @tool/patcher 0.70.0 (newest 0.73.2)",
        "out:   held  typescript ~7.0.2 (newest 8.0.0)",
        "out:         why: Patched at install: it moves by hand.",
        "out:         to move: `bun run tool:repin -- main`, then the full check",
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
        "out:   held  @tool/patcher 0.70.0 (newest 0.73.2)",
        "out:   held  typescript ~7.0.2 (newest 8.0.0)",
        "out:         why: Patched at install: it moves by hand.",
        "out:         to move: `bun run tool:repin -- main`, then the full check",
        "out:   skip  xlsx https://cdn.example.test/xlsx-0.20.3.tgz: not written as a version the registry can be asked about",
        "out:   wait  effect and the @effect/* packages released with it are not at one newest version (@effect/vitest 4.1.4, effect 4.1.5): none of them moves until they are",
        "out:   moved  vitest ^5.1.0 -> ^5.2.0 (1 package.json)",
        "out: version-sync OK  2 places agree with what they are derived from",
        "out: deps:update  bun install ran: bun.lock and node_modules follow the new versions"
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
        "out:   held  @tool/patcher 0.70.0",
        "out:   held  typescript ~7.0.2",
        "out:         why: Patched at install: it moves by hand.",
        "out:         to move: `bun run tool:repin -- main`, then the full check",
        "out:   skip  @effect/vitest 4.1.4: the registry named no newest version for it",
        "out:   skip  effect 4.1.4: the registry named no newest version for it",
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
      // `effect` follows through version-sync; `zod` stays where the experiment put it.
      const followed = json({ name: "@x/scratchpad", dependencies: { effect: "4.1.5", zod: "^3.0.0" } })
      expect(result.files["scratchpad/package.json"]).toBe(followed)
      // And the install ran after version-sync: the lockfile was made from the scratchpad as it now is.
      expect(result.lock).toContain(`scratchpad/package.json ${followed}`)
    })
  )

  it.effect("an install that fails puts every file back, the lockfile too, so a second run finds the same moves", () =>
    Effect.gen(function* () {
      const result = yield* run(tree(), registry(newest, 1), "write", [
        "packages/kernel/package.json",
        "packages/schema/package.json",
        "README.md"
      ])
      const failed =
        "err: deps:update FAIL  bun install did not finish, so the 4 files written (the package.json files, what version-sync brought along, bun.lock) are put back as they were. node_modules may be half installed: `bun install` puts it back. Fix what bun said, then run `bun run deps:update` again. bun said:\nerror: lockfile had changes\nline two"
      expect(result.first.failed).toBe(true)
      expect(A.last(printed(result.first))).toEqual(O.some(failed))
      expect(result.files).toEqual({
        "packages/kernel/package.json": manifest("4.1.4", "^5.1.0"),
        "packages/schema/package.json": json({ name: "@x/schema", dependencies: { effect: "4.1.4" } }),
        "README.md": "Effect 4.1.4\n"
      })
      expect(result.lock).toBe("the lockfile before\n")
      // The second run is not a silent "0 moved": it finds the same three moves and tries again.
      expect(printed(result.second)[0]).toBe(
        "out: deps:update  3 package.json files, 6 dependencies: 3 moved, 2 held, 1 not compared"
      )
      expect(A.last(printed(result.second))).toEqual(O.some(failed))
    })
  )

  it("reads a held group's label as its reason and, after To move, what moves it", () => {
    expect(heldBecause("Pinned as one set. To move: `bun run alchemy:repin -- main`")).toEqual({
      reason: "Pinned as one set.",
      move: O.some("`bun run alchemy:repin -- main`")
    })
    expect(heldBecause("Patched at install")).toEqual({ reason: "Patched at install", move: O.none() })
  })

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
