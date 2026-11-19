/**
 * A vendored package's `vendor.json`: where its files came from and what each must still hash to.
 *
 * @packageDocumentation
 */
import { $RepoCliId } from "@beep/identity/packages"
import * as S from "effect/Schema"

const $I = $RepoCliId.create("commands/Vendor/Vendor.schema")

/**
 * A deliberate change to a vendored source file. `reason` is read as written, so a record without one can be named.
 *
 * @category schemas
 */
export class VendorPatch extends S.Class<VendorPatch, { readonly brand: unique symbol }>($I`VendorPatch`)(
  { reason: S.optionalKey(S.Unknown).pipe(S.annotateKey({ description: "Why the file differs from upstream" })) },
  $I.annote("VendorPatch", { description: "A deliberate change to a vendored source file, with its reason" })
) {}

/**
 * One vendored file.
 *
 * @category schemas
 */
export class VendorFile extends S.Class<VendorFile, { readonly brand: unique symbol }>($I`VendorFile`)(
  {
    path: S.String.pipe(S.annotateKey({ description: "The file's path inside the package" })),
    sourceSha256: S.String.pipe(S.annotateKey({ description: "The SHA-256 of the upstream file" })),
    sha256: S.String.pipe(S.annotateKey({ description: "The SHA-256 of the file here, without its first line" })),
    rewrites: S.Array(S.Unknown).pipe(S.annotateKey({ description: "The import rewrites applied to a test file" })),
    patches: VendorPatch.pipe(
      S.Array,
      S.optionalKey,
      S.annotateKey({ description: "The deliberate patches applied to a source file" })
    )
  },
  $I.annote("VendorFile", { description: "One vendored file and the hashes it is held to" })
) {}

/**
 * Where a vendored package was copied from.
 *
 * @category schemas
 */
export class VendorSource extends S.Class<VendorSource, { readonly brand: unique symbol }>($I`VendorSource`)(
  {
    repository: S.String.pipe(S.annotateKey({ description: "The repository's name" })),
    commit: S.String.pipe(S.annotateKey({ description: "The commit the files were copied at" })),
    path: S.String.pipe(S.annotateKey({ description: "The package's folder in that repository" })),
    license: S.String.pipe(S.annotateKey({ description: "The licence the files are under" }))
  },
  $I.annote("VendorSource", { description: "The repository, commit and folder a package was vendored from" })
) {}

/**
 * A whole `vendor.json`.
 *
 * @category schemas
 */
export class VendorRecord extends S.Class<VendorRecord, { readonly brand: unique symbol }>($I`VendorRecord`)(
  {
    source: VendorSource.pipe(S.annotateKey({ description: "Where the files came from" })),
    exports: S.Unknown.pipe(S.annotateKey({ description: "The export map the package must still have" })),
    files: S.Array(VendorFile).pipe(S.annotateKey({ description: "Every vendored file" })),
    local: S.Array(S.String).pipe(S.annotateKey({ description: "Files written here, not copied" }))
  },
  $I.annote("VendorRecord", { description: "A vendored package's record: its source and each file's hashes" })
) {}

/**
 * The export map of a `package.json`, kept as it is written so its key order can be compared.
 *
 * @category schemas
 */
export const ExportsOnly = S.Struct({
  exports: S.optionalKey(S.Unknown).pipe(S.annotateKey({ description: "The export map as written" }))
}).pipe($I.annoteSchema("ExportsOnly", { description: "A package.json read for its export map alone" }))
