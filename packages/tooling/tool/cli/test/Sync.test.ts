import { describe, expect, it } from "@effect/vitest"
import * as A from "effect/Array"
import * as O from "effect/Option"
import * as Str from "effect/String"
import {
  anchorless,
  arrayOf,
  blankComments,
  fits,
  isLocalPath,
  lineAt,
  objectOf,
  renderArray,
  stringsIn,
  stringValues
} from "../src/Sync.rules.ts"
import { Drift, modeOf, repaired } from "../src/Sync.schema.ts"

const config = A.join(
  [
    "{",
    '  // "extends": "./commented.json",',
    '  "extends": "./base.json", /* "extends": "./also-commented.json" */',
    '  "list": ["a", "b // not a comment", ["nested"]],',
    '  "scripts": { "check": "tsrs -p \\"x\\"" }',
    "}"
  ],
  "\n"
)

describe("the text a sync command reads and repairs", () => {
  it("blanks comments without moving a character, and leaves a string that looks like one", () => {
    const blanked = blankComments(config)
    expect(blanked.length).toBe(config.length)
    expect(blanked).not.toContain("commented")
    expect(blanked).toContain('"b // not a comment"')
    expect(blankComments('{ "a": 1 } /* never closed')).toBe('{ "a": 1 }                ')
  })

  it("finds a key's string, array and object where the file writes them, not where a comment does", () => {
    const found = stringValues("extends")(config)
    expect(A.map(found, (one) => one.value)).toEqual(["./base.json"])
    expect(A.map(found, (one) => Str.slice(one.start, one.end)(config))).toEqual(["./base.json"])
    const list = O.getOrThrow(arrayOf("list")(config))
    expect(Str.slice(list.start, list.end)(config)).toBe('["a", "b // not a comment", ["nested"]]')
    expect(A.map(stringsIn(list)(config), (one) => one.value)).toEqual(["a", "b // not a comment", "nested"])
    const scripts = O.getOrThrow(objectOf("scripts")(config))
    expect(Str.slice(scripts.start, scripts.end)(config)).toBe('{ "check": "tsrs -p \\"x\\"" }')
    expect(O.isNone(arrayOf("absent")(config))).toBe(true)
    expect(O.isNone(arrayOf("open")('{ "open": ["never closed" }'))).toBe(true)
    expect(lineAt(config)(list.start)).toBe(4)
  })

  it("writes an array on one line while the line stays within the print width, else one item a line", () => {
    const items = ['"package.json"', '"apps/*/package.json"']
    expect(renderArray({ indent: "  ", before: 12, after: 1 })(items)).toBe('["package.json", "apps/*/package.json"]')
    expect(renderArray({ indent: "  ", before: 84, after: 1 })(items)).toBe(
      '[\n    "package.json",\n    "apps/*/package.json"\n  ]'
    )
    expect(renderArray({ indent: "", before: 0, after: 0 })([])).toBe("[]")
  })

  it("fits a path to a workspace pattern and a name to a held pattern", () => {
    expect(fits("packages/*")("packages/kernel")).toBe(true)
    expect(fits("packages/*")("packages/catalog/model")).toBe(false)
    expect(fits("packages/foundation/*/*")("packages/foundation/modeling/csv")).toBe(true)
    expect(fits("@alchemy.run/**")("@alchemy.run/cloudflare")).toBe(true)
    expect(fits("@alchemy.run/**")("alchemy")).toBe(false)
    expect(fits("oxlint")("oxlint-tsgolint")).toBe(false)
  })

  it("tells a path on this disk from an address and a package's name", () => {
    expect(A.map(["./a.json", "../../b.json", "node_modules/x/s.json"], isLocalPath)).toEqual([true, true, true])
    expect(A.map(["https://x.test/s.json", "@tsconfig/node22", "file:./x"], isLocalPath)).toEqual([false, false, false])
    expect(anchorless("../../node_modules/x/s.json")).toBe("node_modules/x/s.json")
    expect(anchorless("./tsconfig.base.json")).toBe("tsconfig.base.json")
  })

  it("repairs several places of one file from its end, and the same place once", () => {
    const place = (start: number, end: number, text: string) =>
      Drift.make({ file: "a", line: 1, what: "x", found: "", expected: text, start, end, text })
    expect(repaired([place(0, 1, "AAA"), place(2, 3, "C"), place(2, 3, "C")])("abc")).toBe("AAAbC")
    expect(repaired([])("abc")).toBe("abc")
  })

  it("a dry run wins over a write, and neither is a check", () => {
    expect(modeOf({ write: true, dryRun: true })).toBe("dry-run")
    expect(modeOf({ write: true, dryRun: false })).toBe("write")
    expect(modeOf({ write: false, dryRun: false })).toBe("check")
  })
})
