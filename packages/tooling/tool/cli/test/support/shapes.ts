// The shapes of source the budget's tests read (Steps.test.ts, and the at-scale ones in Steps.slow.test.ts), each as
// long as its size says, and `within`: a law's read of one, held to end within the steps its length allows.
import { expect } from "@effect/vitest"
import * as A from "effect/Array"
import * as O from "effect/Option"
import { dual } from "effect/Function"
import {
  budgetOf,
  refsStepsPerCharacter,
  tagsStepsPerCharacter,
  Unread
} from "../../src/commands/Laws/internal/budget.ts"
import { readScreen } from "../../src/commands/Laws/internal/refCallbacksCode.ts"
import { readTags } from "../../src/commands/Laws/internal/tagsCode.ts"

/** One shape of source, as long as `n` says. */
export type Shape = (n: number) => string

/** `n` pieces, one after the other. */
export const pieces: {
  (piece: (index: number) => string, between?: string): (n: number) => string
  (n: number, piece: (index: number) => string, between?: string): string
} = dual(
  (args) => typeof args[0] === "number",
  (n: number, piece: (index: number) => string, between = ""): string => A.join(A.makeBy(n, piece), between)
)

/** `seed` wrapped `n` times, the last wrap outermost. */
export const nested: {
  (wrap: (inner: string, index: number) => string, seed: string): (n: number) => string
  (n: number, wrap: (inner: string, index: number) => string, seed: string): string
} = dual(3, (n: number, wrap: (inner: string, index: number) => string, seed: string): string =>
  A.reduce(
    A.makeBy(n, (index) => index),
    seed,
    wrap
  )
)

const names = (n: number, initial: string): string => pieces(n, (index) => `let n${index} = ${initial}\n`)
/** Every name assigned every other one, in one function. */
const assignedToEach = (n: number, key = ""): string =>
  pieces(n, (to) => pieces(n, (from) => (to === from ? "" : `n${to} = n${from}${key}; `)))

// Shapes a walk of every way to a node took a time on that grew without bound with their size.
export const tagShapes: Readonly<Record<string, Shape>> = {
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
export const deepTagShapes: Readonly<Record<string, Shape>> = {
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

export const screen: {
  (ref: string): (code: string) => string
  (code: string, ref: string): string
} = dual(
  2,
  (code: string, ref: string): string =>
    `import { useRef } from "react"\n${code}\nconst L = (props) => <p ref={${ref}} />\n`
)

export const refShapes: Readonly<Record<string, Shape>> = {
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
export const chainRefShapes: Readonly<Record<string, Shape>> = {
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
export const handedOn: {
  (answer: string): (count: number) => string
  (count: number, answer: string): string
} = dual(2, (count: number, answer: string): string =>
  pieces(count, (index) => `function g${index}(x) { return ${index === count - 1 ? answer : `g${index + 1}(x)`} }\n`)
)

// Long chains for the tags law: functions that hand on the next one's answer, the answer nested.
export const chainTagShapes: ReadonlyArray<readonly [string, number, number, (depth: number) => string]> = [
  ["?? nested", 130, 20, (depth) => nested(depth, (inner) => `(y ?? ${inner})`, "x._tag")],
  ["[…][0] nested", 130, 3, (depth) => nested(depth, (inner) => `[${inner}][0]`, "x._tag")]
]

/** Why a law did not read a file, by its case's name, or "read". */
export const whyOf = (unread: O.Option<{ readonly unread: Unread }>): string =>
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

export type Read = { readonly steps: number; readonly unread: boolean; readonly length: number }
export const tagsRead = (source: string): Read => {
  const read = readTags({ file: "a.tsx", source })
  const unread = O.isSome(read.unread)
  // Refused in words at one line, and nothing else said.
  if (unread) expect(read.found).toEqual([])
  return { steps: read.steps, unread, length: source.length }
}
export const refsRead = (source: string): Read => {
  const read = readScreen({ file: "a.tsx", source })
  const unread = O.isSome(read.unread)
  if (unread) expect([read.refs, read.attributes]).toEqual([[], []])
  return { steps: read.steps, unread, length: source.length }
}

/** Reads `source`, and holds that the law ended within its budget: what it said is the caller's to look at. */
export const within: {
  (source: string): (law: "tags" | "refs") => Read
  (law: "tags" | "refs", source: string): Read
} = dual(2, (law: "tags" | "refs", source: string): Read => {
  const read = law === "tags" ? tagsRead(source) : refsRead(source)
  const perCharacter = law === "tags" ? tagsStepsPerCharacter : refsStepsPerCharacter
  expect(read.steps).toBeLessThanOrEqual(budgetOf({ length: source.length, perCharacter }).limit)
  return read
})

/** The sizes of a shape, then ten times them. */
export const sizes = [4, 6, 8, 10, 12, 16, 20, 30, 60, 200, 2000]
/** The sizes of a shape whose own length grows with the square of its size, then ten times the length. */
const squareSizes = [4, 5, 6, 8, 30, 60, 190]
export const isSquare = (name: string): boolean => /each other/.test(name)
export const sizesOf = (name: string): ReadonlyArray<number> => (isSquare(name) ? squareSizes : sizes)
