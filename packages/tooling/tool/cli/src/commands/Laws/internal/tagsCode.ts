// The places one file tells a tagged value's case by its `_tag` by hand, or builds one by hand: `x._tag === "Saving"`,
// `x?._tag !== "None"`, a `switch` on `x._tag`, the same through anything the tag flows into (a name it was read into,
// `x._tag ?? ""`, a template, a method of it, what a function that hands it back answers), a tag handed to a call, a
// tag used as a key, and an object literal with a `_tag` key, unless the case has no constructor and this module types
// it. Read from the syntax tree, the parser's plain data, as records of unknown values: a comparison split over lines,
// or written with `==`, is the same node.
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

/**
 * What a name one function (or the file) binds holds: a tag read by hand (`tag` in `const tag = x._tag`), a function
 * that hands a tag back (`tagOf` in `const tagOf = (e) => e._tag`), or neither.
 */
type Held = "tag" | "reader" | "neither"

/** The names one function (or the file) binds, each with what it holds. */
type Scope = Readonly<Record<string, Held>>

/** The names a pattern binds, each holding a tag when it takes a `_tag` out (`{ _tag }`, `{ _tag: kind }`). */
const namesIn = (pattern: Node, held: Held): ReadonlyArray<readonly [string, Held]> => {
  if (pattern.type === "Identifier") return [[nameOf(pattern), held]]
  if (pattern.type === "AssignmentPattern") {
    return O.match(child(pattern, "left"), { onNone: () => [], onSome: (left) => namesIn(left, held) })
  }
  if (pattern.type === "RestElement") {
    return O.match(child(pattern, "argument"), { onNone: () => [], onSome: (rest) => namesIn(rest, "neither") })
  }
  if (pattern.type === "ArrayPattern") return A.flatMap(nodes(pattern["elements"]), (each) => namesIn(each, "neither"))
  if (pattern.type === "ObjectPattern") {
    return A.flatMap(nodes(pattern["properties"]), (property) =>
      property.type === "RestElement"
        ? namesIn(property, "neither")
        : O.match(child(property, "value"), {
            onNone: () => [],
            onSome: (value) => namesIn(value, isTagKey(property, "key") ? "tag" : "neither")
          })
    )
  }
  return O.match(child(pattern, "parameter"), { onNone: () => [], onSome: (inner) => namesIn(inner, held) })
}

/** What the scopes, innermost last, say a name holds. */
const heldBy = (scopes: ReadonlyArray<Scope>, name: string): Held =>
  O.getOrElse(
    O.flatMap(
      A.findLast(scopes, (scope) => R.has(scope, name)),
      (scope) => R.get(scope, name)
    ),
    (): Held => "neither"
  )

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

/**
 * True for a value a tag flows into: `x._tag`, a name it was read into, `x._tag ?? ""`, a choice or a template with
 * it, a method of it (`x._tag.toLowerCase()`), what a function that hands a tag back answers (`kindOf(x)`,
 * `Effect.map(e, (error) => error._tag)`), and what `yield*` or `await` takes out of any of these.
 */
const carriesTag = (value: Node, scopes: ReadonlyArray<Scope>): boolean => {
  const node = unwrapped(value)
  if (isTagRead(node)) return true
  const any = (key: string): boolean => O.exists(child(node, key), (inner) => carriesTag(inner, scopes))
  if (node.type === "Identifier") return heldBy(scopes, nameOf(node)) === "tag"
  if (node.type === "LogicalExpression") return any("left") || any("right")
  if (node.type === "BinaryExpression") return node["operator"] === "+" && (any("left") || any("right"))
  if (node.type === "ConditionalExpression") return any("consequent") || any("alternate")
  // `${x._tag}` alone is the tag; with words around it, it is a sentence that names it (a message, a key).
  if (node.type === "TemplateLiteral") return isBareTemplate(node) && templateHoldsTag(node, scopes)
  if (typeIs(node, "AwaitExpression", "YieldExpression")) return any("argument")
  if (node.type === "SequenceExpression") {
    return O.exists(A.last(nodes(node["expressions"])), (inner) => carriesTag(inner, scopes))
  }
  if (node.type === "MemberExpression") return any("object")
  if (node.type !== "CallExpression") return false
  return O.exists(child(node, "callee"), (called) => {
    const callee = unwrapped(called)
    if (callee.type === "MemberExpression" && O.exists(child(callee, "object"), (on) => carriesTag(on, scopes))) {
      return true
    }
    if (callee.type === "Identifier" && heldBy(scopes, nameOf(callee)) === "reader") return true
    return A.some(nodes(node["arguments"]), (argument) => readsTagOut(argument, scopes))
  })
}

/** True for a template with no words of its own: `${x._tag}`, `${a}${b}`. */
const isBareTemplate = (template: Node): boolean =>
  A.every(nodes(template["quasis"]), (quasi) =>
    O.exists(
      O.flatMap(O.liftPredicate(quasi["value"], P.isObject), (value) => O.liftPredicate(value["raw"], P.isString)),
      (raw) => raw === ""
    )
  )

/** True for a template one of whose parts a tag flows into. */
const templateHoldsTag = (template: Node, scopes: ReadonlyArray<Scope>): boolean =>
  A.some(nodes(template["expressions"]), (inner) => carriesTag(inner, scopes))

/** True for a function that hands a tag back, written in place or named: `(error) => error._tag`, `tagOf`. */
const readsTagOut = (value: Node, scopes: ReadonlyArray<Scope>): boolean => {
  const node = unwrapped(value)
  if (node.type === "Identifier") return heldBy(scopes, nameOf(node)) === "reader"
  return typeIs(node, "ArrowFunctionExpression", "FunctionExpression") && returnsTag(node, scopes)
}

/** True for a function whose answer a tag flows into, read in its own scope over the ones it is written in. */
const returnsTag = (fn: Node, outer: ReadonlyArray<Scope>): boolean => {
  const inner = A.append(outer, scopeOf(fn, outer))
  return O.exists(child(fn, "body"), (body) =>
    body.type === "BlockStatement"
      ? A.some(
          ownNodes(body, (node) => node.type === "ReturnStatement"),
          (returned) => O.exists(child(returned, "argument"), (answer) => carriesTag(answer, inner))
        )
      : carriesTag(body, inner)
  )
}

/** What one declaration binds, read in `scopes` (the outer ones, and what this scope declared before it). */
const declared = (declaration: Node, scopes: ReadonlyArray<Scope>): ReadonlyArray<readonly [string, Held]> => {
  if (declaration.type === "FunctionDeclaration") {
    return O.match(child(declaration, "id"), {
      onNone: () => [],
      onSome: (id) => [[nameOf(id), returnsTag(declaration, scopes) ? "reader" : "neither"] as const]
    })
  }
  return A.flatMap(nodes(declaration["declarations"]), (declarator) =>
    O.match(child(declarator, "id"), {
      onNone: () => [],
      onSome: (id) => {
        const init = child(declarator, "init")
        if (id.type !== "Identifier") return namesIn(id, "neither")
        const held: Held = O.exists(init, (value) => carriesTag(value, scopes))
          ? "tag"
          : O.exists(init, (value) => readsTagOut(value, scopes))
            ? "reader"
            : "neither"
        return namesIn(id, held)
      }
    })
  )
}

/** What a function (or the file's top level, `holder` the program) binds: its parameters and its own declarations. */
const scopeOf = (holder: Node, outer: ReadonlyArray<Scope>): Scope => {
  const params = A.flatMap(nodes(holder["params"]), (param) => namesIn(param, "neither"))
  const body = holder.type === "Program" ? O.some(holder) : child(holder, "body")
  const declarations = O.match(body, {
    onNone: () => [],
    onSome: (inside) => ownNodes(inside, (node) => typeIs(node, "VariableDeclaration", "FunctionDeclaration"))
  })
  // In the order written, each declaration read with what the ones before it bound.
  return A.reduce(declarations, R.fromEntries(params), (scope: Scope, declaration) => ({
    ...scope,
    ...R.fromEntries(declared(declaration, A.append(outer, scope)))
  }))
}

/** The `_tag` a property signature types as a string literal: `"Idle"` in `readonly _tag: "Idle"`. */
const typedTag = (member: Node): ReadonlyArray<string> =>
  member.type === "TSPropertySignature" && isTagKey(member, "key")
    ? O.toArray(
        O.flatMap(child(member, "typeAnnotation"), (annotation) =>
          O.flatMap(child(annotation, "typeAnnotation"), (type) =>
            type.type === "TSLiteralType" ? O.flatMap(child(type, "literal"), stringOf) : O.none()
          )
        )
      )
    : []

/** The cases a type spells out: each object type of a union or an intersection, in brackets or not. */
const casesOf = (type: Node): ReadonlyArray<string> => {
  if (typeIs(type, "TSUnionType", "TSIntersectionType")) return A.flatMap(nodes(type["types"]), casesOf)
  if (type.type === "TSParenthesizedType") {
    return O.match(child(type, "typeAnnotation"), { onNone: () => [], onSome: casesOf })
  }
  return type.type === "TSTypeLiteral" ? A.flatMap(nodes(type["members"]), typedTag) : []
}

/**
 * The cases a file declares as a plain type (`type Step = { _tag: "Idle" } | …`, an interface with a `_tag`), which
 * have no constructor, so the module that declares them builds them by hand. A tagged schema, class, error, union or
 * enum has its own constructor (`.make`, `cases.A.make`, `A(…)`), and is built with it everywhere, the module that
 * declares it included. A `_tag` named inside another type's arguments (`Extract<Opened, { _tag: "Detail" }>`) or in
 * a parameter's type declares nothing: it picks out a case declared elsewhere.
 */
const casesTyped = (program: Node): ReadonlyArray<string> => {
  const found: Array<string> = []
  const visit = (node: Node): void => {
    if (node.type === "TSTypeAliasDeclaration") {
      found.push(...O.match(child(node, "typeAnnotation"), { onNone: () => [], onSome: casesOf }))
    }
    if (node.type === "TSInterfaceDeclaration") {
      found.push(
        ...O.match(child(node, "body"), {
          onNone: () => [],
          onSome: (body) => A.flatMap(nodes(body["body"]), typedTag)
        })
      )
    }
    for (const next of children(node)) visit(next)
  }
  visit(program)
  return found
}

/** The name a call is made by: `join` in `A.join(…)`, `names.join(…)` and `join(…)`. */
const calledAs = (callee: Node): string =>
  callee.type === "MemberExpression" && callee["computed"] !== true
    ? O.getOrElse(O.map(child(callee, "property"), nameOf), () => "")
    : nameOf(callee)

/** A test builds every value with the constructors the code has: a case it types by hand is a stand-in of its own. */
const isTest = (file: string): boolean => /(^|\/)test\//.test(file) || /\.test\.tsx?$/.test(file)

/** One place a `_tag` is told apart or built by hand. */
export interface ByHand {
  readonly line: number
  /**
   * "===" and its kin, "switch", "argument" (handed to a call), "method" (a method called on it), "key" (a record
   * read by it) or "literal" (an object built with a `_tag` key).
   */
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
    const carries = (inner: Node): boolean => carriesTag(inner, here)
    if (node.type === "BinaryExpression" && A.contains(comparisons, node["operator"])) {
      // A side that is a template holding a tag compares by the tag, words or none (`${x._tag}:${n}` === "Idle:1").
      const side = (inner: Node): boolean => {
        const value = unwrapped(inner)
        return carries(value) || (value.type === "TemplateLiteral" && templateHoldsTag(value, here))
      }
      if (A.some(A.getSomes([child(node, "left"), child(node, "right")]), side)) {
        found.push({ line: lineAt(node.start), how: String(node["operator"]) })
      }
    }
    if (node.type === "SwitchStatement" && O.exists(child(node, "discriminant"), carries)) {
      found.push({ line: lineAt(node.start), how: "switch" })
    }
    // Tags joined into words are a sentence that names them (`A.join(A.map(steps, said), ", ")`), as a template with
    // words is.
    const joined = O.exists(O.map(child(node, "callee"), unwrapped), (callee) => calledAs(callee) === "join")
    if (typeIs(node, "CallExpression", "NewExpression") && !joined) {
      // A tag handed over, alone or in a list handed over whole (`expect([status, x._tag]).toEqual(…)`).
      const handed = A.flatMap(nodes(node["arguments"]), (argument) => {
        const value = unwrapped(argument)
        return value.type === "ArrayExpression" ? nodes(value["elements"]) : [argument]
      })
      for (const argument of handed) {
        if (carries(argument)) found.push({ line: lineAt(argument.start), how: "argument" })
      }
      // A method of the tag itself: `x._tag.startsWith("Sav")`.
      const method = O.filter(O.map(child(node, "callee"), unwrapped), (callee) => callee.type === "MemberExpression")
      if (O.exists(method, (callee) => O.exists(child(callee, "object"), carries))) {
        found.push({ line: lineAt(node.start), how: "method" })
      }
    }
    // A record read by the tag: `({ Idle: stop, Saving: wait })[x._tag]`.
    if (node.type === "MemberExpression" && node["computed"] === true && O.exists(child(node, "property"), carries)) {
      found.push({ line: lineAt(node.start), how: "key" })
    }
    if (node.type === "ObjectExpression") {
      for (const property of nodes(node["properties"])) {
        if (property.type !== "Property" || !isTagKey(property, "key")) continue
        // A case the file declares is built where it is declared; any other, and a tag not written out, is built with
        // its own constructor.
        const ownCase = O.exists(O.flatMap(child(property, "value"), stringOf), (tag) => A.contains(ownCases, tag))
        if (!ownCase) found.push({ line: lineAt(property.start), how: "literal" })
      }
    }
    for (const next of children(node)) walk(next, here)
  }
  walk(program, [scopeOf(program, [])])
  return found
}
