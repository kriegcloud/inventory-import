// The places one file settles absence, a starting value or a clean-up in its own code, read from its syntax tree and
// from nothing else: no types, no flow, no judgement of what the code means. Four things are found, each by how it is
// written: a fallback (`??`, `??=`, `||` and `||=` before a value written out, `getOrElse`, and outside a `.tsx` file a
// parameter or a destructured name given a default: in a `.tsx` file that is where a component's optional prop takes
// its default, Benjamin's decision of 2026-11-23, and the reader cannot tell a component from another function),
// a comparison with `null` or `undefined`, a test if/ternary guarded by Option/Result/Exit, and in contract/model/host
// an onNone arrow returning a number, empty string/array/object, null or undefined, or an unwrapped optionalKey;
// Result.getOrThrow and Effect.runSync calls (direct or piped) in src outside tests; an Option turned back into a missing
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
// `option.valueOrUndefined` is `O.getOrUndefined(option)` read as a property.
const unwraps = ["getOrUndefined", "getOrNull", "valueOrUndefined"]
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
  ...cleanUps,
  "Option/Result/Exit guard in a test if or ternary",
  "onNone number/empty string/empty array/empty object/null/undefined arrow in contract/model/host",
  "Result.getOrThrow/O.getOrThrow/Effect.runSync calls in src, outside tests",
  "unwrapped S.optionalKey in contract/model/host"
]

// These additions deliberately stay syntactic: a branch in a test may skip its assertions; only a literal
// onNone data literal is an invented value. A schema wrapper must consume this optionalKey, never a neighbouring field.
const memberName = (node: Node): O.Option<string> =>
  node.type === "MemberExpression" && node["computed"] !== true
    ? O.flatMap(child(node, "property"), (property) => text(property, "name"))
    : O.none()
const memberOf = (node: Node, module: string, name: string): boolean =>
  O.exists(memberName(node), (own) => own === name) &&
  O.exists(child(node, "object"), (object) => named(object, module))
const argumentsOf = (node: Node): ReadonlyArray<Node> =>
  A.isArray(node["arguments"]) ? A.filter(node["arguments"], isNode) : []
const called = (node: Node): Node => O.getOrElse(child(bare(node), "callee"), () => bare(node))
const propertyIs = (node: Node, name: string): boolean =>
  O.exists(
    child(node, "key"),
    (key) => named(key, name) || (key.type === "Literal" && O.exists(text(key, "value"), (value) => value === name))
  )
const decodingWrapper = (node: Node): boolean => {
  const callee = called(node)
  if (named(callee, "absentAsNone") || named(callee, "emptyWhenLeftOut")) return true
  if (O.exists(child(callee, "object"), (object) => named(object, "S"))) {
    if (
      O.exists(
        memberName(callee),
        (name) => Str.startsWith("OptionFrom")(name) || Str.startsWith("withDecodingDefault")(name)
      )
    )
      return true
    // A custom decoding default, used by storedFlag: constructor defaults alone do not settle decoded absence.
    if (memberOf(callee, "S", "decodeTo"))
      return A.some(
        argumentsOf(node),
        (argument) =>
          argument.type === "ObjectExpression" &&
          A.some(
            children(argument),
            (property) =>
              propertyIs(property, "decode") &&
              O.exists(child(property, "value"), (value) => memberOf(called(value), "SchemaGetter", "withDefault"))
          )
      )
  }
  return false
}
const optionalIsWrapped = (node: Node, ancestors: ReadonlyArray<Node>): boolean => {
  let current = node
  for (const parent of A.reverse(ancestors)) {
    if (A.contains(wrappers, parent.type)) {
      current = parent
      continue
    }
    if (parent.type === "MemberExpression" && parent["object"] === current) {
      current = parent
      continue
    }
    if (parent.type !== "CallExpression") return false
    if (parent["callee"] === current) {
      if (O.exists(memberName(current), (name) => name === "pipe") && A.some(argumentsOf(parent), decodingWrapper))
        return true
      current = parent
      continue
    }
    const args = argumentsOf(parent)
    const index = A.findFirstIndex(args, (argument) => argument === current)
    if (O.isNone(index)) return false
    const callee = called(parent)
    const piping = O.exists(memberName(callee), (name) => name === "pipe") || named(callee, "pipe")
    if (piping && A.some(A.drop(args, index.value + 1), decodingWrapper)) return true
    if (!piping && decodingWrapper(parent)) return true
    if (!piping) return false
    current = parent
  }
  return false
}
const literalFallback = (node: Node): boolean => {
  const value = bare(node)
  return (
    (value.type === "Literal" && (P.isNumber(value["value"]) || value["value"] === "" || value["value"] === null)) ||
    named(value, "undefined") ||
    (value.type === "ArrayExpression" && A.isArray(value["elements"]) && A.isArrayEmpty(value["elements"])) ||
    (value.type === "ObjectExpression" && A.isArray(value["properties"]) && A.isArrayEmpty(value["properties"])) ||
    (value.type === "UnaryExpression" &&
      O.exists(text(value, "operator"), (operator) => operator === "-" || operator === "+") &&
      O.exists(child(value, "argument"), (argument) => argument.type === "Literal" && P.isNumber(argument["value"])))
  )
}
const testGuard = (node: Node, ancestors: ReadonlyArray<Node>): boolean => {
  if (node.type !== "CallExpression") return false
  const callee = called(node)
  const guard =
    memberOf(callee, "O", "isSome") ||
    memberOf(callee, "O", "isNone") ||
    A.some(
      ["Exit", "Result"],
      (module) => memberOf(callee, module, "isSuccess") || memberOf(callee, module, "isFailure")
    )
  if (!guard) return false
  let current = node
  for (const parent of A.reverse(ancestors)) {
    if ((parent.type === "IfStatement" || parent.type === "ConditionalExpression") && parent["test"] === current)
      return true
    if (!A.contains([...wrappers, "UnaryExpression", "LogicalExpression", "BinaryExpression"], parent.type))
      return false
    current = parent
  }
  return false
}

// A component's first parameter owns its props, including reads captured by callbacks. A callback
// parameter or local declaration that binds the same name cuts off that outer prop's scope.
const bindingHas = (node: Node, name: string): boolean => {
  if (named(node, name)) return true
  if (node.type === "AssignmentPattern") return O.exists(child(node, "left"), (left) => bindingHas(left, name))
  if (node.type === "Property") return O.exists(child(node, "value"), (value) => bindingHas(value, name))
  if (node.type === "ObjectPattern" || node.type === "ArrayPattern" || node.type === "RestElement")
    return A.some(children(node), (child) => bindingHas(child, name))
  return false
}
const functions = ["ArrowFunctionExpression", "FunctionExpression", "FunctionDeclaration"]
// A function draws when its own body holds JSX. JSX inside a function it makes is that function's: a factory that
// returns a renderer is no component.
const drawsJsx = (node: Node): boolean =>
  node.type === "JSXElement" ||
  node.type === "JSXFragment" ||
  A.some(children(node), (inner) => !A.contains(functions, inner.type) && drawsJsx(inner))
const declares = (statement: Node, name: string): boolean =>
  statement.type === "VariableDeclaration" &&
  A.some(children(statement), (declaration) =>
    O.exists(child(declaration, "id"), (binding) => bindingHas(binding, name))
  )
// A name a `catch` or a loop binds is that clause's own, as a block's declaration is.
const rebinds = (scope: Node, name: string): boolean =>
  (scope.type === "BlockStatement" && A.some(children(scope), (statement) => declares(statement, name))) ||
  (scope.type === "CatchClause" && O.exists(child(scope, "param"), (param) => bindingHas(param, name))) ||
  (scope.type === "ForStatement" && O.exists(child(scope, "init"), (init) => declares(init, name))) ||
  ((scope.type === "ForInStatement" || scope.type === "ForOfStatement") &&
    O.exists(child(scope, "left"), (left) => declares(left, name)))
// `props.title` and `props["aria-label"]` read a prop; `props[key]` reads whatever `key` holds.
const propRead = (value: Node): boolean =>
  value.type === "MemberExpression" &&
  (value["computed"] !== true ||
    O.exists(child(value, "property"), (key) => key.type === "Literal" && P.isString(key["value"])))
const ownProp = (value: Node, ancestors: ReadonlyArray<Node>): boolean => {
  const reference = propRead(value) ? child(value, "object") : O.some(value)
  const localName = O.flatMap(reference, (node) => (node.type === "Identifier" ? text(node, "name") : O.none()))
  if (O.isNone(localName)) return false
  const name = localName.value
  for (const { index, node: scope } of A.reverse(A.map(ancestors, (node, index) => ({ index, node })))) {
    if (rebinds(scope, name)) return false
    if (!A.contains(functions, scope.type)) continue
    const params = scope["params"]
    if (!A.isArray(params)) continue
    const bindings = A.filter(params, isNode)
    if (!A.some(bindings, (binding) => bindingHas(binding, name))) continue
    const owner = ancestors[index - 1]
    const component = O.orElse(child(scope, "id"), () =>
      isNode(owner) && owner.type === "VariableDeclarator" ? child(owner, "id") : O.none()
    )
    if (!O.exists(component, (node) => O.exists(text(node, "name"), (name) => /^[A-Z]/.test(name))) || !drawsJsx(scope))
      return false
    return O.exists(
      A.head(bindings),
      (param) =>
        bindingHas(param, name) && (param.type === "Identifier" ? propRead(value) : value.type === "Identifier")
    )
  }
  return false
}

const kindOf = (
  node: Node,
  screen: boolean,
  test: boolean,
  business: boolean,
  src: boolean,
  ancestors: ReadonlyArray<Node>
): O.Option<DefaultsKind> => {
  if (src && !test && node.type === "CallExpression") {
    const callee = O.map(child(node, "callee"), bare)
    if (
      O.exists(
        callee,
        (one) =>
          memberOf(one, "Result", "getOrThrow") ||
          memberOf(one, "O", "getOrThrow") ||
          memberOf(one, "Effect", "runSync")
      )
    )
      return O.some("fallback")
  }
  if (
    src &&
    !test &&
    (memberOf(node, "Result", "getOrThrow") || memberOf(node, "O", "getOrThrow") || memberOf(node, "Effect", "runSync"))
  ) {
    const parent = A.last(ancestors)
    if (
      O.exists(
        parent,
        (one) =>
          one.type === "CallExpression" &&
          (named(called(one), "pipe") || O.exists(memberName(called(one)), (name) => name === "pipe")) &&
          A.some(argumentsOf(one), (argument, index) => argument === node && (!named(called(one), "pipe") || index > 0))
      )
    )
      return O.some("fallback")
  }
  if (test && testGuard(node, ancestors)) return O.some("absence")
  if (
    business &&
    node.type === "Property" &&
    node["computed"] !== true &&
    propertyIs(node, "onNone") &&
    O.exists(
      child(node, "value"),
      (value) =>
        value.type === "ArrowFunctionExpression" &&
        value["async"] !== true &&
        A.isArray(value["params"]) &&
        A.isArrayEmpty(value["params"]) &&
        O.exists(child(value, "body"), literalFallback)
    )
  )
    return O.some("fallback")
  if (business && memberOf(node, "S", "optionalKey") && !optionalIsWrapped(node, ancestors)) return O.some("absence")

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
        if (
          screen &&
          (is("===") || is("!==")) &&
          ((named(one, "undefined") && ownProp(other, ancestors)) ||
            (named(other, "undefined") && ownProp(one, ancestors)))
        )
          return O.none()
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
  const test = /(?:^|\/)(?:test|tests)\//.test(input.file) || /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(input.file)
  const src = /(?:^|\/)src\//.test(input.file)
  const business = /^packages\/[^/]+\/(?:contract|model|host)\//.test(input.file)
  const found: Array<DefaultsPlace> = []
  // The walk keeps its own list, so no file nests it past the stack.
  const pending: Array<{ readonly node: Node; readonly ancestors: ReadonlyArray<Node> }> = [
    { node: parsed.program, ancestors: [] }
  ]
  while (A.isArrayNonEmpty(pending)) {
    const entry = pending.pop()
    if (entry === undefined) continue
    const { node, ancestors } = entry
    const kind = kindOf(node, screen, test, business, src, ancestors)
    if (O.isSome(kind)) {
      found.push({ kind: kind.value, line: lineOf(node.start), code: Str.slice(node.start, node.end)(input.source) })
    }
    for (const next of A.reverse(children(node))) pending.push({ node: next, ancestors: [...ancestors, node] })
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
