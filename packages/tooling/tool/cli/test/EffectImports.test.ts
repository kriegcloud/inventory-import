import { describe, expect, it } from "@effect/vitest"
import * as A from "effect/Array"
import * as HashSet from "effect/HashSet"
import { judgeCode, repairCode } from "../src/commands/Laws/internal/effectImportsCode.ts"
import { faultSentence, leftSentence } from "../src/commands/Laws/EffectImports.schema.ts"
import { type Hit, type Installed, judgeText } from "../src/commands/Laws/internal/effectImportsJudge.ts"

// A small installed world: enough modules for every kind of sentence.
const installed: Installed = {
  dist: {
    effect: HashSet.fromIterable([
      "Array.js",
      "Effect.js",
      "Function.js",
      "Number.js",
      "Option.js",
      "Record.js",
      "http/index.js",
      "http/HttpClient.js"
    ]),
    "@effect/sql-d1": HashSet.fromIterable(["index.js", "D1Client.js"]),
    "@effect/vitest": HashSet.fromIterable(["index.js"])
  },
  functionNames: ["pipe", "dual"]
}
// The statements are put together from two halves, so the rule does not read this file's fixtures as its imports.
const from = (clause: string, source: string) => `import ${clause} from "${source}"`
const lines = (all: ReadonlyArray<string>) => A.join(all, "\n")
const said = (hit: Hit) => `${hit.inComment ? "in a comment, " : ""}${faultSentence(hit.fault)}`
const sentences = (source: string) => A.map(judgeCode(installed)("a.ts", source), said)

describe("laws effect-imports", () => {
  it("passes the house form, the functions by name and the test runner's root", () => {
    expect(
      sentences(
        lines([
          from("* as O", "effect/Option"),
          from("* as HttpClient", "effect/http/HttpClient"),
          from("{ dual, pipe }", "effect/Function"),
          from("{ describe, it }", "@effect/vitest"),
          from("type { Option }", "effect/Option")
        ])
      )
    ).toEqual([])
  })

  it("says what to write for each kind of wrong import", () => {
    expect(sentences(from("{ Option }", "effect"))).toEqual([
      `root-barrel: Option from "effect". Write: ${from("* as O", "effect/Option")}`
    ])
    expect(sentences(from("{ pipe }", "effect"))).toEqual([
      `root-barrel: pipe from "effect". Write: ${from("{ pipe }", "effect/Function")}`
    ])
    expect(sentences(from("{ HttpClient }", "effect/http"))).toEqual([
      `nested-barrel: HttpClient from "effect/http". Write: ${from("* as HttpClient", "effect/http/HttpClient")}`
    ])
    expect(sentences(from("{ D1Client }", "@effect/sql-d1"))).toEqual([
      `nested-barrel: D1Client from "@effect/sql-d1". Write: ${from("* as D1Client", "@effect/sql-d1/D1Client")}`
    ])
    expect(sentences(from("* as Arr", "effect/Array"))).toEqual([
      `alias: "effect/Array" as Arr. Write: ${from("* as A", "effect/Array")}`
    ])
    expect(sentences(from("* as N", "effect/Number"))).toEqual([
      `alias: "effect/Number" as N. Write: ${from("* as Num", "effect/Number")}`
    ])
    expect(sentences(from("{ some }", "effect/Option"))).toEqual([
      `named-import: some from "effect/Option". Write: ${from("* as O", "effect/Option")} and O.some`
    ])
    expect(sentences(from("* as Strings", "effect/Strings"))).toEqual([
      'unknown-path: "effect/Strings" is not a path of the installed effect'
    ])
  })

  it("lets a module take another name only when its own is taken in the file", () => {
    expect(sentences(`import { A } from "./mine.ts"\n${from("* as EffectArray", "effect/Array")}`)).toEqual([])
  })

  it("reads the examples in a comment and in a document", () => {
    expect(sentences(`/**\n * ${from("{ Record as Rec }", "effect")}\n */\nexport const x = 1\n`)).toEqual([
      `in a comment, root-barrel: Record from "effect". Write: ${from("* as R", "effect/Record")}`
    ])
    expect(A.map(judgeText(installed)(`Write \`${from("{ Effect }", "effect")}\`.`), said)).toEqual([
      `root-barrel: Effect from "effect". Write: ${from("* as Effect", "effect/Effect")}`
    ])
  })

  it("repairs a file: barrels split, names changed, and the identifiers that follow renamed", () => {
    const before = lines([
      from("{ Array as Arr, Effect, Option, pipe }", "effect"),
      from("{ HttpClient }", "effect/http"),
      "",
      "/** Uses `Arr.map` and `Option.some`. */",
      "export const run = (xs: ReadonlyArray<number>): Option.Option<number> =>",
      "  pipe(Arr.head(xs), Option.map((x) => x + 1))",
      "export const keep = { option: Option, value: HttpClient, effect: Effect }",
      ""
    ])
    const repaired = repairCode(installed)("a.ts", before)
    expect(repaired.left).toEqual([])
    expect(repaired.text).toBe(
      lines([
        from("* as A", "effect/Array"),
        from("* as Effect", "effect/Effect"),
        from("* as O", "effect/Option"),
        from("{ pipe }", "effect/Function"),
        from("* as HttpClient", "effect/http/HttpClient"),
        "",
        "/** Uses `A.map` and `O.some`. */",
        "export const run = (xs: ReadonlyArray<number>): O.Option<number> =>",
        "  pipe(A.head(xs), O.map((x) => x + 1))",
        "export const keep = { option: O, value: HttpClient, effect: Effect }",
        ""
      ])
    )
    expect(sentences(repaired.text)).toEqual([])
  })

  it("leaves a renamed name used as a shorthand property for a person, as the script did", () => {
    const repaired = repairCode(installed)("a.ts", `${from("{ Option }", "effect")}\nexport const keep = { Option }\n`)
    expect(A.map(repaired.left, leftSentence)).toEqual(["overlapping edits: repair this file by hand"])
  })

  it("leaves a name that is declared again inside the file, and says so", () => {
    const repaired = repairCode(installed)(
      "a.ts",
      `${from("{ Option }", "effect")}\nexport const f = (Option: number) => Option + 1\n`
    )
    expect(A.map(repaired.left, leftSentence)).toEqual([
      "Option is declared again inside the file: rename its uses to O by hand"
    ])
  })
})
