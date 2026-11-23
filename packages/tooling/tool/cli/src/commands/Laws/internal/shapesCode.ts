// What the dual-helper and readonly laws read in a file's tree. A helper is a function given a name where it is
// declared (`const f = (a, b) => …`, `function f(a, b) {}`), not one handed to a call as an argument, whose order the
// call sets. A property is one signature of an object type or an interface; one inside `declare global` or
// `declare module "…"` belongs to a type another library declared, whose shape is not ours to make readonly.
import * as A from "effect/Array"
import * as O from "effect/Option"
import * as P from "effect/Predicate"
import { children, isNode, type Node } from "./tryCode.ts"

/** The names a helper's last parameter takes when it is the value the helper acts on. */
export const subjectNames: ReadonlyArray<string> = ["cause", "error", "self", "input"]

const nodesIn = (value: unknown): ReadonlyArray<Node> => (A.isArray(value) ? A.filter(value, isNode) : [])

/** A parameter's name: a plain one, or one with a default. */
const parameterName = (parameter: Node): O.Option<string> => {
  const named = parameter.type === "AssignmentPattern" ? parameter["left"] : parameter
  return isNode(named) && named.type === "Identifier" && P.isString(named["name"]) ? O.some(named["name"]) : O.none()
}

const isFunction = (node: unknown): node is Node =>
  isNode(node) &&
  (node.type === "ArrowFunctionExpression" || node.type === "FunctionExpression" || node.type === "FunctionDeclaration")

/** Whether a function takes two values or more, the last of them named as the value it acts on. */
const subjectLast = (fn: Node): boolean => {
  const parameters = nodesIn(fn["params"])
  return (
    parameters.length >= 2 &&
    O.exists(O.flatMap(A.last(parameters), parameterName), (name) => A.contains(subjectNames, name))
  )
}

/** Every node of a tree once, from a list of its own rather than the stack. */
const nodesOf = (program: Node): ReadonlyArray<Node> => {
  const all: Array<Node> = []
  const left: Array<Node> = [program]
  while (A.isArrayNonEmpty(left)) {
    const node = A.lastNonEmpty(left)
    left.splice(-1, 1)
    all.push(node)
    for (const next of children(node)) left.push(next)
  }
  return all
}

/**
 * Where a declared helper takes the value it acts on last: such a helper is written `dual`, that value first.
 *
 * @example helpersSubjectLast(program of "const refusal = (method, key, cause) => 1") // [its offset]
 */
export const helpersSubjectLast = (program: Node): ReadonlyArray<number> =>
  A.flatMap(nodesOf(program), (node) => {
    if (node.type === "FunctionDeclaration" && subjectLast(node)) return [node.start]
    if (node.type === "VariableDeclarator" && isFunction(node["init"]) && subjectLast(node["init"])) return [node.start]
    return []
  })

/** Whether a module declaration augments another's types: `declare global`, or `declare module "…"`. */
const augments = (node: Node): boolean =>
  node.type === "TSModuleDeclaration" && (node["declare"] === true || node["kind"] === "global")

/**
 * Where a property of an object type or an interface is not `readonly`, outside another library's augmented types.
 *
 * @example mutableProperties(program of "type A = { a: number }") // [its offset]
 */
export const mutableProperties = (program: Node): ReadonlyArray<number> => {
  const found: Array<number> = []
  const left: Array<Node> = [program]
  while (A.isArrayNonEmpty(left)) {
    const node = A.lastNonEmpty(left)
    left.splice(-1, 1)
    if (augments(node)) continue
    if (node.type === "TSPropertySignature" && node["readonly"] !== true) found.push(node.start)
    for (const next of children(node)) left.push(next)
  }
  return found
}
