// The places one file tells a tagged value's case by comparing its `_tag` by hand: `x._tag === "Saving"`,
// `x?._tag !== "None"`, a `switch` on `x._tag`. Read from the syntax tree, the parser's plain data, as records of unknown
// values: a comparison split over lines, or written with `==`, is the same node.
import * as A from "effect/Array"
import * as O from "effect/Option"
import * as P from "effect/Predicate"
import * as R from "effect/Record"
import * as Str from "effect/String"
import { parseSync } from "oxc-parser"

/** A node of the syntax tree. */
type Node = Readonly<Record<string, unknown>> & { readonly type: string; readonly start: number; readonly end: number }

const isNode = (value: unknown): value is Node =>
  P.isObject(value) && P.isString(value["type"]) && P.isNumber(value["start"]) && P.isNumber(value["end"])
const child = (node: Node, key: string): O.Option<Node> => O.liftPredicate(node[key], isNode)
const children = (node: Node): ReadonlyArray<Node> =>
  A.flatMap(R.toEntries(node), ([key, value]) =>
    key === "parent" ? [] : A.isArray(value) ? A.filter(value, isNode) : isNode(value) ? [value] : []
  )

/** The comparisons that tell one case from another. */
const comparisons = ["===", "!==", "==", "!="]

/** True for `x._tag`, `x?._tag` and `x["_tag"]`, in brackets or not. */
const readsTag = (node: Node): boolean => {
  if (A.contains(["ChainExpression", "ParenthesizedExpression", "TSNonNullExpression"], node.type)) {
    return O.exists(child(node, "expression"), readsTag)
  }
  if (node.type !== "MemberExpression") return false
  return O.exists(child(node, "property"), (property) =>
    node["computed"] === true ? property["value"] === "_tag" : property["name"] === "_tag"
  )
}

/** One place a `_tag` is compared by hand. */
export interface ByHand {
  readonly line: number
  /** "===" and its kin, or "switch". */
  readonly how: string
}

/**
 * Every place `source` compares a `_tag` by hand.
 *
 * @example readTags({ file: "Step.tsx", source: 'if (state._tag === "Idle") stop()' }) // [{ line: 1, how: "===" }]
 */
export const readTags = (input: { readonly file: string; readonly source: string }): ReadonlyArray<ByHand> => {
  const { program } = parseSync(input.file, input.source)
  if (!isNode(program)) return []
  const lineAt = (offset: number): number => Str.split("\n")(Str.slice(0, offset)(input.source)).length
  const found: Array<ByHand> = []
  const walk = (node: Node): void => {
    if (node.type === "BinaryExpression" && A.contains(comparisons, node["operator"])) {
      const sides = A.getSomes([child(node, "left"), child(node, "right")])
      if (A.some(sides, readsTag)) found.push({ line: lineAt(node.start), how: String(node["operator"]) })
    }
    if (node.type === "SwitchStatement" && O.exists(child(node, "discriminant"), readsTag)) {
      found.push({ line: lineAt(node.start), how: "switch" })
    }
    for (const next of children(node)) walk(next)
  }
  walk(program)
  return found
}
