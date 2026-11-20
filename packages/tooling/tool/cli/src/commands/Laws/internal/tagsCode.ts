// The places one file tells a tagged value's case by its `_tag` by hand, or builds one by hand: `x._tag === "Saving"`,
// `x?._tag !== "None"`, a `switch` on `x._tag`, the same through a name the tag was read into (`const tag = x._tag`,
// `const { _tag } = x`), a tag handed to a call (`A.contains(["A", "B"], x._tag)`), and an object literal with a `_tag`
// key, unless the case has no constructor and this module types it. Read from the syntax tree, the parser's plain
// data, as records of unknown values: a comparison split over lines, or written with `==`, is the same node.
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
const nodes = (value: unknown): ReadonlyArray<Node> => (A.isArray(value) ? A.filter(value, isNode) : [])
const child = (node: Node, key: string): O.Option<Node> => O.liftPredicate(node[key], isNode)
const nameOf = (node: Node): string => O.getOrElse(O.liftPredicate(node["name"], P.isString), () => "")
const typeIs = (node: Node, ...types: ReadonlyArray<string>): boolean => A.contains(types, node.type)
const children = (node: Node): ReadonlyArray<Node> =>
  A.flatMap(R.toEntries(node), ([key, value]) =>
    key === "parent" ? [] : A.isArray(value) ? A.filter(value, isNode) : isNode(value) ? [value] : []
  )

const functions = ["FunctionDeclaration", "FunctionExpression", "ArrowFunctionExpression"] as const
const isFunction = (node: Node): boolean => typeIs(node, ...functions)

/** The comparisons that tell one case from another. */
const comparisons = ["===", "!==", "==", "!="]

/** The string a literal holds, if it holds one. */
const stringOf = (node: Node): O.Option<string> =>
  node.type === "Literal" ? O.liftPredicate(node["value"], P.isString) : O.none()

/** The name a property or a member is written with: `_tag` in `x._tag`, `x["_tag"]`, `{ _tag: "A" }`, `{ "_tag": "A" }`. */
const keyOf = (holder: Node, key: string): O.Option<string> =>
  O.flatMap(child(holder, key), (written) =>
    holder["computed"] === true
      ? stringOf(written)
      : written.type === "Identifier"
        ? O.some(nameOf(written))
        : stringOf(written)
  )

const isTagKey = (holder: Node, key: string): boolean => O.exists(keyOf(holder, key), (name) => name === "_tag")

/** The value under the wrappers that do not change it: brackets, `?.`, a non-null mark, a type assertion. */
const unwrapped = (node: Node): Node =>
  typeIs(
    node,
    "ChainExpression",
    "ParenthesizedExpression",
    "TSNonNullExpression",
    "TSAsExpression",
    "TSSatisfiesExpression",
    "TSTypeAssertion"
  )
    ? O.match(child(node, "expression"), { onNone: () => node, onSome: unwrapped })
    : node

/** True for `x._tag`, `x?._tag` and `x["_tag"]`, in brackets or not. */
const isTagRead = (value: Node): boolean => {
  const node = unwrapped(value)
  return node.type === "MemberExpression" && isTagKey(node, "property")
}

/** Which names one function (or the file) binds hold a tag read by hand: true for `tag` in `const tag = x._tag`. */
type Scope = Readonly<Record<string, boolean>>

/** The names a pattern binds, each with whether it takes a `_tag` out (`{ _tag }`, `{ _tag: kind }`). */
const namesIn = (pattern: Node, holdsTag: boolean): ReadonlyArray<readonly [string, boolean]> => {
  if (pattern.type === "Identifier") return [[nameOf(pattern), holdsTag]]
  if (pattern.type === "AssignmentPattern") {
    return O.match(child(pattern, "left"), { onNone: () => [], onSome: (left) => namesIn(left, holdsTag) })
  }
  if (pattern.type === "RestElement") {
    return O.match(child(pattern, "argument"), { onNone: () => [], onSome: (rest) => namesIn(rest, false) })
  }
  if (pattern.type === "ArrayPattern") return A.flatMap(nodes(pattern["elements"]), (each) => namesIn(each, false))
  if (pattern.type === "ObjectPattern") {
    return A.flatMap(nodes(pattern["properties"]), (property) =>
      property.type === "RestElement"
        ? namesIn(property, false)
        : O.match(child(property, "value"), {
            onNone: () => [],
            onSome: (value) => namesIn(value, isTagKey(property, "key"))
          })
    )
  }
  return O.match(child(pattern, "parameter"), { onNone: () => [], onSome: (inner) => namesIn(inner, holdsTag) })
}

/** True for a name the scopes, innermost last, bind to a tag read by hand. */
const holdsTag = (scopes: ReadonlyArray<Scope>, name: string): boolean =>
  O.exists(
    A.findLast(scopes, (scope) => R.has(scope, name)),
    (scope) => R.get(scope, name).pipe(O.getOrElse(() => false))
  )

/** True for a tag read by hand: `x._tag`, or a name it was read into. */
const readsTag = (value: Node, scopes: ReadonlyArray<Scope>): boolean => {
  const node = unwrapped(value)
  return isTagRead(node) || (node.type === "Identifier" && holdsTag(scopes, nameOf(node)))
}

/** Every node under `body`, not looking inside the functions written in it, that `keep` holds. */
const ownNodes = (body: Node, keep: (node: Node) => boolean): ReadonlyArray<Node> => {
  const found: Array<Node> = []
  const visit = (node: Node): void => {
    if (keep(node)) found.push(node)
    if (isFunction(node)) return
    for (const next of children(node)) visit(next)
  }
  for (const next of children(body)) visit(next)
  return found
}

/** What a declaration binds: `const tag = x._tag` and `const { _tag } = x` hold a tag, any other name does not. */
const declared = (declaration: Node, outer: ReadonlyArray<Scope>): ReadonlyArray<readonly [string, boolean]> => {
  if (declaration.type === "FunctionDeclaration") {
    return O.match(child(declaration, "id"), { onNone: () => [], onSome: (id) => [[nameOf(id), false] as const] })
  }
  return A.flatMap(nodes(declaration["declarations"]), (declarator) =>
    O.match(child(declarator, "id"), {
      onNone: () => [],
      onSome: (id) =>
        namesIn(id, id.type === "Identifier" && O.exists(child(declarator, "init"), (init) => readsTag(init, outer)))
    })
  )
}

/** What a function (or the file's top level, `body` the program) binds: its parameters and its own declarations. */
const scopeOf = (holder: Node, outer: ReadonlyArray<Scope>): Scope => {
  const params = A.flatMap(nodes(holder["params"]), (param) => namesIn(param, false))
  const body = holder.type === "Program" ? O.some(holder) : child(holder, "body")
  const own = O.match(body, {
    onNone: () => [],
    onSome: (inside) =>
      A.flatMap(
        ownNodes(inside, (node) => typeIs(node, "VariableDeclaration", "FunctionDeclaration")),
        (declaration) => declared(declaration, outer)
      )
  })
  return R.fromEntries([...params, ...own])
}

/**
 * The cases a file declares as a plain type (`type Step = { _tag: "Idle" } | …`), which have no constructor, so the
 * module that declares them builds them by hand. A tagged schema, class, error, union or enum has its own constructor
 * (`.make`, `cases.A.make`, `A(…)`), and is built with it everywhere, the module that declares it included.
 */
const casesTyped = (program: Node): ReadonlyArray<string> => {
  const found: Array<string> = []
  const visit = (node: Node): void => {
    if (node.type === "TSPropertySignature" && isTagKey(node, "key")) {
      const literal = O.flatMap(child(node, "typeAnnotation"), (annotation) =>
        O.flatMap(child(annotation, "typeAnnotation"), (type) =>
          type.type === "TSLiteralType" ? O.flatMap(child(type, "literal"), stringOf) : O.none()
        )
      )
      found.push(...O.toArray(literal))
    }
    for (const next of children(node)) visit(next)
  }
  visit(program)
  return found
}

/** A test builds every value with the constructors the code has: a case it types by hand is a stand-in of its own. */
const isTest = (file: string): boolean => /(^|\/)test\//.test(file) || /\.test\.tsx?$/.test(file)

/** One place a `_tag` is told apart or built by hand. */
export interface ByHand {
  readonly line: number
  /** "===" and its kin, "switch", "argument" (handed to a call) or "literal" (an object built with a `_tag` key). */
  readonly how: string
}

/**
 * Every place `source` tells a `_tag` apart or builds one by hand.
 *
 * @example readTags({ file: "Step.tsx", source: 'if (state._tag === "Idle") stop()' }) // [{ line: 1, how: "===" }]
 */
export const readTags = (input: { readonly file: string; readonly source: string }): ReadonlyArray<ByHand> => {
  const { program } = parseSync(input.file, input.source)
  if (!isNode(program)) return []
  const lineAt = (offset: number): number => Str.split("\n")(Str.slice(0, offset)(input.source)).length
  const ownCases = isTest(input.file) ? [] : casesTyped(program)
  const found: Array<ByHand> = []
  const walk = (node: Node, scopes: ReadonlyArray<Scope>): void => {
    const here = isFunction(node) ? A.append(scopes, scopeOf(node, scopes)) : scopes
    if (node.type === "BinaryExpression" && A.contains(comparisons, node["operator"])) {
      const sides = A.getSomes([child(node, "left"), child(node, "right")])
      if (A.some(sides, (side) => readsTag(side, here))) {
        found.push({ line: lineAt(node.start), how: String(node["operator"]) })
      }
    }
    if (node.type === "SwitchStatement" && O.exists(child(node, "discriminant"), (on) => readsTag(on, here))) {
      found.push({ line: lineAt(node.start), how: "switch" })
    }
    if (typeIs(node, "CallExpression", "NewExpression")) {
      // A tag handed over, alone or in a list handed over whole (`expect([status, x._tag]).toEqual(…)`).
      const handed = A.flatMap(nodes(node["arguments"]), (argument) => {
        const value = unwrapped(argument)
        return value.type === "ArrayExpression" ? nodes(value["elements"]) : [argument]
      })
      for (const argument of handed) {
        if (readsTag(argument, here)) found.push({ line: lineAt(argument.start), how: "argument" })
      }
    }
    if (node.type === "ObjectExpression") {
      for (const property of nodes(node["properties"])) {
        if (property.type !== "Property" || !isTagKey(property, "key")) continue
        // A case the file declares is built where it is declared; any other is built with its own constructor.
        const ownCase = O.match(O.flatMap(child(property, "value"), stringOf), {
          onNone: () => A.isReadonlyArrayNonEmpty(ownCases),
          onSome: (tag) => A.contains(ownCases, tag)
        })
        if (!ownCase) found.push({ line: lineAt(property.start), how: "literal" })
      }
    }
    for (const next of children(node)) walk(next, here)
  }
  walk(program, [scopeOf(program, [])])
  return found
}
