// The patches commands on a small repository written for each case: a package `left` with one patch, as a package
// from a registry (its resolution is a version) and as a package kept as a file (its resolution is the file). git
// and tar are the real ones.
import { describe, expect, it } from "@effect/vitest"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as R from "effect/Record"
import * as Str from "effect/String"
import { patchesBuild, patchesBuildSentence } from "../src/commands/Patches/PatchesBuild.rules.ts"
import { patchesCarry, patchesCarrySentence } from "../src/commands/Patches/PatchesCarry.rules.ts"
import { patchesCheck, patchesCheckSentence, waits } from "../src/commands/Patches/PatchesCheck.rules.ts"
import {
  packageOf,
  patchesInstalled,
  patchesInstalledSentence
} from "../src/commands/Patches/PatchesInstalled.rules.ts"
import {
  patchesProve,
  patchesProveSentence,
  withoutPatches,
  withoutSome
} from "../src/commands/Patches/PatchesProve.rules.ts"
import { readPatches, resolutionsOf } from "../src/commands/Patches/PatchesRead.rules.ts"
import { readPatch, withAppliesTo } from "../src/commands/Patches/Patches.schema.ts"
import { Repo } from "../src/Repo.service.ts"
import { render } from "../src/Report.schema.ts"
import { inTree, json, printed, type Tree } from "./support/tree.ts"

const header = (appliesTo: string, fields: Readonly<Record<string, string>> = {}) =>
  A.join(
    A.map(
      [
        ["Package", "left"],
        ["Applies-to", appliesTo],
        ["Upstream", "not yet reported"],
        ["Why", "It says a, and the app needs b:\n  nothing else says b."],
        ["Remove-when", "The library says b."],
        ["Test", "test/left/SaysB.test.ts"]
      ] as const,
      ([name, value]) => `${name}: ${fields[name] ?? value}\n`
    ),
    ""
  )
const diff = (from: string, to: string) =>
  `\ndiff --git a/index.js b/index.js\n--- a/index.js\n+++ b/index.js\n@@ -1 +1 @@\n-export const said = "${from}"\n+export const said = "${to}"\n`
const patch = (appliesTo: string) => header(appliesTo) + diff("a", "b")
const says = (what: string) => `export const said = "${what}"\n`
/** A second file of the package, so that two patches can change it without touching each other's lines. */
const otherSays = (what: string) => `export const other = "${what}"\n`
const otherDiff = (from: string, to: string) =>
  `\ndiff --git a/other.js b/other.js\n--- a/other.js\n+++ b/other.js\n@@ -1 +1 @@\n-export const other = "${from}"\n+export const other = "${to}"\n`

/** `left@1.0.0` from a registry, patched to say b, installed patched. */
const registry = (files: Tree = {}): Tree => ({
  "package.json": json({
    name: "root",
    workspaces: ["packages/*"],
    patchedDependencies: { "left@1.0.0": "packages/patches/left.patch" }
  }),
  "bun.lock": '{ "packages": { "left": ["left@1.0.0", "", {}, "sha512-x"] } }\n',
  "packages/patches/package.json": json({ name: "@x/patches" }),
  "packages/patches/left/01-says-b.patch": patch("1.0.0"),
  "packages/patches/left.patch": patch("1.0.0"),
  "packages/patches/test/left/SaysB.test.ts": "",
  "node_modules/left/index.js": says("b"),
  ...files
})

/** `left` kept as `vendor/left-<commit>.tgz`, each made by tar from a folder that says what its commit says. */
const kept = (commits: Readonly<Record<string, string>>, files: Tree = {}): Tree => ({
  "package.json": json({
    name: "root",
    workspaces: ["packages/*"],
    overrides: { left: "file:vendor/left-aaa.tgz" },
    patchedDependencies: { "left@vendor/left-aaa.tgz": "packages/patches/left.patch" }
  }),
  "bun.lock": '{ "packages": { "left": ["left@vendor/left-aaa.tgz", {}, "sha512-x"] } }\n',
  "packages/patches/package.json": json({ name: "@x/patches" }),
  "packages/patches/left/01-says-b.patch": patch("vendor/left-aaa.tgz"),
  "packages/patches/left.patch": patch("vendor/left-aaa.tgz"),
  "packages/patches/test/left/SaysB.test.ts": "",
  "node_modules/left/index.js": says("b"),
  "vendor/.keep": "",
  ...R.fromEntries(A.map(R.toEntries(commits), ([commit, what]) => [`stage/${commit}/package/index.js`, says(what)])),
  ...files
})

/** Packs each staged folder into its kept file, then runs the rule. */
const packed = Effect.fnUntraced(function* <Value, E>(
  commits: ReadonlyArray<string>,
  rule: Effect.Effect<Value, E, Repo>
) {
  const repo = yield* Repo
  yield* Effect.forEach(
    commits,
    (commit) => repo.run("tar", ["-czf", `vendor/left-${commit}.tgz`, "-C", `stage/${commit}`, "package"]),
    { concurrency: 1, discard: true }
  )
  return yield* rule
})

const checked = Effect.map(patchesCheck(), (findings) => printed(render(patchesCheckSentence)(findings)))

describe("a patch's header", () => {
  it("is the fields above the diff, a line that starts with a space continuing the one above", () => {
    const read = readPatch(patch("1.0.0"))
    expect(O.getOrUndefined(read.header)).toMatchObject({
      package: "left",
      appliesTo: "1.0.0",
      upstream: "not yet reported",
      why: "It says a, and the app needs b: nothing else says b.",
      removeWhen: "The library says b.",
      test: "test/left/SaysB.test.ts"
    })
    expect(read.touched).toEqual(["index.js"])
  })

  it("names each field that is missing or empty, and says when there is no header at all", () => {
    const partly = readPatch(`Package: left\nWhy:\n${diff("a", "b")}`)
    expect([partly.hasHeader, O.isNone(partly.header), partly.missing]).toEqual([
      true,
      true,
      ["Applies-to", "Upstream", "Why", "Remove-when", "Test"]
    ])
    expect(readPatch(diff("a", "b")).hasHeader).toBe(false)
  })

  it("is carried to another resolution by its one line", () => {
    expect(withAppliesTo("vendor/left-bbb.tgz")(patch("vendor/left-aaa.tgz"))).toBe(patch("vendor/left-bbb.tgz"))
  })

  it("is compared with every resolution bun.lock holds for the package, and no other package's", () => {
    const lock = '"left": ["left@1.0.0", "", {}], "x/left": ["left@1.2.0", "", {}], "left-pad": ["left-pad@3.0.0"]'
    expect(resolutionsOf("left")(lock)).toEqual(["1.0.0", "1.2.0"])
  })
})

describe("patches check", () => {
  it.effect(
    "passes a patch that has its header and test, is registered, is for what is installed, and is installed",
    () =>
      Effect.gen(function* () {
        const held = yield* inTree(registry(), checked)
        expect(held).toEqual([
          "out: patches:check OK  1 patch to 1 package: each has its header and its test, applies to what bun.lock holds, and is installed"
        ])
        const none = yield* inTree({ "packages/patches/package.json": json({ name: "@x/patches" }) }, checked)
        expect(none).toEqual(["out: patches:check OK  no dependency is patched"])
      })
  )

  it.effect("refuses a patch with no header, with a field missing, with no test, and one badly named", () =>
    Effect.gen(function* () {
      const lines = yield* inTree(
        registry({
          "packages/patches/left/01-says-b.patch": diff("a", "b"),
          "packages/patches/left/02-no-why.patch": header("1.0.0", { Why: "", Upstream: "ask Dana" }) + diff("b", "c"),
          "packages/patches/left/Third.patch": header("1.0.0", { Test: "test/left/Gone.test.ts" }) + diff("c", "d")
        }),
        checked
      )
      expect(lines).toEqual([
        'err: packages/patches/left/01-says-b.patch: has no header. Above its first "diff --git" write Package, Applies-to, Upstream, Why, Remove-when and Test, a line each (docs/patches.md)',
        'err: packages/patches/left/02-no-why.patch: its header has no "Why:" (docs/patches.md)',
        "err: packages/patches/left/Third.patch: a patch is named by two digits and a few words (01-what-it-fixes.patch): the digits order a package's patches",
        "err: packages/patches/left/Third.patch: its header names the test packages/patches/test/left/Gone.test.ts, which is not there. A patch has a test that fails without it",
        "err: patches:check failed: 4 problems"
      ])
      const unclear = yield* inTree(
        registry({
          "packages/patches/left/01-says-b.patch": header("1.0.0", { Upstream: "ask Dana" }) + diff("a", "b")
        }),
        checked
      )
      expect(unclear[0]).toBe(
        'err: packages/patches/left/01-says-b.patch: Upstream is "ask Dana". Write the address of the issue or pull request (https://…), or "not yet reported"'
      )
    })
  )

  it.effect(
    "takes an address under Upstream only when it has a host and a path: the scheme alone names no report",
    () =>
      Effect.gen(function* () {
        const upstream = (value: string) =>
          inTree(
            registry({
              "packages/patches/left/01-says-b.patch": header("1.0.0", { Upstream: value }) + diff("a", "b"),
              "packages/patches/left.patch": header("1.0.0", { Upstream: value }) + diff("a", "b")
            }),
            checked
          )
        const scheme = yield* upstream("https://")
        expect(scheme[0]).toBe(
          'err: packages/patches/left/01-says-b.patch: Upstream is "https://". Write the address of the issue or pull request (https://…), or "not yet reported"'
        )
        const host = yield* upstream("https://github.com")
        expect(host[0]).toMatch(/Upstream is "https:\/\/github\.com"/)
        const whole = yield* upstream("https://github.com/left/left/issues/12")
        expect(whole[0]).toMatch(/^out: patches:check OK {2}1 patch to 1 package/)
      })
  )

  it.effect(
    "refuses a patch that names another patch's test: what fails without one shows nothing about the other",
    () =>
      Effect.gen(function* () {
        const second = header("1.0.0") + otherDiff("x", "y")
        const lines = yield* inTree(
          registry({
            "packages/patches/left/02-other-says-y.patch": second,
            "packages/patches/left.patch": patch("1.0.0") + second,
            "node_modules/left/other.js": otherSays("y")
          }),
          checked
        )
        expect(lines).toEqual([
          "err: packages/patches/left/02-other-says-y.patch: its header names the test packages/patches/test/left/SaysB.test.ts, which is packages/patches/left/01-says-b.patch's. A patch has a test of its own: what fails without one patch shows nothing about another",
          "err: patches:check failed: 1 problem"
        ])
      })
  )

  it.effect(
    "refuses a task that does not wait for what is installed to be read, in the root's turbo.json or a package's",
    () =>
      Effect.gen(function* () {
        const turbo = (tasks: Readonly<Record<string, unknown>>) =>
          `{\n  // which task waits for which\n  "tasks": ${json(tasks)}\n}\n`
        const wired = {
          transit: { dependsOn: ["^transit", "//#patches:installed"] },
          test: { dependsOn: ["transit"], outputs: [] },
          prove: { dependsOn: ["//#patches:installed"] },
          "//#patches:installed": { cache: false },
          "//#docs:check": {}
        }
        const held = yield* inTree(registry({ "turbo.json": turbo(wired) }), checked)
        expect(held[0]).toMatch(/^out: patches:check OK/)
        const lines = yield* inTree(
          registry({
            "turbo.json": turbo({ ...wired, prove: { outputs: [] }, fold: { dependsOn: ["^build"] } }),
            "packages/patches/turbo.json": turbo({ test: { dependsOn: [] }, lint: { outputs: [] } })
          }),
          checked
        )
        const notWaiting = (file: string, task: string) =>
          `err: ${file}: the task "${task}" does not wait for //#patches:installed, so it can run on an install that is behind the patches and be replayed after \`bun install\` as if it had run with them. Add "//#patches:installed" to its dependsOn, or to a task it depends on`
        expect(lines).toEqual([
          notWaiting("turbo.json", "prove"),
          notWaiting("turbo.json", "fold"),
          notWaiting("packages/patches/turbo.json", "test"),
          "err: patches:check failed: 3 problems"
        ])
      })
  )

  it("follows a task to the one it waits for, through the tasks between, and stops at a circle", () => {
    const root = { transit: ["^transit", "//#patches:installed"], test: ["transit"], a: ["b"], b: ["a"] }
    expect([waits(root)(["transit"]), waits(root)(["test"]), waits(root)(["a"]), waits(root)([])]).toEqual([
      true,
      true,
      false,
      false
    ])
  })

  it.effect("refuses a patch for a version that is no longer installed", () =>
    Effect.gen(function* () {
      const lines = yield* inTree(
        registry({ "bun.lock": '{ "packages": { "left": ["left@1.1.0", "", {}, "sha512-y"] } }\n' }),
        checked
      )
      expect(lines).toEqual([
        "err: packages/patches/left: its patches apply to left@1.0.0, and bun.lock holds 1.1.0: a patch for a version that is no longer installed. Re-make each patch for what is installed, or drop it",
        "err: patches:check failed: 1 problem"
      ])
    })
  )

  it.effect("refuses what bun would not apply: a file that is not its patches, a missing or a stale registration", () =>
    Effect.gen(function* () {
      const lines = yield* inTree(
        registry({
          "package.json": json({
            name: "root",
            workspaces: ["packages/*"],
            patchedDependencies: { "left@0.9.0": "packages/patches/left.patch" }
          }),
          "packages/patches/left.patch": patch("1.0.0") + diff("b", "c"),
          "packages/patches/right.patch": diff("a", "b")
        }),
        checked
      )
      expect(lines).toEqual([
        "err: packages/patches/left.patch: is not the patches of packages/patches/left one after another, so bun applies something else. Run `bun run beep patches build`, then `bun install`",
        'err: package.json: patchedDependencies does not give "left@1.0.0" the file "packages/patches/left.patch", so bun does not apply it. Add that line, then run `bun install`',
        "err: packages/patches/right.patch: no folder of that name holds its patches. Remove it, or move its diff into a folder as one patch",
        'err: package.json: patchedDependencies gives "left@0.9.0" the file "packages/patches/left.patch", and no folder under packages/patches holds patches for that. Remove the line, or give the patch its folder and header',
        "err: patches:check failed: 4 problems"
      ])
    })
  )

  it.effect("refuses an install that does not hold the patch: bun installed the package unpatched", () =>
    Effect.gen(function* () {
      const lines = yield* inTree(registry({ "node_modules/left/index.js": says("a") }), checked)
      expect(lines).toEqual([
        "err: node_modules/left: does not hold what packages/patches/left.patch writes, so the package runs unpatched. Run `bun install`",
        "err: patches:check failed: 1 problem"
      ])
    })
  )

  it.effect("applies each patch to the kept file, and names the one that no longer applies", () =>
    Effect.gen(function* () {
      const applies = yield* inTree(kept({ aaa: "a" }), packed(["aaa"], checked))
      expect(applies).toEqual([
        "out: patches:check OK  1 patch to 1 package: each has its header and its test, applies to what bun.lock holds, and is installed"
      ])
      const lines = yield* inTree(kept({ aaa: "z" }), packed(["aaa"], checked))
      expect(lines[0]).toMatch(
        /^err: packages\/patches\/left\/01-says-b\.patch: no longer applies to vendor\/left-aaa\.tgz \(error: patch failed: index\.js:1\)\. Re-make the patch, or drop it if the library fixed the defect$/
      )
    })
  )
})

describe("patches build", () => {
  it.effect("writes the file bun reads as the package's patches one after another, in the order of their names", () =>
    Effect.gen(function* () {
      const second = header("1.0.0") + diff("b", "c")
      const [lines, built, again] = yield* inTree(
        registry({ "packages/patches/left/02-says-c.patch": second }),
        Effect.gen(function* () {
          const repo = yield* Repo
          const first = yield* patchesBuild()
          const text = yield* repo.text(repo.join(repo.root, "packages/patches/left.patch"))
          const next = yield* patchesBuild()
          return [
            printed(render(patchesBuildSentence)(first)),
            text,
            printed(render(patchesBuildSentence)(next))
          ] as const
        })
      )
      expect(lines).toEqual(["out: patches:build  wrote packages/patches/left.patch from 2 patches: run `bun install`"])
      expect(built).toBe(patch("1.0.0") + second)
      expect(again).toEqual(["out: patches:build OK  1 file is already what the patches say"])
    })
  )
})

describe("patches carry", () => {
  const moved = (files: Tree = {}) => ({
    "package.json": json({
      name: "root",
      workspaces: ["packages/*"],
      overrides: { left: "file:vendor/left-bbb.tgz" },
      patchedDependencies: { "left@vendor/left-aaa.tgz": "packages/patches/left.patch" }
    }),
    ...files
  })
  const after = Effect.gen(function* () {
    const repo = yield* Repo
    const carried = yield* patchesCarry()
    const lines = printed(render(patchesCarrySentence)(carried))
    const manifest = yield* repo.text(repo.join(repo.root, "package.json"))
    const { sets } = yield* readPatches()
    const built = yield* repo.text(repo.join(repo.root, "packages/patches/left.patch"))
    return {
      lines,
      registered: Str.includes('"left@vendor/left-bbb.tgz":"packages/patches/left.patch"')(manifest),
      appliesTo: A.flatMap(sets, (set) => A.map(set.patches, (file) => O.map(file.read.header, (h) => h.appliesTo))),
      built
    }
  })

  it.effect("carries a package's patches to the file it is redirected to now, when each applies there", () =>
    Effect.gen(function* () {
      const carried = yield* inTree(kept({ aaa: "a", bbb: "a" }, moved()), packed(["aaa", "bbb"], after))
      expect(carried.lines).toEqual([
        "out: patches:carry  packages/patches/left: 1 patch carried from vendor/left-aaa.tgz to vendor/left-bbb.tgz. Whether each is still needed is `bun run beep patches prove`'s to say"
      ])
      expect(carried.registered).toBe(true)
      expect(carried.appliesTo).toEqual([O.some("vendor/left-bbb.tgz")])
      expect(carried.built).toBe(patch("vendor/left-bbb.tgz"))
    })
  )

  it.effect("stops on a patch that does not apply to the new file, and writes nothing", () =>
    Effect.gen(function* () {
      const stopped = yield* inTree(kept({ aaa: "a", bbb: "b" }, moved()), packed(["aaa", "bbb"], after))
      expect(stopped.lines).toHaveLength(1)
      expect(stopped.lines[0]).toMatch(
        /^err: packages\/patches\/left\/01-says-b\.patch: was made for vendor\/left-aaa\.tgz and does not apply to vendor\/left-bbb\.tgz \(error: patch failed: index\.js:1\)\. On the old pin, re-make the patch for the new code or drop it \(docs\/patches\.md\), then move the pin again$/
      )
      expect(stopped.registered).toBe(false)
      expect(stopped.appliesTo).toEqual([O.some("vendor/left-aaa.tgz")])
      expect(stopped.built).toBe(patch("vendor/left-aaa.tgz"))
    })
  )

  it.effect("has nothing to do while every patch names the file its package is redirected to", () =>
    Effect.gen(function* () {
      const still = yield* inTree(kept({ aaa: "a" }), packed(["aaa"], after))
      expect(still.lines).toEqual([
        "out: patches:carry OK  every patch of a kept package names the file the package is redirected to"
      ])
    })
  )
})

describe("patches installed", () => {
  const installed = Effect.map(patchesInstalled(), (findings) => printed(render(patchesInstalledSentence)(findings)))

  it("reads the package from a key of patchedDependencies, a scoped one too", () => {
    expect([packageOf("left@1.0.0"), packageOf("@x/left@vendor/x-left-aaa.tgz")]).toEqual(["left", "@x/left"])
  })

  it.effect("passes when what is installed holds what each registered file writes, reading no header", () =>
    Effect.gen(function* () {
      const held = yield* inTree(registry({ "packages/patches/left/01-says-b.patch": diff("a", "b") }), installed)
      expect(held).toEqual(["out: patches:installed OK  1 patched package is installed with what the patches write"])
    })
  )

  it.effect("refuses an install made before the patch: every task that runs code waits for this", () =>
    Effect.gen(function* () {
      const behind = yield* inTree(registry({ "node_modules/left/index.js": says("a") }), installed)
      expect(behind).toEqual([
        "err: node_modules/left: does not hold what packages/patches/left.patch writes, so nothing was run: a test or a proof would run on the package as it was before and be replayed later as if it had run with the patch. Run `bun install`",
        "err: patches:installed failed: 1 package not installed as patched"
      ])
    })
  )
})

describe("patches prove", () => {
  // The real vitest runs each test: the small repository gets the installed one, as a link.
  const vitest = new URL("../../../../../node_modules/vitest", import.meta.url).pathname
  const proved = Effect.gen(function* () {
    const repo = yield* Repo
    yield* repo.run("ln", ["-s", vitest, repo.join(repo.root, "node_modules/vitest")])
    const findings = yield* patchesProve()
    return printed(render(patchesProveSentence)(findings))
  })
  const expects = (what: string, how: "toBe" | "not.toBe" = "toBe") =>
    `import { expect, it } from "vitest"\nimport { said } from "left"\n\nit("says it", () => {\n  expect(said).${how}("${what}")\n})\n`
  const two = (second: string, files: Tree): Tree =>
    registry({
      "packages/patches/left/02-second.patch": second,
      "packages/patches/left.patch": patch("1.0.0") + second,
      "node_modules/left/package.json": json({ name: "left", version: "1.0.0", type: "module", main: "index.js" }),
      ...files
    })

  it.effect("leaves out one patch at a time: a patch that names another's test is not shown to be needed", () =>
    Effect.gen(function* () {
      const lines = yield* inTree(
        two(header("1.0.0") + otherDiff("x", "y"), {
          "node_modules/left/other.js": otherSays("y"),
          "packages/patches/test/left/SaysB.test.ts": expects("b")
        }),
        proved
      )
      expect(lines).toEqual([
        "out:   needed  packages/patches/left/01-says-b.patch: with it left out and the others applied, 1 of its tests fails",
        'err: packages/patches/left/02-second.patch: its test packages/patches/test/left/SaysB.test.ts passes with this patch left out and the others applied. If the library fixed the defect, drop the patch (docs/patches.md, "Dropping a patch"); if not, the test does not test this patch',
        "err: patches:prove failed: 1 patch not shown to be needed"
      ])
    })
  )

  const onTop = header("1.0.0", { Test: "test/left/second/SaysC.test.ts" }) + diff("b", "c")

  it.effect(
    "leaves out a later patch written on the same lines too, and runs the test once more with only that out",
    () =>
      Effect.gen(function* () {
        const lines = yield* inTree(
          two(onTop, {
            "node_modules/left/index.js": says("c"),
            "packages/patches/test/left/SaysB.test.ts": expects("a", "not.toBe"),
            "packages/patches/test/left/second/SaysC.test.ts": expects("c")
          }),
          proved
        )
        expect(lines).toEqual([
          "out:   needed  packages/patches/left/01-says-b.patch: with it left out and the others applied, 1 of its tests fails (02-second.patch does not apply without it and was left out too; with only that out, the test passes)",
          "out:   needed  packages/patches/left/02-second.patch: with it left out and the others applied, 1 of its tests fails",
          "out: patches:prove OK  2 patches: each one's test fails with that patch alone left out"
        ])
      })
  )

  it.effect("refuses a test that fails for the later patch's sake: it shows nothing about the earlier one", () =>
    Effect.gen(function* () {
      const lines = yield* inTree(
        two(onTop, {
          "node_modules/left/index.js": says("c"),
          "packages/patches/test/left/SaysB.test.ts": expects("c"),
          "packages/patches/test/left/second/SaysC.test.ts": expects("c")
        }),
        proved
      )
      expect(lines).toEqual([
        "err: packages/patches/left/01-says-b.patch: its test packages/patches/test/left/SaysB.test.ts fails with this patch applied once 02-second.patch is left out, so the test is of that later patch and shows nothing about this one. Give this patch a test of what it alone fixes",
        "out:   needed  packages/patches/left/02-second.patch: with it left out and the others applied, 1 of its tests fails",
        "err: patches:prove failed: 1 patch not shown to be needed"
      ])
    })
  )
})

describe("a package with one patch left out, for a proof", () => {
  const second = header("vendor/left-aaa.tgz") + otherDiff("x", "y")
  const without = Effect.fnUntraced(function* (out: string) {
    const repo = yield* Repo
    const { sets } = yield* readPatches()
    const into = repo.join(repo.root, "proof/node_modules/left")
    const made = yield* withoutSome(O.getOrThrow(A.head(sets)), "left", "vendor/left-aaa.tgz", [out], into)
    const index = yield* repo.text(repo.join(into, "index.js"))
    const other = yield* repo.text(repo.join(into, "other.js"))
    return [index, other, A.map(made.refused, (file) => file.name)] as const
  })
  const tree = (files: Tree) =>
    kept(
      { aaa: "a" },
      { "stage/aaa/package/other.js": otherSays("x"), "packages/patches/left/02-second.patch": second, ...files }
    )

  it.effect("holds every other patch of the package, applied to the kept file in order", () =>
    Effect.gen(function* () {
      const first = yield* inTree(tree({}), packed(["aaa"], without("01-says-b.patch")))
      expect(first).toEqual([says("a"), otherSays("y"), []])
      const last = yield* inTree(tree({}), packed(["aaa"], without("02-second.patch")))
      expect(last).toEqual([says("b"), otherSays("x"), []])
    })
  )

  it.effect("names a later patch that does not apply without the one left out", () =>
    Effect.gen(function* () {
      const made = yield* inTree(
        tree({ "packages/patches/left/02-second.patch": header("vendor/left-aaa.tgz") + diff("b", "c") }),
        packed(["aaa"], without("01-says-b.patch"))
      )
      expect(made).toEqual([says("a"), otherSays("x"), ["02-second.patch"]])
    })
  )
})

describe("a package without its patches, for a proof", () => {
  const unpatched = Effect.fnUntraced(function* (appliesTo: string) {
    const repo = yield* Repo
    const { sets } = yield* readPatches()
    const into = repo.join(repo.root, "proof/node_modules/left")
    const refused = yield* withoutPatches(O.getOrThrow(A.head(sets)), "left", appliesTo, into)
    const text = yield* repo.text(repo.join(into, "index.js"))
    return [O.isNone(refused), text] as const
  })

  it.effect("is the kept file unpacked", () =>
    Effect.gen(function* () {
      const without = yield* inTree(kept({ aaa: "a" }), packed(["aaa"], unpatched("vendor/left-aaa.tgz")))
      expect(without).toEqual([true, says("a")])
    })
  )

  it.effect("is what is installed with the patches taken out again, for a package from a registry", () =>
    Effect.gen(function* () {
      const without = yield* inTree(registry(), unpatched("1.0.0"))
      expect(without).toEqual([true, says("a")])
    })
  )
})
