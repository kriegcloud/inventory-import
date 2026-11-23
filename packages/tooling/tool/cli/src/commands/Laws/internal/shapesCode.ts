// What the dual-helper and readonly laws read in a file's tree.
//
// A helper is a function given a name where it is declared (`const f = (a, b) => …`, `function f(a, b) {}`), not one
// handed to a call as an argument, whose order the call sets. One of two values or more that names the value it acts
// on (`cause`, `error`, `self`, `input`) is written `dual`, that value first; a helper written `dual(…)` is a call, so
// it is not read.
//
// A property is a signature of an object type or an interface, an index signature, a class's field, or the properties
// a mapped type makes; an array type inside a property's own type is one too (`readonly rows: Row[]` still lets the
// rows change). One inside `declare global` or `declare module "…"` belongs to a type another library declared, whose
// shape is not ours to make readonly; a `declare namespace` of our own is read.
import * as A from "effect/Array"
import * as O from "effect/Option"
import * as P from "effect/Predicate"
import { children, isNode, type Node } from "./tryCode.ts"

/** The names a helper's parameter takes when it is the value the helper acts on. */
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

/** Whether a function takes two values or more and names one of them as the value it acts on. */
const namesSubject = (fn: Node): boolean => {
  const parameters = nodesIn(fn["params"])
  return (
    parameters.length >= 2 &&
    A.some(parameters, (parameter) => O.exists(parameterName(parameter), (name) => A.contains(subjectNames, name)))
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
 * Where a declared helper of two values or more names the value it acts on and is not `dual`.
 *
 * @example helpersNotDual(program of "const refusal = (method, key, cause) => 1") // [its offset]
 */
export const helpersNotDual = (program: Node): ReadonlyArray<number> =>
  A.flatMap(nodesOf(program), (node) => {
    if (node.type === "FunctionDeclaration" && namesSubject(node)) return [node.start]
    if (node.type === "VariableDeclarator" && isFunction(node["init"]) && namesSubject(node["init"])) {
      return [node.start]
    }
    return []
  })

/** Whether a module declaration augments another's types: `declare global`, or `declare module "…"` named by a string. */
const augments = (node: Node): boolean =>
  node.type === "TSModuleDeclaration" &&
  (node["kind"] === "global" || (isNode(node["id"]) && node["id"].type === "Literal"))

/** A property of any kind: a signature, an index signature, a class's field. */
const isProperty = (node: Node): boolean =>
  node.type === "TSPropertySignature" || node.type === "TSIndexSignature" || node.type === "PropertyDefinition"

/** Whether a mapped type makes its properties readonly (`readonly [K in …]` or `+readonly`). */
const readonlyMapped = (node: Node): boolean => node["readonly"] === true || node["readonly"] === "+"

/** A mutable array type: `T[]` not under `readonly`, or `Array<T>`. */
const mutableArray = (node: Node, parent: O.Option<Node>): boolean =>
  (node.type === "TSArrayType" &&
    !O.exists(parent, (above) => above.type === "TSTypeOperator" && above["operator"] === "readonly")) ||
  (node.type === "TSTypeReference" && isNode(node["typeName"]) && node["typeName"]["name"] === "Array")

/** One node of the walk: its parent, and whether it stands inside a property's own type. */
interface Step {
  readonly node: Node
  readonly parent: O.Option<Node>
  readonly inProperty: boolean
}

/**
 * Where a property is not `readonly`: a signature, an index signature, a class's field, a mapped type's properties,
 * or a mutable array type in a property's own type; outside another library's augmented types.
 *
 * @example mutableProperties(program of "type A = { a: number }") // [its offset]
 */
export const mutableProperties = (program: Node): ReadonlyArray<number> => {
  const found: Array<number> = []
  const left: Array<Step> = [{ node: program, parent: O.none(), inProperty: false }]
  while (A.isArrayNonEmpty(left)) {
    const { inProperty, node, parent } = A.lastNonEmpty(left)
    left.splice(-1, 1)
    if (augments(node)) continue
    if (isProperty(node) && node["readonly"] !== true) found.push(node.start)
    if (node.type === "TSMappedType" && !readonlyMapped(node)) found.push(node.start)
    if (inProperty && mutableArray(node, parent)) found.push(node.start)
    const within = inProperty || isProperty(node)
    for (const next of children(node)) left.push({ node: next, parent: O.some(node), inProperty: within })
  }
  return found
}
