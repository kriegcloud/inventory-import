// The places one file settles absence, a starting value or a clean-up in its own code, read from its syntax tree and
// from nothing else: no types, no flow, no judgement of what the code means. Four things are found, each by how it is
// written: a fallback (`??`, `??=`, `||` and `||=` before a value written out, `getOrElse`, and outside a `.tsx` file a
// parameter or a destructured name given a default: in a `.tsx` file that is where a component's optional prop takes
// its default, Benjamin's decision of 2026-11-23, and the reader cannot tell a component from another function),
// a comparison with `null` or `undefined`, an Option turned back into a missing
// value (`getOrUndefined`, `getOrNull`), and a trim or a change of case that is not a schema's own
// (`SchemaGetter.trim()`, `SchemaTransformation.toLowerCase()`). A pattern over the text would also take the words
// out of a comment or a string, so the tree is read; the read is one parse and one walk, so a whole repository takes
// about a second and one file a few milliseconds.
import { LiteralKit } from "@beep/schema/LiteralKit"
import * as A from "effect/Array"
import * as O from "effect/Option"
import * as P from "effect/Predicate"
import * as R from "effect/Record"
import * as Str from "effect/String"
import { parseSync } from "oxc-parser"
import { linesOf } from "./lines.ts"

/** The four ways code answers a question its schema should have answered. */
export const DefaultsKind = LiteralKit(["fallback", "absence", "unwrap", "normalise"])

/** The decoded value of `DefaultsKind`. */
export type DefaultsKind = typeof DefaultsKind.Type

/** One place: its kind, its line from 1, and the code itself, by which a place is known again when its line moves. */
export interface DefaultsPlace {
  readonly kind: DefaultsKind
  readonly line: number
  readonly code: string
}

/** What one file holds, or why it was not read. */
export interface DefaultsRead {
  readonly found: ReadonlyArray<DefaultsPlace>
  readonly unread: O.Option<string>
}

type Node = Readonly<Record<string, unknown>> & { readonly type: string; readonly start: number; readonly end: number }

const isNode = (value: unknown): value is Node =>
  P.isObject(value) && P.isString(value["type"]) && P.isNumber(value["start"]) && P.isNumber(value["end"])
const child = (node: Node, key: string): O.Option<Node> => O.liftPredicate(node[key], isNode)
const text = (node: Node, key: string): O.Option<string> => O.liftPredicate(node[key], P.isString)
const children = (node: Node): ReadonlyArray<Node> =>
  A.flatMap(R.toEntries(node), ([key, value]) =>
    key === "parent" ? [] : A.isArray(value) ? A.filter(value, isNode) : isNode(value) ? [value] : []
  )

// What a comparison's side is once its brackets and its type notes are taken off: `(x as Y)!` is `x`.
const wrappers = ["ParenthesizedExpression", "TSAsExpression", "TSNonNullExpression", "TSSatisfiesExpression"]
const bare = (node: Node): Node => {
  let at = node
  for (let inner = child(at, "expression"); A.contains(wrappers, at.type) && O.isSome(inner);) {
    at = inner.value
    inner = child(at, "expression")
  }
  return at
}

const named = (node: Node, name: string): boolean =>
  node.type === "Identifier" && O.exists(text(node, "name"), (own) => own === name)
const isMissing = (node: Node): boolean =>
  named(node, "undefined") || (node.type === "Literal" && O.exists(text(node, "raw"), (raw) => raw === "null"))
// `typeof x === "undefined"` asks the same thing in other words.
const isTypeofMissing = (one: Node, other: Node): boolean =>
  one.type === "UnaryExpression" &&
  O.exists(text(one, "operator"), (operator) => operator === "typeof") &&
  other.type === "Literal" &&
  O.exists(text(other, "value"), (value) => value === "undefined")

const comparisons = ["===", "!==", "==", "!="]
// `x || ""` is `x ?? ""` in older words. Told from a condition (`a || b`) by its right side being a value written out.
const writtenOut = ["Literal", "TemplateLiteral", "ArrayExpression", "ObjectExpression"]
const fallbacks = ["getOrElse"]
const unwraps = ["getOrUndefined", "getOrNull"]
const cleanUps = ["trim", "trimStart", "trimEnd", "toLowerCase", "toUpperCase"]
// A schema's own clean-up is where the rule wants it.
const schemaModules = ["SchemaGetter", "SchemaTransformation"]

/**
 * What is counted, in the reader's own words. A baseline says which of these it was written for, so one written
 * before the reader counted more is known for what it is and is not held against the fuller one.
 */
export const whatIsCounted: ReadonlyArray<string> = [
  "??",
  "??=",
  "|| value",
  "||= value",
  ...fallbacks,
  "name = value outside .tsx",
  "null",
  "undefined",
  ...unwraps,
  ...cleanUps
]

const kindOf = (node: Node, screen: boolean): O.Option<DefaultsKind> => {
  const operator = text(node, "operator")
  const is = (written: string): boolean => O.exists(operator, (own) => own === written)
  if (node.type === "LogicalExpression" && is("??")) return O.some("fallback")
  if (node.type === "AssignmentExpression" && is("??=")) return O.some("fallback")
  // `(n = 0) =>` and `const { n = 0 } = x`: the same fallback, written where the name is bound.
  if (node.type === "AssignmentPattern" && !screen) return O.some("fallback")
  if (
    ((node.type === "LogicalExpression" && is("||")) || (node.type === "AssignmentExpression" && is("||="))) &&
    O.exists(child(node, "right"), (right) => A.contains(writtenOut, bare(right).type))
  ) {
    return O.some("fallback")
  }
  if (node.type === "BinaryExpression" && O.exists(operator, (own) => A.contains(comparisons, own))) {
    return O.flatMap(child(node, "left"), (left) =>
      O.flatMap(child(node, "right"), (right) => {
        const one = bare(left)
        const other = bare(right)
        return isMissing(one) || isMissing(other) || isTypeofMissing(one, other) || isTypeofMissing(other, one)
          ? O.some<DefaultsKind>("absence")
          : O.none()
      })
    )
  }
  if (node.type === "MemberExpression" && node["computed"] !== true) {
    return O.flatMap(child(node, "property"), (property) =>
      O.flatMap(text(property, "name"), (name) => {
        if (A.contains(fallbacks, name)) return O.some<DefaultsKind>("fallback")
        if (A.contains(unwraps, name)) return O.some<DefaultsKind>("unwrap")
        const onSchema = O.exists(child(node, "object"), (object) =>
          A.some(schemaModules, (module) => named(object, module))
        )
        return A.contains(cleanUps, name) && !onSchema ? O.some<DefaultsKind>("normalise") : O.none()
      })
    )
  }
  return O.none()
}

/**
 * The places of one file, in the order they are written.
 *
 * @example
 * readDefaults({ file: "a.ts", source: "export const n = (x?: number) => x ?? 0" })
 * // { found: [{ kind: "fallback", line: 1, code: "x ?? 0" }], unread: none }
 */
export const readDefaults = (input: { readonly file: string; readonly source: string }): DefaultsRead => {
  const parsed = parseSync(input.file, input.source)
  const refused = A.head(parsed.errors)
  if (O.isSome(refused)) return { found: [], unread: O.some(refused.value.message) }
  if (!isNode(parsed.program)) return { found: [], unread: O.some("the parser gave no program") }
  const lineOf = linesOf(input.source)
  const screen = Str.endsWith(".tsx")(input.file)
  const found: Array<DefaultsPlace> = []
  // The walk keeps its own list, so no file nests it past the stack.
  const pending: Array<Node> = [parsed.program]
  while (A.isArrayNonEmpty(pending)) {
    const node = pending.pop()
    if (!isNode(node)) continue
    const kind = kindOf(node, screen)
    if (O.isSome(kind)) {
      found.push({ kind: kind.value, line: lineOf(node.start), code: Str.slice(node.start, node.end)(input.source) })
    }
    for (const next of A.reverse(children(node))) pending.push(next)
  }
  return {
    found: A.sortWith(
      found,
      (place) => place.line,
      (a, b) => (a < b ? -1 : a > b ? 1 : 0)
    ),
    unread: O.none()
  }
}
