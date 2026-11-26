// Vite reads fixtures before the tests run. Inline data URLs preserve non-UTF-8 CSVs and workbook bytes;
// each read decodes a fresh array, as a file read does, so a test cannot mutate another test's input.
import { assertDefined, assertTrue } from "@effect/vitest/utils"
import * as A from "effect/Array"
import * as Base64 from "effect/encoding/Base64"
import * as R from "effect/Record"
import * as Result from "effect/Result"
import * as Str from "effect/String"

const fixtures = R.fromEntries(
  A.map(
    R.toEntries(import.meta.glob<string>("../fixtures/**/*", { query: "?url&inline", import: "default", eager: true })),
    ([path, dataUrl]) => [new URL(path, import.meta.url).href, dataUrl]
  )
)

/** A fixture's original bytes, without opening a file in the test runner. */
export const readBytes = (url: URL): Uint8Array<ArrayBuffer> => {
  const dataUrl = fixtures[url.href]
  assertDefined(dataUrl)
  const [, base64] = Str.split(",")(dataUrl)
  assertDefined(base64)
  // Effect's decoder, not `Uint8Array.fromBase64`: CI runs Node 22, which has no such function.
  const decoded = Base64.decode(base64)
  assertTrue(Result.isSuccess(decoded), `the fixture ${url.href} is not base64`)
  return new Uint8Array(decoded.success)
}

const snapshots = R.fromEntries(
  A.map(
    R.toEntries(
      import.meta.glob<string>("../fixtures/*-expected/*.json", { query: "?raw", import: "default", eager: true })
    ),
    ([path, text]) => [new URL(path, import.meta.url).href, text]
  )
)

/** Historical parity snapshots use Vite's existing text loader. */
export const readText = (url: URL): string => {
  const text = snapshots[url.href]
  assertDefined(text)
  return text
}
