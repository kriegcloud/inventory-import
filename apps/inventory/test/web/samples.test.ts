// The sample files are in two places: `public/samples`, which the app serves and the Upload step offers, and the
// catalog screens' test fixtures, which their tests read (a package may not reach into the app). They must be the
// same files, byte for byte, or those tests prove something about a file nobody is offered.
// @effect-diagnostics nodeBuiltinImport:off
import { readdirSync, readFileSync } from "node:fs"
import * as A from "effect/Array"
import * as Order from "effect/Order"
import { describe, expect, it } from "vitest"

const served = new URL("../../public/samples/", import.meta.url)
const copies = new URL("../../../../packages/catalog/web/test/fixtures/samples/", import.meta.url)

describe("the sample files", () => {
  it("are the same in the app and in the catalog screens' fixtures", () => {
    const names = A.sort(readdirSync(served), Order.String)
    expect(A.sort(readdirSync(copies), Order.String)).toEqual(names)
    for (const name of names) {
      expect(readFileSync(new URL(name, copies)).equals(readFileSync(new URL(name, served)))).toBe(true)
    }
  })
})
