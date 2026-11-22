/**
 * `patches carry`: what a re-pin does with the patches of a package kept as a file (docs/patches.md).
 *
 * A re-pin gives a kept package another file, whose name carries the new commit. The patches made for the old file
 * are then for a resolution nothing installs: bun warns once and installs the package unpatched. So the re-pin
 * calls this after it has pointed the root's `overrides` at the new files and before it installs:
 *
 * - a package's patches that all apply to its new file are carried: each header's `Applies-to`, the file bun reads
 *   and the key in `patchedDependencies` now name the new file. Whether each is still needed is `patches prove`'s
 *   to say, which the re-pin runs next;
 * - one that does not apply stops the re-pin, by name, before anything is written here: it is re-made on the old
 *   pin for the new code, or dropped.
 *
 * @packageDocumentation
 */
import { $RepoCliId } from "@beep/identity/packages"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as R from "effect/Record"
import * as S from "effect/Schema"
import * as Str from "effect/String"
import { Repo } from "../../Repo.service.ts"
import { err, type Line, out } from "../../Report.schema.ts"
import { PatchedManifest, patchesFolder, withAppliesTo } from "./Patches.schema.ts"
import {
  applyEach,
  builtText,
  headerOf,
  inTempFolder,
  isKeptFile,
  type PatchSet,
  readPatches,
  unpack
} from "./PatchesRead.rules.ts"

const $I = $RepoCliId.create("commands/Patches/PatchesCarry.rules")

const from = S.String.pipe(S.annotateKey({ description: "The kept file the patches were made for" }))
const to = S.String.pipe(S.annotateKey({ description: "The kept file the package is redirected to now" }))

/**
 * What `patches carry` did with each package's patches: carried them, stopped on one, or had nothing to do.
 *
 * @category schemas
 */
export const PatchesCarryFinding = S.TaggedUnion({
  Nothing: {},
  Carried: {
    folder: S.String.pipe(S.annotateKey({ description: "The package's folder of patches, from the root" })),
    patches: S.Int.pipe(S.annotateKey({ description: "How many patches it holds" })),
    from,
    to
  },
  Stopped: {
    patch: S.String.pipe(S.annotateKey({ description: "The patch that does not apply, from the root" })),
    from,
    to,
    said: S.String.pipe(S.annotateKey({ description: "What git said" }))
  },
  Unread: { folder: S.String.pipe(S.annotateKey({ description: "The package's folder of patches, from the root" })) }
}).pipe($I.annoteSchema("PatchesCarryFinding", { description: "A package's patches carried to its new kept file" }))

/**
 * The decoded value of `PatchesCarryFinding`.
 *
 * @category models
 */
export type PatchesCarryFinding = typeof PatchesCarryFinding.Type

/**
 * The line each finding prints.
 *
 * @category rendering
 */
export const patchesCarrySentence: (finding: PatchesCarryFinding) => Line = PatchesCarryFinding.match({
  Nothing: () => out("patches:carry OK  every patch of a kept package names the file the package is redirected to"),
  Carried: ({ folder, patches, from: old, to: now }) =>
    out(
      `patches:carry  ${folder}: ${patches} patch${patches === 1 ? "" : "es"} carried from ${old} to ${now}. Whether each is still needed is \`bun run beep patches prove\`'s to say`
    ),
  Stopped: ({ patch, from: old, to: now, said }) =>
    err(
      `${patch}: was made for ${old} and does not apply to ${now} (${said}). On the old pin, re-make the patch for the new code or drop it (docs/patches.md), then move the pin again`
    ),
  Unread: ({ folder }) =>
    err(`${folder}: its patches cannot be read as one package's: run \`bun run beep patches check\` on the old pin`)
})

const { cases } = PatchesCarryFinding

/**
 * Carries the patches of every kept package whose file has changed, or stops on the first patch that does not
 * apply to the new file. Nothing is written unless every package's patches apply.
 *
 * @category rules
 */
export const patchesCarry = Effect.fn("PatchesCarry.patchesCarry")(function* () {
  const repo = yield* Repo
  const { sets } = yield* readPatches()
  const manifestFile = repo.join(repo.root, "package.json")
  const manifest = yield* repo.json(PatchedManifest)(manifestFile)
  const redirected = (name: string) =>
    O.map(O.filter(R.get(manifest.overrides ?? {}, name), Str.startsWith("file:")), Str.slice(5))

  const judged = yield* Effect.forEach(
    sets,
    Effect.fnUntraced(function* (set: PatchSet) {
      const folder = `${patchesFolder}/${set.name}`
      const shared = headerOf(set)
      if (O.isNone(shared))
        return { set, said: A.of<PatchesCarryFinding>(cases.Unread.make({ folder })), move: O.none() }
      const header = shared.value
      const now = redirected(header.package)
      if (!isKeptFile(header.appliesTo) || O.isNone(now) || now.value === header.appliesTo) {
        return { set, said: A.empty<PatchesCarryFinding>(), move: O.none() }
      }
      const moved = { name: header.package, from: header.appliesTo, to: now.value }
      const refused = yield* inTempFolder(
        Effect.fnUntraced(function* (dir) {
          yield* unpack(moved.to, dir)
          return yield* applyEach(set, dir)
        })
      )
      return O.match(refused, {
        onSome: ({ patch, said }) => ({
          set,
          said: A.of<PatchesCarryFinding>(
            cases.Stopped.make({ patch: patch.file, from: moved.from, to: moved.to, said })
          ),
          move: O.none<typeof moved>()
        }),
        onNone: () => ({
          set,
          said: A.of<PatchesCarryFinding>(
            cases.Carried.make({ folder, patches: set.patches.length, from: moved.from, to: moved.to })
          ),
          move: O.some(moved)
        })
      })
    }),
    { concurrency: 1 }
  )
  const said = A.flatMap(judged, (one) => one.said)
  const stopped = A.some(said, (finding) => !PatchesCarryFinding.guards.Carried(finding))
  if (stopped) return A.filter(said, (finding) => !PatchesCarryFinding.guards.Carried(finding))
  const moving = A.flatMap(judged, (one) => O.toArray(O.map(one.move, (move) => ({ set: one.set, move }))))
  if (moving.length === 0) return A.of<PatchesCarryFinding>(cases.Nothing.make({}))

  yield* Effect.forEach(
    moving,
    Effect.fnUntraced(function* ({ set, move }) {
      const carried = A.map(set.patches, (patch) => ({ ...patch, text: withAppliesTo(move.to)(patch.text) }))
      yield* Effect.forEach(carried, (patch) => repo.write(patch.absolute, patch.text), {
        concurrency: 1,
        discard: true
      })
      yield* repo.write(repo.join(repo.root, set.built), builtText({ ...set, patches: carried }))
    }),
    { concurrency: 1, discard: true }
  )
  // The key is the one string of package.json that names the old file beside the package's name.
  const text = yield* repo.text(manifestFile)
  yield* repo.write(
    manifestFile,
    A.reduce(moving, text, (now, { move }) =>
      Str.replaceAll(`"${move.name}@${move.from}"`, `"${move.name}@${move.to}"`)(now)
    )
  )
  return said
})
