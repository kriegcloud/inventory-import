/**
 * Fails when a vendored file no longer matches what was copied. Every package under `packages/` with a `vendor.json`
 * (written by `vendor sync`) is checked:
 *
 * - each listed file exists and starts with its provenance line, naming the recorded commit and upstream path;
 * - the SHA-256 of the rest of the file equals the recorded one, and, for a file copied without rewrites or patches,
 *   the recorded upstream (source) hash too: a vendored source file is the upstream file, byte for byte, unless
 *   `vendor.json` lists a patch for it, with its reason, which this check then reports;
 * - `src/` and `test/` hold nothing that is neither listed nor one of the package's local files;
 * - `package.json`'s exports are the recorded ones.
 *
 * With a source checkout, every recorded source hash is also compared with the file at the recorded commit there,
 * which proves the record itself.
 *
 * @packageDocumentation
 */
import { $RepoCliId } from "@beep/identity/packages"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as P from "effect/Predicate"
import * as S from "effect/Schema"
import * as Str from "effect/String"
import type { RepoError } from "../../Cli.errors.ts"
import { Repo } from "../../Repo.service.ts"
import { err, type Line, out } from "../../Report.schema.ts"
import { ExportsOnly, type VendorFile, VendorRecord } from "./Vendor.schema.ts"

const $I = $RepoCliId.create("commands/Vendor/VendorCheck.rules")

/**
 * What `vendor check` finds: every file matching its record (and each file patched on purpose), or each problem and
 * their count.
 *
 * @category schemas
 */
export const VendorCheckFinding = S.TaggedUnion({
  Matched: {
    files: S.Int.pipe(S.annotateKey({ description: "How many vendored files were checked" })),
    packages: S.Int.pipe(S.annotateKey({ description: "In how many packages" })),
    againstSource: S.Boolean.pipe(
      S.annotateKey({ description: "Whether each source hash was also proved against a beep-effect checkout" })
    )
  },
  Patched: {
    file: S.String.pipe(S.annotateKey({ description: "The vendored file, from the root" })),
    patches: S.Int.pipe(S.annotateKey({ description: "How many patches it lists" })),
    commit: S.String.pipe(S.annotateKey({ description: "The beep-effect commit, shortened" }))
  },
  Missing: { file: S.String.pipe(S.annotateKey({ description: "The vendored file, from the root" })) },
  NoProvenance: {
    file: S.String.pipe(S.annotateKey({ description: "The vendored file, from the root" })),
    expected: S.String.pipe(S.annotateKey({ description: "How its first line must start" }))
  },
  Changed: {
    file: S.String.pipe(S.annotateKey({ description: "The vendored file, from the root" })),
    sha256: S.String.pipe(S.annotateKey({ description: "What the file hashes to now" }))
  },
  HashDiffers: { file: S.String.pipe(S.annotateKey({ description: "The vendored file, from the root" })) },
  PatchEqualsUpstream: { file: S.String.pipe(S.annotateKey({ description: "The vendored file, from the root" })) },
  PatchWithoutReason: { file: S.String.pipe(S.annotateKey({ description: "The vendored file, from the root" })) },
  PatchUnsaid: { file: S.String.pipe(S.annotateKey({ description: "The vendored file, from the root" })) },
  SourceHashWrong: {
    file: S.String.pipe(S.annotateKey({ description: "The vendored file, from the root" })),
    commit: S.String.pipe(S.annotateKey({ description: "The beep-effect commit, shortened" }))
  },
  Stray: {
    file: S.String.pipe(S.annotateKey({ description: "A file that is neither vendored nor local, from the root" }))
  },
  ExportsDiffer: { where: S.String.pipe(S.annotateKey({ description: "The package's folder, from the root" })) },
  Failed: { problems: S.Int.pipe(S.annotateKey({ description: "How many problems were found" })) }
}).pipe(
  $I.annoteSchema("VendorCheckFinding", { description: "The kit matching its record, or each way a file does not" })
)

/**
 * The decoded value of `VendorCheckFinding`.
 *
 * @category models
 */
export type VendorCheckFinding = typeof VendorCheckFinding.Type

/**
 * The line each finding prints.
 *
 * @category rendering
 */
export const vendorCheckSentence: (finding: VendorCheckFinding) => Line = VendorCheckFinding.match({
  Matched: ({ files, packages, againstSource }) =>
    out(
      `vendor:check: ${files} vendored files in ${packages} packages match their recorded hashes` +
        (againstSource ? " and beep-effect" : "")
    ),
  Patched: ({ file, patches, commit }) =>
    out(
      `vendor:check: patched on purpose: ${file} (${patches} patch${patches === 1 ? "" : "es"}, against beep-effect ${commit})`
    ),
  Missing: ({ file }) => err(`${file}: listed in vendor.json but missing`),
  NoProvenance: ({ file, expected }) => err(`${file}: the first line is not its provenance line (${expected} …)`),
  Changed: ({ file, sha256 }) => err(`${file}: changed since it was vendored (sha256 ${sha256})`),
  HashDiffers: ({ file }) => err(`${file}: copied without rewrites, yet its hash differs from its source hash`),
  PatchEqualsUpstream: ({ file }) => err(`${file}: lists a patch, yet equals upstream`),
  PatchWithoutReason: ({ file }) => err(`${file}: a patch has no reason`),
  PatchUnsaid: ({ file }) => err(`${file}: patched, but its first line does not say so`),
  SourceHashWrong: ({ file, commit }) => err(`${file}: the recorded source hash is not that of beep-effect ${commit}`),
  Stray: ({ file }) => err(`${file}: not vendored and not a local file`),
  ExportsDiffer: ({ where }) => err(`${where}/package.json: exports differ from those recorded in vendor.json`),
  Failed: ({ problems }) => err(`vendor:check failed: ${problems} problem${problems === 1 ? "" : "s"}`)
})

const decoder = new TextDecoder()
const asJson = S.encodeEffect(S.fromJsonString(S.Unknown))

interface Checked {
  readonly problems: ReadonlyArray<VendorCheckFinding>
  readonly patched: ReadonlyArray<VendorCheckFinding>
  readonly counted: number
}

const nothing: Checked = { problems: [], patched: [], counted: 0 }
const problem = (finding: VendorCheckFinding): Checked => ({ problems: [finding], patched: [], counted: 0 })
const merge = (all: ReadonlyArray<Checked>): Checked => ({
  problems: A.flatMap(all, (one) => one.problems),
  patched: A.flatMap(all, (one) => one.patched),
  counted: A.reduce(all, 0, (sum, one) => sum + one.counted)
})

/**
 * Checks every vendored package; `source` is a beep-effect checkout to prove the recorded source hashes against.
 *
 * @category rules
 */
export const vendorCheck = Effect.fn("VendorCheck.vendorCheck")(function* (source: O.Option<string>) {
  const repo = yield* Repo
  const manifestsUnder: (dir: string) => Effect.Effect<ReadonlyArray<string>, RepoError> = Effect.fn(
    "VendorCheck.manifestsUnder"
  )(function* (dir: string) {
    const entries = yield* repo.entries(dir)
    const nested = yield* Effect.forEach(
      A.filter(entries, (entry) => entry.name !== "node_modules" && !Str.startsWith(".")(entry.name)),
      (entry) =>
        entry.directory
          ? manifestsUnder(entry.path)
          : Effect.succeed(entry.name === "vendor.json" ? A.of(entry.path) : A.empty<string>()),
      { concurrency: 1 }
    )
    return A.flatten(nested)
  })
  const manifests = yield* manifestsUnder(repo.join(repo.root, "packages"))

  const perPackage = yield* Effect.forEach(
    manifests,
    Effect.fnUntraced(function* (manifestPath) {
      const dir = repo.dirname(manifestPath)
      const where = repo.relative(repo.root, dir)
      const manifest = yield* repo.json(VendorRecord)(manifestPath)
      const commit = Str.slice(0, 12)(manifest.source.commit)
      const upstreamDir = manifest.source.path
      const listed = A.appendAll(
        A.map(manifest.files, (file) => file.path),
        manifest.local
      )

      const checkFile = Effect.fnUntraced(function* (entry: VendorFile) {
        const name = `${where}/${entry.path}`
        const file = repo.join(dir, entry.path)
        if (!(yield* repo.exists(file))) return problem(VendorCheckFinding.cases.Missing.make({ file: name }))
        const content = yield* repo.bytes(file)
        const newline = content.indexOf(0x0a)
        const first = decoder.decode(content.subarray(0, newline))
        const expectedFirst = `// Vendored from beep-effect ${commit}:${upstreamDir}/${entry.path} `
        if (newline === -1 || !Str.startsWith(expectedFirst)(first)) {
          return problem(VendorCheckFinding.cases.NoProvenance.make({ file: name, expected: Str.trim(expectedFirst) }))
        }
        const actual = yield* repo.sha256(content.subarray(newline + 1))
        const patches = entry.patches ?? []
        const upstreamHash = yield* O.match(source, {
          onNone: () => Effect.succeedNone,
          onSome: (checkout) =>
            repo.run("git", ["-C", checkout, "show", `${manifest.source.commit}:${upstreamDir}/${entry.path}`]).pipe(
              Effect.flatMap((answer) => repo.sha256(answer.bytes)),
              Effect.asSome
            )
        })
        const one = (finding: VendorCheckFinding) => A.of(finding)
        const none = A.empty<VendorCheckFinding>()
        const problems = A.flatten([
          actual !== entry.sha256 ? one(VendorCheckFinding.cases.Changed.make({ file: name, sha256: actual })) : none,
          entry.rewrites.length === 0 && patches.length === 0 && entry.sha256 !== entry.sourceSha256
            ? one(VendorCheckFinding.cases.HashDiffers.make({ file: name }))
            : none,
          patches.length > 0 && entry.sha256 === entry.sourceSha256
            ? one(VendorCheckFinding.cases.PatchEqualsUpstream.make({ file: name }))
            : none,
          patches.length > 0 && !A.every(patches, (patch) => P.isString(patch.reason) && patch.reason.length > 0)
            ? one(VendorCheckFinding.cases.PatchWithoutReason.make({ file: name }))
            : none,
          patches.length > 0 && !Str.includes("Patched on purpose")(first)
            ? one(VendorCheckFinding.cases.PatchUnsaid.make({ file: name }))
            : none,
          O.exists(upstreamHash, (hash) => hash !== entry.sourceSha256)
            ? one(VendorCheckFinding.cases.SourceHashWrong.make({ file: name, commit }))
            : none
        ])
        const patched =
          patches.length > 0
            ? one(VendorCheckFinding.cases.Patched.make({ file: name, patches: patches.length, commit }))
            : none
        return { problems, patched, counted: 1 } satisfies Checked
      })
      const files = yield* Effect.forEach(manifest.files, checkFile, { concurrency: 1 })

      const strays = yield* Effect.forEach(
        ["src", "test"],
        (sub) =>
          repo.files(repo.join(dir, sub)).pipe(
            Effect.map((found) =>
              A.flatMap(found, (file) => {
                const inside = repo.relative(dir, file)
                return A.contains(listed, inside)
                  ? A.empty<VendorCheckFinding>()
                  : A.of<VendorCheckFinding>(VendorCheckFinding.cases.Stray.make({ file: `${where}/${inside}` }))
              })
            )
          ),
        { concurrency: 1 }
      )

      const own = yield* repo.json(ExportsOnly)(repo.join(dir, "package.json"))
      const ownExports = yield* asJson(own.exports).pipe(Effect.orDie)
      const recorded = yield* asJson(manifest.exports).pipe(Effect.orDie)
      const exportsDiffer =
        ownExports === recorded ? nothing : problem(VendorCheckFinding.cases.ExportsDiffer.make({ where }))
      return merge([
        ...files,
        { problems: A.flatten(strays), patched: A.empty<VendorCheckFinding>(), counted: 0 },
        exportsDiffer
      ])
    }),
    { concurrency: 1 }
  )
  const all = merge(perPackage)
  if (A.isReadonlyArrayNonEmpty(all.problems)) {
    return A.append<VendorCheckFinding, VendorCheckFinding>(
      all.problems,
      VendorCheckFinding.cases.Failed.make({ problems: all.problems.length })
    )
  }
  return A.prepend<VendorCheckFinding, VendorCheckFinding>(
    all.patched,
    VendorCheckFinding.cases.Matched.make({
      files: all.counted,
      packages: manifests.length,
      againstSource: O.isSome(source)
    })
  )
})
