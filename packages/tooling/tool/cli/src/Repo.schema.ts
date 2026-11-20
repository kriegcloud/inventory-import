/**
 * The files of the repository the rules read, as schemas: a workspace's `package.json` and the ceiling file of a
 * package with screens.
 *
 * @packageDocumentation
 */
import { $RepoCliId } from "@beep/identity/packages"
import * as S from "effect/Schema"

const $I = $RepoCliId.create("Repo.schema")

const names = S.Record(S.String, S.Unknown)

/**
 * The `beep` block of a workspace's `package.json`: what kind of package it is, for the boundaries rule.
 *
 * @category schemas
 */
export class BeepBlock extends S.Class<BeepBlock, { readonly brand: unique symbol }>($I`BeepBlock`)(
  {
    family: S.optionalKey(S.String).pipe(S.annotateKey({ description: "foundation, drivers, kernel, context, ..." })),
    context: S.optionalKey(S.String).pipe(S.annotateKey({ description: "The bounded context of a context package" })),
    layer: S.optionalKey(S.String).pipe(S.annotateKey({ description: "contract, model, host or web" }))
  },
  $I.annote("BeepBlock", { description: "A workspace's family, and for a context package its context and layer" })
) {}

/**
 * The parts of a `package.json` the rules read. Everything else in the file is ignored.
 *
 * @category schemas
 */
export class Manifest extends S.Class<Manifest, { readonly brand: unique symbol }>($I`Manifest`)(
  {
    name: S.optionalKey(S.String).pipe(S.annotateKey({ description: "The package's name" })),
    workspaces: S.String.pipe(
      S.Array,
      S.optionalKey,
      S.annotateKey({ description: "The workspace globs: only the repository's root has them" })
    ),
    exports: S.optionalKey(names).pipe(S.annotateKey({ description: "The export map, entry to target" })),
    dependencies: S.optionalKey(names).pipe(S.annotateKey({ description: "Run-time dependencies" })),
    devDependencies: S.optionalKey(names).pipe(S.annotateKey({ description: "Development dependencies" })),
    peerDependencies: S.optionalKey(names).pipe(S.annotateKey({ description: "Peer dependencies" })),
    beep: S.optionalKey(BeepBlock).pipe(S.annotateKey({ description: "What kind of package this is" }))
  },
  $I.annote("Manifest", { description: "The parts of a package.json the repository's rules read" })
) {}

/**
 * The root's `tags-ledger.json`: the files that still tell a `_tag` apart or build one by hand, each with how many
 * places it has. The count of each only falls: a file not in it may have none, and a file whose count fell is lowered.
 *
 * @category schemas
 */
export class TagsLedger extends S.Class<TagsLedger, { readonly brand: unique symbol }>($I`TagsLedger`)(
  {
    description: S.optionalKey(S.String).pipe(S.annotateKey({ description: "What the file is, for a person" })),
    files: S.Record(S.String, S.Int).pipe(
      S.annotateKey({ description: "Each file, from the root, with the places it still has: never more" })
    )
  },
  $I.annote("TagsLedger", { description: "The files that still tell a _tag apart or build one by hand, and how often" })
) {}

/**
 * A package's `strict-ceiling.json`: the recorded count of the four style findings its own code still has.
 *
 * @category schemas
 */
export class StrictCeiling extends S.Class<StrictCeiling, { readonly brand: unique symbol }>($I`StrictCeiling`)(
  {
    project: S.String.pipe(S.annotateKey({ description: "The tsconfig the count is taken from" })),
    own: S.Array(S.String).pipe(S.annotateKey({ description: "The folders that are the package's own code" })),
    vendored: S.Array(S.String).pipe(S.annotateKey({ description: "Folders inside them that are vendored" })),
    rules: S.Array(S.String).pipe(S.annotateKey({ description: "The rules that are counted" })),
    ceiling: S.Int.pipe(S.annotateKey({ description: "The recorded count: it only ever falls" }))
  },
  $I.annote("StrictCeiling", { description: "The recorded count of style findings in a package's own code" })
) {}
