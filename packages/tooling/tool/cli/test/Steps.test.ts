// What the tests below show of the budget (budget.ts), for both laws. Every shape here, at its sizes and at ten times
// them (ten times the length for a shape of the tags law whose length grows with the square of its size; such a shape
// of the refs law only to 60), ends within the steps its length allows, judged or refused in words at a line. The
// shapes an ordinary file is made of are judged at 4, 10 and 30; names given the one before at a hundred and a
// thousand, and refused at ten thousand (half a million characters). Eight long shapes (a call chain, a member chain,
// two concatenations, an else-if chain, nested JSX and a ternary chain, at 300, and a choice among 250) get the
// verdicts both laws gave before they had a budget (the tags law's call chain, which it took minutes on, as its chain
// of ten). The scan refuses, before parsing, fifteen shapes the parser dies on, each from the size written beside it
// and not one smaller, at most half the size the parser dies at; a closing bracket in a string, a block comment, a
// template's text or a regular expression, in the forms tried here, hides no nesting after it (text inside an element
// can: PLAN.md names what the scan misreads); a file longer than `maxFileSize` is refused, and
// so is one the parser reads with errors. Reads nested past `maxNesting`, on shapes that overflow node's stack without
// it, are refused and never thrown, and judgements that follow names past `maxDepth`. No file is given more than
// `maxSteps`, and five of the heaviest shapes at about a million characters end within it. Steps are counted, not
// timed: the only clocks here are the tests' time limits.
import { describe, expect, it } from "@effect/vitest"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as R from "effect/Record"
import * as Str from "effect/String"
import {
  budgetOf,
  maxBrackets,
  maxChain,
  maxDepth,
  maxFileSize,
  maxNesting,
  maxSteps,
  refsStepsPerCharacter,
  tagsStepsPerCharacter,
  Unread,
  unreadable,
  unreadSentence
} from "../src/commands/Laws/internal/budget.ts"
import { linesOf } from "../src/commands/Laws/internal/lines.ts"
import { readScreen } from "../src/commands/Laws/internal/refCallbacksCode.ts"
import { readTags } from "../src/commands/Laws/internal/tagsCode.ts"
import { refCallbacks, refCallbacksSentence } from "../src/commands/Laws/RefCallbacks.rules.ts"
import { tags, tagsSentence } from "../src/commands/Laws/Tags.rules.ts"
import { Repo } from "../src/Repo.service.ts"
import { render } from "../src/Report.schema.ts"
import { inTree, printed } from "./support/tree.ts"

/** One shape of source, as long as `n` says. */
type Shape = (n: number) => string

/** `n` pieces, one after the other. */
const pieces = (n: number, piece: (index: number) => string, between = ""): string =>
  A.join(A.makeBy(n, piece), between)

/** `seed` wrapped `n` times, the last wrap outermost. */
const nested = (n: number, wrap: (inner: string, index: number) => string, seed: string): string =>
  A.reduce(
    A.makeBy(n, (index) => index),
    seed,
    wrap
  )

const names = (n: number, initial: string): string => pieces(n, (index) => `let n${index} = ${initial}\n`)
/** Every name assigned every other one, in one function. */
const assignedToEach = (n: number, key = ""): string =>
  pieces(n, (to) => pieces(n, (from) => (to === from ? "" : `n${to} = n${from}${key}; `)))

// Shapes a walk of every way to a node took a time on that grew without bound with their size.
const tagShapes: Readonly<Record<string, Shape>> = {
  "members chained": (n) => `const v = a${pieces(n, (index) => `.m${index}`)}; f(v)`,
  "members chained by key": (n) => `const v = a${pieces(n, (index) => `["m${index}"]`)}; f(v)`,
  "calls chained": (n) => `const v = a${pieces(n, (index) => `.m${index}()`)}; f(v)`,
  "calls chained, each handed a function": (n) => `const v = a${pieces(n, (index) => `.m${index}((e) => e.k)`)}`,
  "a call called again": (n) => `const v = f${pieces(n, () => "(x)")}`,
  "an expectation's matchers": (n) => `expect(a)${pieces(n, (index) => `.not.m${index}(b)`)}`,
  "calls nested": (n) => nested(n, (inner) => `f(${inner})`, "x"),
  "calls nested beside a function": (n) => nested(n, (inner) => `A.map(${inner}, (e) => e.k)`, "x"),
  "lists nested in calls": (n) => nested(n, (inner) => `f([${inner}])`, "x"),
  "choices nested": (n) => `const v = ${pieces(n, (index) => `a${index} ? b : `)}c; f(v)`,
  "choices nested in their first branch": (n) => `const v = ${nested(n, (inner) => `((${inner}) ? b : c)`, "x")}; f(v)`,
  "?? nested": (n) => `const v = ${nested(n, (inner) => `(${inner} ?? y)`, "x")}; f(v)`,
  "?? nested on the right": (n) => `const v = ${nested(n, (inner) => `(y ?? ${inner})`, "x")}; f(v)`,
  "choices, ?? and members nested": (n) => `const v = ${nested(n, (inner) => `(a ? (${inner} ?? b).k : [c][0])`, "x")}`,
  "templates nested": (n) => `const v = ${nested(n, (inner) => `\`w \${${inner}}\``, "x")}; f(v)`,
  "a sum": (n) => `const v = ${pieces(n, (index) => `"s${index}"`, " + ")}; f(v)`,
  "names assigned to each other in every function": (n) =>
    `${names(n, "{}")}${pieces(n, (fn) => `function g${fn}() { ${pieces(n, (to) => `n${to} = n${(to + fn + 1) % n}; `)} }\n`)}`,
  "names each chosen from the two before": (n) =>
    `const n0 = x, n1 = y\n${pieces(n, (index) => `const n${index + 2} = c ? n${index} : n${index + 1}\n`)}f(n${n})`,
  "records each made of the two before": (n) =>
    `const n0 = { k: x }, n1 = { k: n0 }\n${pieces(n, (index) => `const n${index + 2} = { a: n${index}, b: n${index + 1} }\n`)}f(n${n})`,
  "lists each made of the two before": (n) =>
    `const n0 = [x], n1 = [n0]\n${pieces(n, (index) => `const n${index + 2} = [...n${index}, ...n${index + 1}, n${index}]\n`)}f(n${n})`,
  "spreads nested": (n) => `const v = ${nested(n, (inner) => `[...${inner}, x]`, "[y]")}; f(v)`,
  "joins nested": (n) => `const v = ${nested(n, (inner) => `A.join([${inner}, "b"], "")`, "x")}; f(v)`,
  "joins by method nested": (n) => `const v = ${nested(n, (inner) => `[${inner}].join("")`, "x")}; f(v)`,
  "functions that call the next": (n) =>
    pieces(n, (index) => `function g${index}(x) { return ${index === n - 1 ? "x._tag" : `g${index + 1}(x)`} }\n`),
  "functions that all call each other": (n) =>
    pieces(
      n,
      (index) => `function g${index}(x) { ${pieces(n, (other) => `if (g${other}(x)) return g${other}(x); `)} }\n`
    ),
  "functions nested that all call each other": (n) =>
    nested(
      n,
      (inner, index) =>
        `function g${index}(x) { ${inner}\n${pieces(n, (other) => `if (g${other}(x)) return g${other}(x); `)} return x._tag }`,
      "q()"
    )
}

// A function is read once for each function around it, and a record's places are copied where it is spread.
const deepTagShapes: Readonly<Record<string, Shape>> = {
  "functions nested in calls": (n) => nested(n, (inner) => `f((x) => { const y = ${inner}; return y })`, "x"),
  "functions nested under names": (n) =>
    nested(n, (inner, index) => `const g${index} = function (x) { ${inner}; return x.k };`, "q()"),
  "functions nested among ones that call the next": (n) =>
    nested(
      n,
      (inner, index) =>
        `function g${index}(x) { function h${index}(x) { return i${index}(x) } function i${index}(x) { return ${index === 0 ? "x._tag" : `g${index - 1}(x)`} } ${inner}\nreturn h${index}(x) }`,
      "q()"
    ),
  "records spread into the next": (n) =>
    `const v = ${nested(n, (inner, index) => `{ ...${inner}, k${index}: x }`, "{ k: y }")}; f(v)`,
  "records each spread from the two before": (n) =>
    `const n0 = { k: x }, n1 = { j: n0 }\n${pieces(n, (index) => `const n${index + 2} = { ...n${index}, ...n${index + 1}, k${index}: 1 }\n`)}f(n${n})`
}

const screen = (code: string, ref: string): string =>
  `import { useRef } from "react"\n${code}\nconst L = (props) => <p ref={${ref}} />\n`

const refShapes: Readonly<Record<string, Shape>> = {
  "names assigned to each other": (n) =>
    screen(`${names(n, "{}")}function g() { ${assignedToEach(n)} n0[k] = f }`, `n${n - 1}.a`),
  "names assigned to each other in every function": (n) =>
    screen(
      `${names(n, "{}")}${pieces(n, (fn) => `function g${fn}() { ${pieces(n, (to) => `n${to} = n${(to + fn + 1) % n}; `)} n${fn}[k] = f }\n`)}`,
      `n${n - 1}.a`
    ),
  "names assigned parts of each other": (n) =>
    screen(`${names(n, "{}")}function g() { ${assignedToEach(n, ".k")} n0[k] = f }`, `n${n - 1}.a`),
  "a name given parts of itself": (n) =>
    screen(`let a = {}\nfunction g() { ${pieces(n, (index) => `a = a.k${index}; `)} a[k] = f }`, "a.b"),
  "names each chosen from the two before": (n) =>
    screen(
      `const n0 = {}, n1 = {}\n${pieces(n, (index) => `const n${index + 2} = c ? n${index} : n${index + 1}\n`)}function g() { n${n}[k] = f }`,
      "n0.a"
    ),
  "names each chosen from parts of the two before": (n) =>
    screen(
      `const n0 = {}, n1 = {}\n${pieces(n, (index) => `const n${index + 2} = c ? n${index}.x : n${index + 1}.y\n`)}function g() { n${n}[k] = f }`,
      "n0.a"
    ),
  "names inside a function each chosen from the two before": (n) =>
    screen(
      `const n0 = {}, n1 = {}\nfunction g() { ${pieces(n, (index) => `const n${index + 2} = c ? n${index} : n${index + 1}; `)} n${n}[k] = f }`,
      "n0.a"
    ),
  "helpers that return each other's answers": (n) =>
    screen(
      pieces(
        n,
        (index) =>
          `function useG${index}() { ${pieces(n, (other) => `if (x${other}) return useG${other}(); `)} return useRef(null) }\n`
      ),
      "useG0()"
    ),
  "a function called again and again by the last of many names": (n) =>
    screen(
      `const n0 = Object.assign, r = {}\n${pieces(n, (index) => `const n${index + 1} = n${index}\n`)}function g() { ${pieces(n, () => `n${n}(r, {}); `)} }`,
      "r.a"
    ),
  "members chained": (n) => screen("", `a${pieces(n, (index) => `.m${index}`)}`),
  "a write into a chain of members": (n) =>
    screen(`let a = {}\nfunction g() { a${pieces(n, (index) => `.m${index}`)} = f }`, "a.b"),
  "calls chained": (n) =>
    screen(`function g() { a${pieces(n, (index) => `.m${index}()`)} }`, `a${pieces(n, (index) => `.m${index}()`)}`),
  "calls nested": (n) => screen(`function g() { return ${nested(n, (inner) => `f(${inner})`, "x")} }`, "g"),
  "choices nested": (n) =>
    screen(`let v = {}\nfunction g() { v = ${pieces(n, (index) => `a${index} ? b : `)}c; v[k] = f }`, "v.a"),
  "?? nested": (n) =>
    screen(`let v = {}\nfunction g() { v = ${nested(n, (inner) => `(${inner} ?? y)`, "x")}; v[k] = f }`, "v.a"),
  "lists mapped inside lists": (n) =>
    screen(
      `const M = () => ${nested(n, (inner, at) => `r${at + 1}.map((r${at}) => ${inner})`, "<p ref={r0.a} />")}`,
      "x"
    )
}

// Long chains of names for the refs law: n module names, each given the one before, chosen from its parts, or given
// a part of it, with a write, a call or a ref each.
const chainRefShapes: Readonly<Record<string, Shape>> = {
  "names each given the one before, a write and a ref each": (n) =>
    screen(
      `let n0 = {}\n${pieces(n - 1, (index) => `let n${index + 1} = n${index}\n`)}function g() {\n${pieces(n, (index) => `n${index}.a = f\n`)}}`,
      "n0.b"
    ) + `const M = () => <div>${pieces(n, (index) => `<p ref={n${index}.b} />`)}</div>\n`,
  "names each chosen from the parts of the one before, a call each": (n) =>
    screen(
      `let n0 = {}\n${pieces(n - 1, (index) => `let n${index + 1} = c ? n${index}.a : n${index}.b\n`)}function g() {\n${pieces(n, (index) => `n${index}()\n`)}}`,
      `n${n - 1}.x`
    ),
  "names each given a part of the one before, a call and a write each": (n) =>
    screen(
      `let n0 = {}\n${pieces(n - 1, (index) => `let n${index + 1} = n${index}.k${index}\n`)}function g() {\n${pieces(n, (index) => `n${index}.k${index}(); n${index}.w = f\n`)}}`,
      `n${n - 1}.x`
    )
}

/** Functions that each hand on what the next answers, the last answering a tag inside `answer`. */
const handedOn = (count: number, answer: string): string =>
  pieces(count, (index) => `function g${index}(x) { return ${index === count - 1 ? answer : `g${index + 1}(x)`} }\n`)

// Long chains for the tags law: functions that hand on the next one's answer, the answer nested.
const chainTagShapes: ReadonlyArray<readonly [string, number, number, (depth: number) => string]> = [
  ["?? nested", 130, 20, (depth) => nested(depth, (inner) => `(y ?? ${inner})`, "x._tag")],
  ["[…][0] nested", 130, 3, (depth) => nested(depth, (inner) => `[${inner}][0]`, "x._tag")]
]

/** Why a law did not read a file, by its case's name, or "read". */
const whyOf = (unread: O.Option<{ readonly unread: Unread }>): string =>
  O.match(unread, {
    onNone: () => "read",
    onSome: ({ unread: why }) =>
      Unread.$match(why, {
        Names: () => "Names",
        Nested: () => "Nested",
        Large: () => "Large",
        Unparsed: () => "Unparsed"
      })
  })

type Read = { readonly steps: number; readonly unread: boolean; readonly length: number }
const tagsRead = (source: string): Read => {
  const read = readTags({ file: "a.tsx", source })
  const unread = O.isSome(read.unread)
  // Refused in words at one line, and nothing else said.
  if (unread) expect(read.found).toEqual([])
  return { steps: read.steps, unread, length: source.length }
}
const refsRead = (source: string): Read => {
  const read = readScreen({ file: "a.tsx", source })
  const unread = O.isSome(read.unread)
  if (unread) expect([read.refs, read.attributes]).toEqual([[], []])
  return { steps: read.steps, unread, length: source.length }
}

/** Reads `source`, and holds that the law ended within its budget: what it said is the caller's to look at. */
const within = (law: "tags" | "refs", source: string): Read => {
  const read = law === "tags" ? tagsRead(source) : refsRead(source)
  const perCharacter = law === "tags" ? tagsStepsPerCharacter : refsStepsPerCharacter
  expect(read.steps).toBeLessThanOrEqual(budgetOf({ length: source.length, perCharacter }).limit)
  return read
}

/** The sizes of a shape, then ten times them. */
const sizes = [4, 6, 8, 10, 12, 16, 20, 30, 60, 200, 2000]
/** The sizes of a shape whose own length grows with the square of its size, then ten times the length. */
const squareSizes = [4, 5, 6, 8, 30, 60, 190]
const isSquare = (name: string): boolean => /each other/.test(name)
const sizesOf = (name: string): ReadonlyArray<number> => (isSquare(name) ? squareSizes : sizes)

describe("a law ends on any file within its budget, judged or refused in words", () => {
  it.each(R.toEntries(tagShapes))("the tags law: %s", (name, shape) => {
    for (const n of sizesOf(name)) within("tags", shape(n))
  })

  it.each(R.toEntries(deepTagShapes))("the tags law, by the depth: %s", (_, shape) => {
    for (const n of [4, 6, 8, 10, 12, 16, 20, 30, 60, 600]) within("tags", shape(n))
  })

  it.each(R.toEntries(refShapes))("the refs law: %s", (name, shape) => {
    for (const n of isSquare(name) ? [4, 5, 6, 8, 30, 60] : sizes) within("refs", shape(n))
  })

  it.each(R.toEntries(chainRefShapes))(
    "the refs law: %s, a hundred to ten thousand",
    (_, shape) => {
      for (const n of [100, 400, 800, 1000, 4000, 8000, 10_000]) within("refs", shape(n))
    },
    60_000
  )

  it.each(chainTagShapes)(
    "the tags law: %s, in a hundred and thirty functions and ten times as many, ten times as deep",
    (_, count, depth, answer) => {
      for (const [functions, deep] of [
        [count, depth],
        [count * 10, depth],
        [count, depth * 10],
        [count * 10, depth * 10]
      ] as const) {
        within("tags", `${handedOn(functions, answer(deep))}if (g0(x) === "A") f()\n`)
      }
    },
    60_000
  )

  it("no file is given more than the ceiling, however long", () => {
    expect(budgetOf({ length: maxFileSize, perCharacter: tagsStepsPerCharacter }).limit).toBe(maxSteps)
    expect(budgetOf({ length: 10_000, perCharacter: refsStepsPerCharacter }).limit).toBe(720_000)
  })

  // The shapes slowest to read at the ceiling: each ends within it, refused in words.
  // 9.7 s on two pinned cores alone, above the shared 30 s once the rest of the check runs beside it: 60 s.
  it("the heaviest shapes at a million characters end within the ceiling", () => {
    const heaviest: ReadonlyArray<readonly ["tags" | "refs", Shape | undefined, number]> = [
      ["refs", refShapes["names assigned to each other"], 285],
      ["refs", refShapes["names assigned to each other in every function"], 284],
      ["refs", refShapes["names assigned parts of each other"], 265],
      ["tags", deepTagShapes["records each spread from the two before"], 20_478],
      ["tags", tagShapes["functions that call the next"], 25_555]
    ]
    for (const [law, shape, n] of heaviest) {
      const source = shape === undefined ? "" : shape(n)
      expect(source.length).toBeGreaterThan(900_000)
      expect(source.length).toBeLessThanOrEqual(maxFileSize)
      const read = within(law, source)
      expect([read.steps <= maxSteps, read.unread]).toEqual([true, true])
    }
  }, 60_000)
})

describe("the shapes an ordinary file is made of are judged, not refused", () => {
  const exploding = /each other|each chosen from|given parts of itself/
  it.each(R.toEntries(tagShapes))("the tags law: %s", (name, shape) => {
    for (const n of isSquare(name) ? [4, 8, 30] : [4, 10, 30]) expect(tagsRead(shape(n)).unread).toBe(false)
  })

  it.each(A.filter(R.toEntries(refShapes), ([name]) => !exploding.test(name)))("the refs law: %s", (_, shape) => {
    for (const n of [4, 10, 30]) expect(refsRead(shape(n)).unread).toBe(false)
  })

  // Read in seconds, not in minutes: each name's places are compared with the writes under the same name only. Ten
  // thousand of them (half a million characters) need more steps than the ceiling gives any file.
  it("the refs law: names given the one before, or a part of it, a hundred and a thousand of them", () => {
    for (const shape of [
      chainRefShapes["names each given the one before, a write and a ref each"],
      chainRefShapes["names each given a part of the one before, a call and a write each"]
    ]) {
      for (const n of [100, 1000]) expect(shape === undefined || refsRead(shape(n)).unread).toBe(false)
      expect(shape === undefined || refsRead(shape(10_000)).unread).toBe(true)
    }
  })

  it("the refs law: a record a function writes into at ten thousand keys, read at another", () => {
    const writes = pieces(10_000, (index) => `big.k${index} = f; `)
    const read = readScreen({ file: "a.tsx", source: screen(`const big = {}\nfunction g() { ${writes} }`, "big.x") })
    expect(A.map(read.refs, ({ verdict }) => verdict.kind)).toEqual(["steady"])
  })

  it("the tags law: a tag handed on by a hundred and thirty functions, and by three hundred", () => {
    for (const [, count, depth, answer] of chainTagShapes) {
      for (const functions of [count, 300]) {
        const source = `${handedOn(functions, answer(depth))}if (g0(x) === "A") f()\n`
        expect(readTags({ file: "a.ts", source }).found).toEqual([{ line: functions + 1, how: "===" }])
      }
    }
  })
})

// Long shapes of ordinary code, each a screen with a ref and a tag told apart by hand: what both laws said of each
// before they had a budget (the tags law's call chain, which it took minutes on, from the same chain of ten).
const longShapes: ReadonlyArray<readonly [string, number, Shape, ReadonlyArray<string>, number]> = [
  [
    "a call chain",
    300,
    (n) => screen(`if (a${pieces(n, (i) => `.m${i}()`)}._tag === "A") f()`, `a${pieces(n, (i) => `.m${i}()`)}`),
    ["refused"],
    1
  ],
  [
    "a member chain",
    300,
    (n) => screen(`if (a${pieces(n, (i) => `.m${i}`)}._tag === "A") f()`, `a${pieces(n, (i) => `.m${i}`)}`),
    ["steady"],
    1
  ],
  [
    "a concatenation",
    300,
    (n) => screen(`const t = x._tag\nconst s = ${pieces(n, () => `"c, " + t`, " + ")}\nif (s === "A") f()`, "s"),
    ["steady"],
    1
  ],
  [
    "a + chain",
    300,
    (n) => screen(`const v = ${pieces(n, (i) => `a${i}`, " + ")} + x._tag\nif (v === "A") f()`, "v"),
    ["steady"],
    1
  ],
  [
    "an else-if chain",
    300,
    (n) =>
      `import { useRef } from "react"\nexport const L = (x) => {\n  if (x._tag === "A") return null\n${pieces(n, (i) => `  else if (x.k === ${i}) return null\n`)}  else return <p ref={x.r} />\n}\n`,
    ["prop"],
    1
  ],
  [
    "nested JSX",
    300,
    (n) =>
      `import { useRef } from "react"\nconst r = {}\nexport const L = (x) => ${pieces(n, () => "<div>")}<p ref={r.a} onClick={() => x._tag === "A"} />${pieces(n, () => "</div>")}\n`,
    ["steady"],
    1
  ],
  [
    "a ternary chain",
    300,
    (n) =>
      screen(
        `const k = ${pieces(n, (i) => `c${i} ? x._tag : `)}x.k\nif (k === "A") f()`,
        `${pieces(n, (i) => `c${i} ? a : `)}b`
      ),
    ["refused"],
    1
  ],
  [
    "a choice among many",
    250,
    (n) =>
      screen(
        `const h = ${pieces(n, (i) => `x._tag === "${i}" ? ${i} : `)}-1`,
        `${pieces(n, (i) => `a === ${i} ? h${i} : `)}h`
      ),
    ["refused"],
    250
  ]
]

describe("long shapes of ordinary code get the verdicts the laws gave before they had a budget", () => {
  it.each(longShapes)("%s, %d long", (_, n, shape, refs, compared) => {
    const source = shape(n)
    expect(A.map(readScreen({ file: "a.tsx", source }).refs, ({ verdict }) => verdict.kind)).toEqual(refs)
    expect(A.map(readTags({ file: "a.tsx", source }).found, ({ how }) => how)).toEqual(A.makeBy(compared, () => "==="))
  })
})

// The shapes the parser dies on, natively, past any catch, with the size it dies at (bisected on node and bun alike,
// oxc-parser 0.148.0) and the size the scan refuses them from.
const crashing: ReadonlyArray<readonly [string, Shape, number, number]> = [
  ["a sum", (n) => `const x = ${Str.repeat(n)("a + ")}a\n`, 74_752, 4000],
  ["a sum over lines", (n) => `const x =\n${Str.repeat(n)("  a +\n")}  a\n`, 74_752, 4000],
  ["&& chained", (n) => `const x = ${Str.repeat(n)("a && ")}a\n`, 74_752, 2000],
  ["! repeated", (n) => `const x = ${Str.repeat(n)("!")}a\n`, 74_752, 4000],
  ["choices chained", (n) => `const x = ${Str.repeat(n)("a ? b : ")}c\n`, 12_480, 2000],
  ["choices chained over lines", (n) => `const x =\n${Str.repeat(n)("  a\n  ? b\n  : ")}c\n`, 12_480, 2000],
  ["arrows chained", (n) => `const x = ${Str.repeat(n)("a => ")}a\n`, 9536, 2000],
  ["assignments chained", (n) => `let a; a = ${Str.repeat(n)("a = ")}1\n`, 15_872, 4000],
  ["elements nested", (n) => `const x = ${Str.repeat(n)("<a>")}${Str.repeat(n)("</a>")}\n`, 18_688, 2000],
  ["an else-if chain", (n) => `if (a) {} ${Str.repeat(n)("else if (a) {} ")}\n`, 27_648, 1333],
  ["an else-if chain over lines", (n) => `if (a) {\n}${Str.repeat(n)(" else if (a) {\n}")}\n`, 27_648, 1333],
  ["types nested in arguments", (n) => `type T = ${Str.repeat(n)("A<")}x${Str.repeat(n)(">")}\n`, 5760, 2000],
  ["an expectation's matchers", (n) => `expect(a)${pieces(n, (i) => `.not.m${i}(b)`)}\n`, 47_616, 1334],
  ["parentheses nested", (n) => `const x = ${Str.repeat(n)("(")}a${Str.repeat(n)(")")}\n`, 5696, maxBrackets + 1],
  ["templates nested", (n) => `const x = ${Str.repeat(n)("`${")}a${Str.repeat(n)("}`")}\n`, 5024, maxBrackets + 1]
]

describe("the scan refuses, before parsing, what the parser dies on", () => {
  it.each(crashing)("%s: from its bound, well before the parser dies", (_, shape, dies, from) => {
    expect(from * 2).toBeLessThan(dies)
    expect(whyOf(O.fromUndefinedOr(unreadable(shape(from - 1))))).toBe("read")
    expect(whyOf(O.fromUndefinedOr(unreadable(shape(from))))).toBe("Nested")
    // Both laws refuse it in words, and neither hands it to the parser.
    expect(whyOf(readTags({ file: "a.tsx", source: shape(dies) }).unread)).toBe("Nested")
    expect(whyOf(readScreen({ file: "a.tsx", source: shape(dies) }).unread)).toBe("Nested")
  })

  it("refuses at the line where the bound is passed", () => {
    const deep = `const a = 1\nconst v = ${nested(10 * maxBrackets, (inner) => `[${inner}]`, "x")}\n`
    expect(readTags({ file: "a.ts", source: deep }).unread).toEqual(O.some({ line: 2, unread: Unread.Nested() }))
    expect(readScreen({ file: "a.tsx", source: deep }).unread).toEqual(O.some({ line: 2, unread: Unread.Nested() }))
  })

  it("counts no bracket in a string, a comment, a template's text or a regular expression", () => {
    const real = `const v = ${Str.repeat(maxBrackets + 1)("(")}x${Str.repeat(maxBrackets + 1)(")")}\n`
    const closing = Str.repeat(6000)(")")
    for (const before of [
      `const s = "${closing}"\n`,
      `const s = '${closing}'\n`,
      `/* ${Str.repeat(6000)("}")} */\n`,
      `// ${closing}\n`,
      `const s = \`${Str.repeat(6000)("]")}\`\n`,
      `const r = /${Str.repeat(6000)("\\)")}/\n`,
      `${closing}\n`
    ]) {
      expect(whyOf(O.fromUndefinedOr(unreadable(`${before}${real}`)))).toBe("Nested")
    }
    const opening = Str.repeat(6000)("(")
    for (const held of [
      `"${opening}"`,
      `'${opening}'`,
      `/* ${opening} */`,
      `\`${opening}\``,
      `/${Str.repeat(6000)("\\(")}/`
    ]) {
      expect(unreadable(`const s = ${held}\nf(s)\n`)).toBeUndefined()
    }
    // A quote after a letter is a letter of the text it is in, so an element's text does not open a string.
    expect(unreadable(`const P = () => <p>Don't ${Str.repeat(10)("(")}</p>\nconst v = (x)\n`)).toBeUndefined()
  })

  it("lets an element's siblings be, and a statement end a chain", () => {
    expect(unreadable(`const M = () => <div>${pieces(10_000, (i) => `<p ref={n${i}.b} />`)}</div>\n`)).toBeUndefined()
    expect(
      unreadable(`const M = () => (\n  <ul>\n${pieces(10_000, (i) => `    <li>row ${i}: a.b</li>\n`)}  </ul>\n)\n`)
    ).toBeUndefined()
    expect(unreadable(pieces(10_000, (i) => `const a${i} = b + c ? d : e\n`))).toBeUndefined()
    expect(unreadable(`const v = [${pieces(10_000, (i) => `a${i} + b`, ", ")}]\n`)).toBeUndefined()
    expect(maxChain).toBe(4000)
  })

  it("refuses a file longer than the largest a law reads", () => {
    const long = `const a = 1\n${Str.repeat(maxFileSize)("x")}`
    expect(whyOf(O.fromUndefinedOr(unreadable(long)))).toBe("Large")
    expect(unreadable(Str.repeat(maxFileSize)("x"))).toBeUndefined()
    expect(readTags({ file: "a.ts", source: long }).unread).toEqual(O.some({ line: 1, unread: Unread.Large() }))
    expect(readScreen({ file: "a.tsx", source: long }).unread).toEqual(O.some({ line: 1, unread: Unread.Large() }))
  })
})

describe("a law refuses what it cannot read within its depths, and never throws", () => {
  it("refuses reads nested past the bound, and reads them below it", () => {
    const pattern = (n: number) =>
      `import { useRef } from "react"\nfunction g(${nested(n, (inner) => `{ a: ${inner} }`, "t")}) {}\nconst L = () => <p ref={t} />\n`
    const choices = (n: number) => `const v = ${nested(n, (inner) => `(y ?? ${inner})`, "x._tag")}\nf(v)\n`
    // Deeper than node's stack holds without the bound, and well inside the scan's.
    expect(whyOf(readScreen({ file: "a.tsx", source: pattern(990) }).unread)).toBe("Nested")
    expect(whyOf(readTags({ file: "a.ts", source: choices(990) }).unread)).toBe("Nested")
    expect(A.map(readScreen({ file: "a.tsx", source: pattern(300) }).refs, ({ verdict }) => verdict.kind)).toEqual([
      "steady"
    ])
    expect(readTags({ file: "a.ts", source: choices(300) }).found).toEqual([{ line: 2, how: "argument" }])
  })

  it("counts every read inside another, and a judgement that follows a name in both", () => {
    const budget = budgetOf({ length: 0, perCharacter: tagsStepsPerCharacter })
    const down = (n: number, follows: boolean): number =>
      n === 0 ? 0 : (follows ? budget.following : budget.within)(n, -1, () => down(n - 1, follows) + 1)
    expect(down(maxNesting, false)).toBe(maxNesting)
    expect([budget.nestedMost(), budget.deepest(), budget.stopped()]).toEqual([maxNesting, 0, undefined])
    expect(down(maxDepth, true)).toBe(maxDepth)
    expect(budget.deepest()).toBe(maxDepth)
    expect(down(maxNesting + 1, false)).toBe(maxNesting - 1)
    expect(O.map(O.fromUndefinedOr(budget.stopped()), ({ unread }) => unread)).toEqual(O.some(Unread.Nested()))
    const following = budgetOf({ length: 0, perCharacter: tagsStepsPerCharacter })
    const follow = (n: number): number => (n === 0 ? 0 : following.following(n, -1, () => follow(n - 1) + 1))
    expect(follow(maxDepth + 1)).toBe(maxDepth - 1)
    expect(O.map(O.fromUndefinedOr(following.stopped()), ({ unread }) => unread)).toEqual(O.some(Unread.Names()))
  })

  it("refuses, and never throws, judgements nested past the stack: the records and choices nine hundred deep", () => {
    const records = nested(900, (inner) => `{ a: ${inner} }`, "x")
    expect(
      A.map(
        readScreen({ file: "a.tsx", source: screen(`const v = ${records}`, "v.a") }).refs,
        ({ verdict }) => verdict.kind
      )
    ).toEqual(["steady"])
    const choices = nested(900, (inner) => `(y ?? ${inner})`, "x._tag")
    expect(readTags({ file: "a.ts", source: `const v = ${choices}\nf(v)` }).unread).toEqual(
      O.some({ line: 1, unread: Unread.Nested() })
    )
  })
})

describe("a file the parser reads with errors is refused, not passed", () => {
  const broken = [
    `const x = 1)\nexport const L = () => <div ref={(e) => e} />\nif (y._tag === "A") f()\n`,
    `export const L = () => <div ref={(e) => e} />\nif (y._tag === "A") f()\nconst s = \`\${`
  ]
  it.each(broken)("both laws: %#", (source) => {
    expect(whyOf(readTags({ file: "a.tsx", source }).unread)).toBe("Unparsed")
    expect(whyOf(readScreen({ file: "a.tsx", source }).unread)).toBe("Unparsed")
  })

  it("at the line of the parser's first error", () => {
    const source = `const a = 1\nconst x = 1)\n`
    expect(O.map(readTags({ file: "a.ts", source }).unread, ({ line }) => line)).toEqual(O.some(2))
    expect(O.map(readScreen({ file: "a.tsx", source }).unread, ({ line }) => line)).toEqual(O.some(2))
  })
})

describe("the words for each refusal fit its cause", () => {
  it("names, nesting, size and the parser's error", () => {
    expect(
      A.map(
        [Unread.Names(), Unread.Nested(), Unread.Large(), Unread.Unparsed({ message: "Unexpected token" })],
        unreadSentence
      )
    ).toEqual([
      "the names here lead into each other too far for the law to read in the steps it allows a file this long: write it with fewer steps (one name for one value, given where it is used)",
      "the code here is nested too deep to read: write it with fewer brackets, choices or operators inside one another (a name for a part, a list for many)",
      `the file is longer than the ${maxFileSize} characters a law reads: split it`,
      "the file could not be parsed (Unexpected token): the law reads it once it parses"
    ])
  })
})

describe("the tags law tells a tag through what holds it", () => {
  const found = (source: string) => A.map(readTags({ file: "a.ts", source }).found, ({ how }) => how)

  it("follows a chain of thousands of links, the tag at its end told apart", () => {
    const links = pieces(3000, (index) => `.m${index}`)
    const sum = pieces(3000, (index) => `"s${index}"`, " + ")
    expect(found(`if (a${links}._tag === "A") f()`)).toEqual(["==="])
    expect(found(`if (a${pieces(1500, (index) => `.m${index}()`)}._tag === "A") f()`)).toEqual(["==="])
    expect(found(`if (${sum} + x._tag === "A") f()`)).toEqual(["==="])
    expect(found(`if (${sum} === "A") f()`)).toEqual([])
    expect(found(`if (a${links} === "A") f()`)).toEqual([])
  })

  it("keeps a tag through thirty names, and through functions that call themselves or three hundred others", () => {
    const chosen = pieces(30, (index) => `const n${index + 2} = c ? n${index} : n${index + 1}\n`)
    expect(found(`const n0 = x._tag, n1 = 1\n${chosen}if (n31 === "A") f()`)).toEqual(["==="])
    expect(found(`const n0 = 1, n1 = 1\n${chosen}if (n31 === "A") f()`)).toEqual([])
    const kept = pieces(30, (index) => `const n${index + 2} = { a: n${index}, b: n${index + 1} }\n`)
    expect(found(`const n0 = { k: x._tag }, n1 = {}\n${kept}f(n31)`)).toEqual(["argument"])
    // It calls itself before it hands the tag back: what is judged before that is known is judged again.
    const itself = "function kind(x) { const t = kind(x.next); if (t) return t; return x._tag }"
    expect(found(`${itself}\nif (kind(x) === "A") f()`)).toEqual(["==="])
    const mutual =
      "function a(x) { const t = b(x); return t } function b(x) { const t = a(x); return x.k ? t : x._tag }"
    expect(found(`${mutual}\nif (a(x) === "A") f()\nif (b(x) === "A") f()`)).toEqual(["===", "==="])
    expect(found(`${handedOn(300, "x._tag")}if (g0(x) === "A") f()`)).toEqual(["==="])
    expect(found(`${handedOn(300, "x.k")}if (g0(x) === "A") f()`)).toEqual([])
    // A tag only where the function was called, the name set again since.
    const called = `const v = (() => { ${handedOn(300, "r")} return g0(x) })()`
    expect(found(`var r = x._tag\n${called}\nvar r = 1\nf(v)`)).toEqual(["argument"])
  })
})

describe("the refs law gives the verdicts it gave before it had a budget", () => {
  const verdicts = (code: string, ref: string) =>
    A.map(readScreen({ file: "a.tsx", source: screen(code, ref) }).refs, ({ verdict }) => verdict.kind)
  const eight = (name: string, from: number) => pieces(8 - from, (index) => `${name} = ${name}.k${index}\n`)

  it("refuses a record written into after a name was given eight parts of itself", () => {
    expect(verdicts(`let node = {}\n${eight("node", 0)}function g() { node.a = f }`, "node.k7.a")).toEqual(["refused"])
  })

  it("refuses a write through a name given another, whatever else the function writes before it", () => {
    const given = `let b = {}, cc = {}\n${eight("b", 1)}b = cc\ncc = b.z\n`
    for (const writes of ["cc.a = f", "cc.a = f; b.q = f", "b.a = f; cc.a = f"]) {
      expect(verdicts(`${given}function g() { ${writes} }`, "b.z.a")).toEqual(["refused"])
    }
  })

  it("refuses a record handed to Object.assign under a name chosen among nine", () => {
    const put = `${pieces(8, (index) => `c${index} ? O.p${index} : `)}O.assign`
    expect(
      verdicts(`const O = Object\nconst refs = {}\nfunction g() { const put = ${put}; put(refs, {}) }`, "refs.a")
    ).toEqual(["refused"])
  })

  it("leaves a part no write reaches, among nine parts a name is given one at a time or by a choice", () => {
    const handlers = "const handlers = { lead: f0 }\nlet current\n"
    const each = pieces(9, (index) => `function s${index}() { current = handlers.step${index} }\n`)
    const chosen = `function s() { current = ${pieces(9, (index) => `c${index} ? handlers.step${index} : `)}handlers.end }\n`
    for (const given of [each, chosen]) {
      expect(verdicts(`${handlers}${given}function w() { current[k] = f }`, "handlers.lead")).toEqual(["steady"])
    }
  })

  it("refuses a name given a part of itself, and its parts, and leaves the rest", () => {
    const turned = "let node = {}\nnode = node.next\nfunction g() { node.a = f }"
    expect(A.flatMap(["node.a", "node.next.a", "node.b"], (ref) => verdicts(turned, ref))).toEqual([
      "refused",
      "refused",
      "steady"
    ])
  })
})

describe("a file a law does not read is one finding, at the line it stopped, in words that say why", () => {
  const deep = `export const a = 1\nexport const v = ${nested(maxBrackets + 1, (inner) => `[${inner}]`, "x")}\n`
  const large = `export const a = 1\n// ${Str.repeat(maxFileSize)("x")}\n`
  const broken = "export const a = 1\nexport const b = 1)\n"
  const spread = deepTagShapes["records each spread from the two before"]
  const assigned = refShapes["names assigned to each other"]
  const ref = "export const L = () => <p ref={v} />\n"
  const causes: ReadonlyArray<readonly [string, string, string, string]> = [
    ["names", spread === undefined ? "" : spread(2221), assigned === undefined ? "" : assigned(60), "Names"],
    ["nesting", deep, `${deep}${ref}`, "Nested"],
    ["size", large, `${large}${ref}`, "Large"],
    ["the parser", broken, `${broken}${ref}`, "Unparsed"]
  ]

  it.effect.each(causes)("the tags law: %s", ([, source, , cause]) =>
    Effect.gen(function* () {
      const read = readTags({ file: "a.ts", source })
      expect(whyOf(read.unread)).toBe(cause)
      const report = yield* inTree(
        { "packages/review/src/internal/Grid.ts": source },
        Effect.gen(function* () {
          const repo = yield* Repo
          yield* repo.run("git", ["init", "-q"])
          const found = yield* tags()
          return render(tagsSentence)(found)
        })
      )
      expect(printed(report).slice(1)).toEqual(
        A.map(
          O.toArray(read.unread),
          ({ line, unread }) => `err: packages/review/src/internal/Grid.ts:${line}  ${unreadSentence(unread)}`
        )
      )
    })
  )

  it.effect.each(causes)("the refs law: %s", ([, , source, cause]) =>
    Effect.gen(function* () {
      const read = readScreen({ file: "a.tsx", source })
      expect(whyOf(read.unread)).toBe(cause)
      const report = yield* inTree(
        { "packages/review/src/Grid.tsx": source },
        Effect.gen(function* () {
          const repo = yield* Repo
          yield* repo.run("git", ["init", "-q"])
          const found = yield* refCallbacks()
          return render(refCallbacksSentence)(found)
        })
      )
      expect(printed(report).slice(1)).toEqual(
        A.map(
          O.toArray(read.unread),
          ({ line, unread }) => `err: packages/review/src/Grid.tsx:${line}  ${unreadSentence(unread)}`
        )
      )
    })
  )
})

describe("lines", () => {
  it("says the line of an offset, the line ends included, as counting the line starts before it does", () => {
    const source = "a\nbc\n\nd"
    const lineAt = linesOf(source)
    expect(A.map([0, 1, 2, 3, 4, 5, 6], lineAt)).toEqual([1, 1, 2, 2, 2, 3, 4])
    expect(linesOf("")(0)).toBe(1)
    const text = pieces(300, (index) => (index % 7 === 0 ? "\n" : index % 5 === 0 ? "\n\n" : "ab"))
    const starts = A.reduce(Str.split("\n")(text), [0], (offsets, line) =>
      A.append(offsets, (offsets[offsets.length - 1] ?? 0) + line.length + 1)
    )
    const counted = linesOf(text)
    for (let offset = 0; offset <= text.length; offset += 1) {
      expect(counted(offset)).toBe(A.filter(starts, (start) => start <= offset).length)
    }
  })
})
