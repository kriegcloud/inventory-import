import { describe, expect, it } from "@effect/vitest"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import { vendorCheck, vendorCheckSentence } from "../src/commands/Vendor/VendorCheck.rules.ts"
import { render } from "../src/Report.schema.ts"
import { inTree, json, printed } from "./support/tree.ts"

const commit = "c5cebd5c9de7077493cb9ccaaa18e1d4f73da0b0"
const first = "// Vendored from beep-effect c5cebd5c9de7:packages/kit/src/A.ts as it is there.\n"
const body = "export const a = 1\n"
// sha256 of `body`.
const hash = "a3b135bcfeaabda5d6780642cf256059889ad4649c9ba4f7a4d5d6e83a68b402"
const exportsMap = { ".": "./src/A.ts" }

const record = (file: Record<string, unknown>) =>
  json({
    source: { repository: "beep-effect", commit, path: "packages/kit", license: "MIT" },
    exports: exportsMap,
    files: [{ path: "src/A.ts", sourceSha256: hash, sha256: hash, rewrites: [], ...file }],
    local: ["src/local.ts"]
  })

const tree = (files: Record<string, string>) => ({
  "packages/kit/package.json": json({ name: "@x/kit", exports: exportsMap }),
  "packages/kit/vendor.json": record({}),
  "packages/kit/src/A.ts": first + body,
  "packages/kit/src/local.ts": "",
  ...files
})

describe("vendor check", () => {
  it.effect("names a changed file by its new hash, a stray file, and exports that moved", () =>
    Effect.gen(function* () {
      const report = yield* inTree(
        tree({
          "packages/kit/src/A.ts": `${first}export const a = 2\n`,
          "packages/kit/src/stray.ts": "",
          "packages/kit/package.json": json({ name: "@x/kit", exports: { ".": "./src/B.ts" } })
        }),
        Effect.map(vendorCheck(O.none()), render(vendorCheckSentence))
      )
      expect(report.failed).toBe(true)
      const lines = printed(report)
      expect(lines[0]).toMatch(
        /^err: packages\/kit\/src\/A\.ts: changed since it was vendored \(sha256 [0-9a-f]{64}\)$/
      )
      expect(lines.slice(1)).toEqual([
        "err: packages/kit/src/stray.ts: not vendored and not a local file",
        "err: packages/kit/package.json: exports differ from those recorded in vendor.json",
        "err: vendor:check failed: 3 problems"
      ])
    })
  )

  it.effect("names a missing file, and one whose first line is not its provenance line", () =>
    Effect.gen(function* () {
      const lost = yield* inTree(
        tree({ "packages/kit/vendor.json": record({ path: "src/Gone.ts" }) }),
        Effect.map(vendorCheck(O.none()), render(vendorCheckSentence))
      )
      expect(printed(lost)[0]).toBe("err: packages/kit/src/Gone.ts: listed in vendor.json but missing")
      const bare = yield* inTree(
        tree({ "packages/kit/src/A.ts": body }),
        Effect.map(vendorCheck(O.none()), render(vendorCheckSentence))
      )
      expect(printed(bare)[0]).toBe(
        "err: packages/kit/src/A.ts: the first line is not its provenance line (// Vendored from beep-effect c5cebd5c9de7:packages/kit/src/A.ts …)"
      )
    })
  )

  it.effect("holds a listed patch to a reason, a difference and a first line that says so", () =>
    Effect.gen(function* () {
      const report = yield* inTree(
        tree({ "packages/kit/vendor.json": record({ patches: [{ reason: "" }] }) }),
        Effect.map(vendorCheck(O.none()), render(vendorCheckSentence))
      )
      expect(printed(report)).toEqual([
        "err: packages/kit/src/A.ts: lists a patch, yet equals upstream",
        "err: packages/kit/src/A.ts: a patch has no reason",
        "err: packages/kit/src/A.ts: patched, but its first line does not say so",
        "err: vendor:check failed: 3 problems"
      ])
    })
  )
})
