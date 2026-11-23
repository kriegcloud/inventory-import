// What the dual-helper and readonly laws read in a file's tree.
//
// A helper is a function of ours given a name where it is declared: `function f(a, b) {}`, `const f = (a, b) => …`
// with no type of its own on `f`, or `const f = Effect.fn("f")(function* (a, b) {…})`. What a library's type sets the
// order of is not read: a function handed to a call, a method or a callback in an object (a call's options, a
// reducer, an interface's method), a class's method, and a `const` typed by a library (`const f: Reducer = …`). The law covers the clear case and no more: a helper of two
// values or more (a TypeScript `this` parameter is not one) that names one `cause`, `error`, `self` or `input` is
// written `dual`, that one first; one written `dual(…)` that names it after another is refused too. Which value a
// helper with none of those names acts on is not in its words, so such a helper is not read.
//
// A property is a signature of an object type or an interface, an index signature, a class's field (`abstract` ones
// included), a constructor's parameter property, or the properties a mapped type makes. An `accessor` field is not
// read: TypeScript allows no `readonly` on one, so there is nothing to write. A mutable
// array type (`T[]`, `Array<T>`, `globalThis.Array<T>`) or a mutable tuple is one too when it stands in a property's
// own type or in a type alias, which a property names (`readonly rows: Rows` with `type Rows = Row[]`). One inside
// `declare global` or `declare module "…"` belongs to a type another library declared, whose shape is not ours to
// make readonly; a `declare namespace` of our own is read.
import * as A from "effect/Array"
import * as O from "effect/Option"
import * as P from "effect/Predicate"
import * as R from "effect/Record"
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

/** A function's values: its parameters, but a TypeScript `this` parameter, which no caller passes. */
const valuesOf = (fn: Node): ReadonlyArray<Node> =>
  A.filter(nodesIn(fn["params"]), (parameter) => !O.exists(parameterName(parameter), (name) => name === "this"))

const isSubject = (parameter: Node): boolean =>
  O.exists(parameterName(parameter), (name) => A.contains(subjectNames, name))

/** Whether a function takes two values or more and names one of them as the value it acts on. */
const namesSubject = (fn: Node): boolean => {
  const values = valuesOf(fn)
  return values.length >= 2 && A.some(values, isSubject)
}

/** Whether a function names the value it acts on after another value. */
const subjectAfterFirst = (fn: Node): boolean => A.some(A.drop(valuesOf(fn), 1), isSubject)

const calleeName = (call: Node): O.Option<string> => {
  const callee = call["callee"]
  if (!isNode(callee)) return O.none()
  if (callee.type === "Identifier" && P.isString(callee["name"])) return O.some(callee["name"])
  if (callee.type === "MemberExpression" && isNode(callee["property"]) && P.isString(callee["property"]["name"])) {
    return O.some(callee["property"]["name"])
  }
  return O.none()
}

/** The function `Effect.fn("f")(function* …)` or `Effect.fnUntraced(function* …)` makes a helper of, when it is one. */
const effectFnBody = (call: Node): O.Option<Node> => {
  const callee = call["callee"]
  // `Effect.fn("f")(function* …)`, `Effect.fn(function* …)` unnamed, or `Effect.fnUntraced(function* …)`.
  const named =
    O.exists(calleeName(call), (name) => name === "fnUntraced" || name === "fn") ||
    (isNode(callee) && callee.type === "CallExpression" && O.exists(calleeName(callee), (name) => name === "fn"))
  return named ? A.findFirst(nodesIn(call["arguments"]), isFunction) : O.none()
}

/** What a value is under `satisfies`, `as` or parentheses. */
const unwrapped = (node: unknown): unknown =>
  isNode(node) &&
  (node.type === "TSSatisfiesExpression" || node.type === "TSAsExpression" || node.type === "ParenthesizedExpression")
    ? unwrapped(node["expression"])
    : node

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
    if (node.type !== "VariableDeclarator") return []
    const init = unwrapped(node["init"])
    // `dual(2, (self, that) => …)`: dual, so it is read only for the order of its values, typed or not (the house
    // style writes a dual's two signatures on the const).
    if (isNode(init) && init.type === "CallExpression" && O.exists(calleeName(init), (name) => name === "dual")) {
      return A.some(A.filter(nodesIn(init["arguments"]), isFunction), subjectAfterFirst) ? [node.start] : []
    }
    // Any other `const` with a type of its own is typed by that type, which sets its order. Without the checker the
    // law cannot tell a type of ours from a library's, so neither is read.
    if (isNode(node["id"]) && isNode(node["id"]["typeAnnotation"])) return []
    if (isFunction(init)) return namesSubject(init) ? [node.start] : []
    if (!isNode(init) || init.type !== "CallExpression") return []
    return O.exists(effectFnBody(init), namesSubject) ? [node.start] : []
  })

/** Whether a module declaration augments another's types: `declare global`, or `declare module "…"` named by a string. */
const augments = (node: Node): boolean =>
  node.type === "TSModuleDeclaration" &&
  (node["kind"] === "global" || (isNode(node["id"]) && node["id"].type === "Literal"))

/** A property of any kind: a signature, an index signature, a class's field of any kind, a parameter property. */
const isProperty = (node: Node): boolean =>
  node.type === "TSPropertySignature" ||
  node.type === "TSIndexSignature" ||
  node.type === "PropertyDefinition" ||
  node.type === "TSAbstractPropertyDefinition" ||
  node.type === "TSParameterProperty"

/** Whether a mapped type makes its properties readonly (`readonly [K in …]` or `+readonly`). */
const readonlyMapped = (node: Node): boolean => node["readonly"] === true || node["readonly"] === "+"

/** Whether a type reference names `Array`, or `globalThis.Array`. */
const namesArray = (node: Node): boolean => {
  const name = node["typeName"]
  if (!isNode(name)) return false
  if (name.type === "Identifier") return name["name"] === "Array"
  return name.type === "TSQualifiedName" && isNode(name["right"]) && name["right"]["name"] === "Array"
}

/** A mutable array or tuple type: `T[]` or `[A, B]` not under `readonly`, `Array<T>` or `globalThis.Array<T>`. */
const mutableArray = (node: Node, parent: O.Option<Node>): boolean =>
  ((node.type === "TSArrayType" || node.type === "TSTupleType") &&
    !O.exists(parent, (above) => above.type === "TSTypeOperator" && above["operator"] === "readonly")) ||
  (node.type === "TSTypeReference" && namesArray(node))

/** One node of the walk: its parent, whether it stands inside a property's own type or a type alias, and whether
 * it stands in a conditional type's test (`[T] extends [never]`), a type-level position where a tuple holds no value. */
interface Step {
  readonly node: Node
  readonly parent: O.Option<Node>
  readonly inProperty: boolean
  readonly inTest: boolean
}

/** A node's children, each with the field of it they stand in. */
const keyedChildren = (node: Node): ReadonlyArray<readonly [string, Node]> =>
  A.flatMap(R.toEntries(node), ([key, value]) =>
    key === "parent"
      ? []
      : A.map(
          A.isArray(value) ? A.filter(value, isNode) : isNode(value) ? [value] : [],
          (child) => [key, child] as const
        )
  )

/**
 * Where a property is not `readonly`: a signature, an index signature, a class's field of any kind, a parameter
 * property, a mapped type's properties, or a mutable array or tuple type in a property's own type or a type alias;
 * outside another library's augmented types.
 *
 * @example mutableProperties(program of "type A = { a: number }") // [its offset]
 */
export const mutableProperties = (program: Node): ReadonlyArray<number> => {
  const found: Array<number> = []
  const left: Array<Step> = [{ node: program, parent: O.none(), inProperty: false, inTest: false }]
  while (A.isArrayNonEmpty(left)) {
    const { inProperty, inTest, node, parent } = A.lastNonEmpty(left)
    left.splice(-1, 1)
    if (augments(node)) continue
    if (isProperty(node) && node["readonly"] !== true) found.push(node.start)
    if (node.type === "TSMappedType" && !readonlyMapped(node)) found.push(node.start)
    if (inProperty && !inTest && mutableArray(node, parent)) found.push(node.start)
    const within = inProperty || isProperty(node) || node.type === "TSTypeAliasDeclaration"
    for (const [key, next] of keyedChildren(node)) {
      const test = inTest || (node.type === "TSConditionalType" && (key === "checkType" || key === "extendsType"))
      left.push({ node: next, parent: O.some(node), inProperty: within, inTest: test })
    }
  }
  return found
}
