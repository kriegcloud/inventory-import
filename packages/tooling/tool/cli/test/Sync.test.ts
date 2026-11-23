import { describe, expect, it } from "@effect/vitest"
import * as A from "effect/Array"
import * as Arbitrary from "effect/Arbitrary"
import * as O from "effect/Option"
import * as R from "effect/Record"
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
import { Drift, modeOf, Plan, repaired } from "../src/Sync.schema.ts"

/** Where a path from the repository's root ends up: its segments, `..` and `.` resolved; none when it leaves the root. */
const resolved = (file: string): O.Option<ReadonlyArray<string>> =>
  Str.startsWith("/")(file)
    ? O.none()
    : A.reduce(Str.split("/")(file), O.some<ReadonlyArray<string>>([]), (at, part) =>
        O.flatMap(at, (parts) =>
          part === ".."
            ? O.map(A.init(parts), (rest) => rest)
            : part === "."
              ? O.some(parts)
              : O.some(A.append(parts, part))
        )
      )

// A text of distinct characters (the private-use block), so a character written twice or lost can be counted.
const marked = (length: number) =>
  A.join(
    A.makeBy(length, (i) => String.fromCharCode(0xe000 + i)),
    ""
  )
const counted = (text: string) =>
  A.reduce(Str.split("")(text), R.empty<string, number>(), (counts, char) =>
    R.set(counts, char, O.getOrElse(R.get(counts, char), () => 0) + 1)
  )

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

describe("a plan's repairs, generated from the schema", () => {
  // Every plan the schema allows writes each file inside the repository, and keeps every character of it that no
  // repair replaces exactly once, in place: no repair writes a part of the file twice or loses one.
  it.prop(
    "keep every character outside the stretches they replace once, in files inside the repository",
    [Arbitrary.schema(Plan)],
    ([plan]) => {
      for (const drift of plan.drifts) {
        expect([drift.file, O.isSome(resolved(drift.file))]).toEqual([drift.file, true])
      }
      for (const [, own] of R.toEntries(A.groupBy(plan.drifts, (drift) => drift.file))) {
        const length = A.reduce(own, 0, (most, drift) => Math.max(most, drift.start, drift.end)) + 2
        // A longer file says nothing more, and the private-use block holds 6,400 characters.
        if (length > 6000) continue
        const text = marked(length)
        const counts = counted(repaired(own)(text))
        const kept = A.makeBy(length, (i) => O.getOrElse(R.get(counts, String.fromCharCode(0xe000 + i)), () => 0))
        const expected = A.makeBy(length, (i) => (A.some(own, (drift) => drift.start <= i && i < drift.end) ? 0 : 1))
        expect(kept).toEqual(expected)
      }
    }
  )
})
