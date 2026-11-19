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
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as P from "effect/Predicate"
import * as S from "effect/Schema"
import * as Str from "effect/String"
import type { RepoError } from "../../Cli.errors.ts"
import { Repo } from "../../Repo.service.ts"
import { err, failed, type Line, out, passed } from "../../Report.schema.ts"
import { ExportsOnly, type VendorFile, VendorRecord } from "./Vendor.schema.ts"

const decoder = new TextDecoder()
const asJson = S.encodeEffect(S.fromJsonString(S.Unknown))

interface Checked {
  readonly problems: ReadonlyArray<string>
  readonly patched: ReadonlyArray<string>
  readonly counted: number
}

const nothing: Checked = { problems: [], patched: [], counted: 0 }
const problem = (text: string): Checked => ({ problems: [text], patched: [], counted: 0 })
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
        if (!(yield* repo.exists(file))) return problem(`${name}: listed in vendor.json but missing`)
        const content = yield* repo.bytes(file)
        const newline = content.indexOf(0x0a)
        const first = decoder.decode(content.subarray(0, newline))
        const expectedFirst = `// Vendored from beep-effect ${commit}:${upstreamDir}/${entry.path} `
        if (newline === -1 || !Str.startsWith(expectedFirst)(first)) {
          return problem(`${name}: the first line is not its provenance line (${Str.trim(expectedFirst)} …)`)
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
        const problems = A.flatten<ReadonlyArray<ReadonlyArray<string>>>([
          actual !== entry.sha256 ? A.of(`${name}: changed since it was vendored (sha256 ${actual})`) : [],
          entry.rewrites.length === 0 && patches.length === 0 && entry.sha256 !== entry.sourceSha256
            ? A.of(`${name}: copied without rewrites, yet its hash differs from its source hash`)
            : [],
          patches.length > 0 && entry.sha256 === entry.sourceSha256
            ? A.of(`${name}: lists a patch, yet equals upstream`)
            : [],
          patches.length > 0 && !A.every(patches, (patch) => P.isString(patch.reason) && patch.reason.length > 0)
            ? A.of(`${name}: a patch has no reason`)
            : [],
          patches.length > 0 && !Str.includes("Patched on purpose")(first)
            ? A.of(`${name}: patched, but its first line does not say so`)
            : [],
          O.exists(upstreamHash, (hash) => hash !== entry.sourceSha256)
            ? A.of(`${name}: the recorded source hash is not that of beep-effect ${commit}`)
            : []
        ])
        const patched =
          patches.length > 0
            ? A.of(
                `${name} (${patches.length} patch${patches.length === 1 ? "" : "es"}, against beep-effect ${commit})`
              )
            : A.empty<string>()
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
                  ? A.empty<string>()
                  : A.of(`${where}/${inside}: not vendored and not a local file`)
              })
            )
          ),
        { concurrency: 1 }
      )

      const own = yield* repo.json(ExportsOnly)(repo.join(dir, "package.json"))
      const ownExports = yield* asJson(own.exports).pipe(Effect.orDie)
      const recorded = yield* asJson(manifest.exports).pipe(Effect.orDie)
      const exportsDiffer =
        ownExports === recorded
          ? nothing
          : problem(`${where}/package.json: exports differ from those recorded in vendor.json`)
      return merge([...files, { problems: A.flatten(strays), patched: A.empty<string>(), counted: 0 }, exportsDiffer])
    }),
    { concurrency: 1 }
  )
  const all = merge(perPackage)
  if (A.isReadonlyArrayNonEmpty(all.problems)) {
    return failed(
      A.append(
        A.map(all.problems, err),
        err(`vendor:check failed: ${all.problems.length} problem${all.problems.length === 1 ? "" : "s"}`)
      )
    )
  }
  return passed(
    A.prepend(
      A.map(all.patched, (file): Line => out(`vendor:check: patched on purpose: ${file}`)),
      out(
        `vendor:check: ${all.counted} vendored files in ${manifests.length} packages match their recorded hashes` +
          (O.isSome(source) ? " and beep-effect" : "")
      )
    )
  )
})
