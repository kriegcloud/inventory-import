/**
 * A patch to a dependency, as the repository keeps one (docs/patches.md): one file a defect, with a header that says
 * what it applies to, where the defect is reported, why the repository needs it and when it goes.
 *
 * bun reads one patch file a package, so the patches of a package are kept in one folder, a file each, and the file
 * bun reads is those files one after another, in the order of their names.
 *
 * @packageDocumentation
 */
import { $RepoCliId } from "@beep/identity/packages"
import * as A from "effect/Array"
import * as O from "effect/Option"
import * as R from "effect/Record"
import * as S from "effect/Schema"
import * as Str from "effect/String"

const $I = $RepoCliId.create("commands/Patches/Patches.schema")

/**
 * The workspace that holds every patch, from the root: a folder for each patched package, the file bun reads beside
 * each folder, and the tests under `test`.
 *
 * @category models
 */
export const patchesFolder = "packages/patches"

/**
 * What `Upstream` says when the defect has not been reported yet. Anything else there is the address of the issue or
 * pull request.
 *
 * @category models
 */
export const notYetReported = "not yet reported"

/**
 * The fields every patch's header has, in the order they are written.
 *
 * @category models
 */
export const headerFields = ["Package", "Applies-to", "Upstream", "Why", "Remove-when", "Test"] as const

/**
 * A patch's header: the lines above its first `diff --git`.
 *
 * `appliesTo` is the package's resolution as `bun.lock` writes it after the `@`: an exact version for a package from
 * a registry, the kept file for a package kept as a file (`vendor/alchemy/alchemy.run-domain-734c27a.tgz`, whose
 * name carries the commit). So a patch for a version that is no longer installed is one whose `appliesTo` the
 * lockfile no longer holds.
 *
 * @category schemas
 */
export class PatchHeader extends S.Class<PatchHeader, { readonly brand: unique symbol }>($I`PatchHeader`)(
  {
    package: S.String.pipe(S.annotateKey({ description: "The dependency's name" })),
    appliesTo: S.String.pipe(
      S.annotateKey({ description: "Its resolution in bun.lock: an exact version, or the kept file" })
    ),
    upstream: S.String.pipe(
      S.annotateKey({ description: "The address of the issue or pull request, or `not yet reported`" })
    ),
    why: S.String.pipe(S.annotateKey({ description: "What the repository needs it for" })),
    removeWhen: S.String.pipe(S.annotateKey({ description: "What has to be true for the patch to be dropped" })),
    test: S.String.pipe(
      S.annotateKey({ description: "The test that fails without it, from the patches workspace's folder" })
    )
  },
  $I.annote("PatchHeader", { description: "What a patch applies to, where it is reported, why and until when" })
) {}

/** A patch file read: its header when every field is there, the fields that are not, and the files its diff changes. */
export interface PatchRead {
  readonly header: O.Option<PatchHeader>
  /** The header's fields that are missing or empty, by the name they are written under. */
  readonly missing: ReadonlyArray<string>
  /** Whether any line above the diff is a field at all. */
  readonly hasHeader: boolean
  /** The files the diff changes, each from the package's root. */
  readonly touched: ReadonlyArray<string>
}

const field = /^([A-Z][A-Za-z-]*): ?(.*)$/
const diffStart = /^diff --git a\/(\S+) b\//

/**
 * Reads a patch file's text. A field is a line `Name: value`; a line that starts with a space continues the field
 * above it, so a reason can be more than one line.
 *
 * @example
 * readPatch("Package: effect\nApplies-to: 4.1.5\nUpstream: not yet reported\nWhy: a\n  b\nRemove-when: c\nTest: test/x.test.ts\n\ndiff --git a/lib/a.js b/lib/a.js\n")
 * // header: some({ package: "effect", appliesTo: "4.1.5", ..., why: "a b" }), touched: ["lib/a.js"]
 *
 * @category rules
 */
export const readPatch = (text: string): PatchRead => {
  const lines = Str.split("\n")(text)
  const above = A.takeWhile(lines, (line) => !diffStart.test(line))
  const read = A.reduce(above, { fields: R.empty<string, string>(), last: O.none<string>() }, (state, line) => {
    const match = field.exec(line)
    if (match !== null) {
      const name = match[1] ?? ""
      return { fields: R.set(state.fields, name, Str.trim(match[2] ?? "")), last: O.some(name) }
    }
    if (/^\s+\S/.test(line) && O.isSome(state.last)) {
      const name = state.last.value
      const before = O.getOrElse(R.get(state.fields, name), () => "")
      return { ...state, fields: R.set(state.fields, name, Str.trim(`${before} ${Str.trim(line)}`)) }
    }
    return state
  })
  const valueOf = (name: string) => O.filter(R.get(read.fields, name), Str.isNonEmpty)
  const missing = A.filter(headerFields, (name) => O.isNone(valueOf(name)))
  const header = O.all({
    package: valueOf("Package"),
    appliesTo: valueOf("Applies-to"),
    upstream: valueOf("Upstream"),
    why: valueOf("Why"),
    removeWhen: valueOf("Remove-when"),
    test: valueOf("Test")
  }).pipe(O.map((fields) => PatchHeader.make(fields)))
  return {
    header,
    missing,
    hasHeader: A.some(headerFields, (name) => R.has(read.fields, name)),
    touched: A.dedupe(A.flatMap(lines, (line) => O.toArray(O.fromNullishOr(diffStart.exec(line)?.[1]))))
  }
}

/**
 * A patch's text with another `Applies-to`: the one line changed, every other byte as it was.
 *
 * @category rules
 */
export const withAppliesTo =
  (appliesTo: string) =>
  (text: string): string =>
    Str.replace(/^Applies-to: ?.*$/m, `Applies-to: ${appliesTo}`)(text)

/**
 * The parts of the root's `package.json` the patches are wired through: which file bun applies to which resolved
 * package, and which kept file a package is redirected to.
 *
 * @category schemas
 */
export class PatchedManifest extends S.Class<PatchedManifest, { readonly brand: unique symbol }>($I`PatchedManifest`)(
  {
    patchedDependencies: S.Record(S.String, S.String).pipe(
      S.optionalKey,
      S.annotateKey({ description: "`name@resolution` to the patch file bun applies to it, from the root" })
    ),
    overrides: S.Record(S.String, S.String).pipe(
      S.optionalKey,
      S.annotateKey({ description: "A package redirected to another spec: `file:` and a path for a kept file" })
    )
  },
  $I.annote("PatchedManifest", { description: "The root package.json's patched and redirected dependencies" })
) {}

/**
 * What vitest's JSON reporter says of a run, as far as a proof reads it.
 *
 * @category schemas
 */
export class TestRun extends S.Class<TestRun, { readonly brand: unique symbol }>($I`TestRun`)(
  {
    numTotalTests: S.Int.pipe(S.annotateKey({ description: "How many tests the run found" })),
    numPassedTests: S.Int.pipe(S.annotateKey({ description: "How many of them passed" })),
    numFailedTests: S.Int.pipe(S.annotateKey({ description: "How many of them failed" }))
  },
  $I.annote("TestRun", { description: "The counts of a vitest run, from its JSON report" })
) {}
