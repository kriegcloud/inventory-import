/**
 * `patches build`: writes the file bun reads for each patched package from the package's patches, one after
 * another in the order of their names. That file is never edited by hand: `patches check` fails when it differs.
 *
 * @packageDocumentation
 */
import { $RepoCliId } from "@beep/identity/packages"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as S from "effect/Schema"
import { Repo } from "../../Repo.service.ts"
import { type Line, out } from "../../Report.schema.ts"
import { builtText, readPatches } from "./PatchesRead.rules.ts"

const $I = $RepoCliId.create("commands/Patches/PatchesBuild.rules")

/**
 * What `patches build` did: each file it wrote, or that every file already was what its patches say.
 *
 * @category schemas
 */
export const PatchesBuildFinding = S.TaggedUnion({
  Built: {
    built: S.String.pipe(S.annotateKey({ description: "The file bun reads, from the root" })),
    patches: S.Int.pipe(S.annotateKey({ description: "How many patches it now holds" }))
  },
  Unchanged: { files: S.Int.pipe(S.annotateKey({ description: "How many files were compared" })) }
}).pipe($I.annoteSchema("PatchesBuildFinding", { description: "A file bun reads, written from its patches" }))

/**
 * The decoded value of `PatchesBuildFinding`.
 *
 * @category models
 */
export type PatchesBuildFinding = typeof PatchesBuildFinding.Type

/**
 * The line each finding prints.
 *
 * @category rendering
 */
export const patchesBuildSentence: (finding: PatchesBuildFinding) => Line = PatchesBuildFinding.match({
  Built: ({ built, patches }) =>
    out(`patches:build  wrote ${built} from ${patches} patch${patches === 1 ? "" : "es"}: run \`bun install\``),
  Unchanged: ({ files }) =>
    out(`patches:build OK  ${files} file${files === 1 ? " is" : "s are"} already what the patches say`)
})

/**
 * Writes each package's file from its patches, and says which it wrote.
 *
 * @category rules
 */
export const patchesBuild = Effect.fn("PatchesBuild.patchesBuild")(function* () {
  const repo = yield* Repo
  const { sets } = yield* readPatches()
  const written = yield* Effect.forEach(
    sets,
    Effect.fnUntraced(function* (set) {
      const file = repo.join(repo.root, set.built)
      const expected = builtText(set)
      const now = (yield* repo.exists(file)) ? yield* repo.text(file) : ""
      if (now === expected) return A.empty<PatchesBuildFinding>()
      yield* repo.write(file, expected)
      return A.of<PatchesBuildFinding>(
        PatchesBuildFinding.cases.Built.make({ built: set.built, patches: set.patches.length })
      )
    }),
    { concurrency: 1 }
  )
  const built = A.flatten(written)
  return built.length > 0
    ? built
    : A.of<PatchesBuildFinding>(PatchesBuildFinding.cases.Unchanged.make({ files: sets.length }))
})
