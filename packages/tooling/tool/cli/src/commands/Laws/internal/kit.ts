// The files of beep-effect's kit that `bun run vendor:check` holds byte for byte to beep-effect: each `files` entry of
// a `vendor.json` under `packages/foundation/`. A file of `local`, written here and hashed by nothing, is not one of
// them, and a law reads it like any other. This reads only the names a manifest lists; that each file is the one its
// hash says is `vendor:check`'s to hold, and it fails on any file that differs, so a manifest cannot leave out a file
// it does not hold byte for byte.
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as S from "effect/Schema"
import * as Str from "effect/String"
import { Repo } from "../../../Repo.service.ts"

/** The part of a `vendor.json` this reads: each hashed file's path, from the package's folder. */
const Manifest = S.fromJsonString(S.Struct({ files: S.Array(S.Struct({ path: S.String, sha256: S.String })) }))

/**
 * The paths, from the root, of every file a kit manifest holds by its hash.
 *
 * @category rules
 */
export const hashedKitFiles = Effect.fn("kit.hashedKitFiles")(function* () {
  const repo = yield* Repo
  const listed = yield* repo.run("git", ["ls-files", "-z", "--", "packages/foundation"])
  const manifests = A.filter(Str.split("\0")(listed.stdout), Str.endsWith("/vendor.json"))
  const each = yield* Effect.forEach(
    manifests,
    (manifest) =>
      Effect.map(repo.text(repo.join(repo.root, manifest)), (text) => {
        const folder = Str.slice(0, manifest.length - "vendor.json".length)(manifest)
        return O.match(S.decodeOption(Manifest)(text), {
          onNone: () => A.empty<string>(),
          onSome: (read) => A.map(read.files, (file) => `${folder}${file.path}`)
        })
      }),
    { concurrency: 1 }
  )
  return A.flatten(each)
})
