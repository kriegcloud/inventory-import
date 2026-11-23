// The sample files are in two places: `public/samples`, which the app serves and the Upload step offers, and the
// catalog screens' test fixtures, which their tests read (a package may not reach into the app). They must be the
// same files, name for name and character for character, or those tests prove something about a file nobody is
// offered. Both folders are read by the build's own import of text (`?raw`), so no test reads the disk itself.
import * as A from "effect/Array"
import * as R from "effect/Record"
import * as Str from "effect/String"
import { describe, expect, it } from "vitest"

const served = import.meta.glob<string>("../../public/samples/*", { query: "?raw", import: "default", eager: true })
const copies = import.meta.glob<string>("../../../../packages/catalog/web/test/fixtures/samples/*", {
  query: "?raw",
  import: "default",
  eager: true
})

/** The files of a folder by their names, without the path they were found by. */
const byName = (files: Readonly<Record<string, string>>): Readonly<Record<string, string>> =>
  R.fromEntries(A.map(R.toEntries(files), ([path, text]) => [Str.replace(/^.*\//, "")(path), text] as const))

describe("the sample files", () => {
  it("are the same in the app and in the catalog screens' fixtures", () => {
    expect(R.keys(byName(served)).length).toBeGreaterThan(0)
    expect(byName(copies)).toEqual(byName(served))
  })
})
