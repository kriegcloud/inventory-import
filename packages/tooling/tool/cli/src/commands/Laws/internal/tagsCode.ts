// The places one file tells a tagged value's case by its `_tag` by hand, or builds one by hand: `x._tag === "Saving"`,
// `x?._tag !== "None"`, a `switch` on `x._tag`, the same through anything the tag flows into (a name it was read or
// assigned into, a list or a record it was put in and read back out of, `x._tag ?? ""`, a template, a method of it,
// what a function that hands it back answers, a method of a record included), a tag handed to a call, a tag used as a
// key, a sentence that names a tag compared or handed to an expectation, and an object literal with a `_tag` key,
// unless the case has no constructor and this module types it. Read from the syntax tree, the parser's plain data, as
// records of unknown values: a comparison split over lines, or written with `==`, is the same node.
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

/** The string or the whole number a literal holds, as a key: `"k"` in `o["k"]`, `"0"` in `list[0]`. */
const literalKey = (node: Node): O.Option<string> =>
  node.type === "Literal" && P.isNumber(node["value"]) && Number.isInteger(node["value"])
    ? O.some(`${node["value"]}`)
    : stringOf(node)

/** The name a property or a member is written with: `_tag` in `x._tag`, `x["_tag"]`, `{ _tag: "A" }`, `{ "_tag": "A" }`. */
const keyOf = (holder: Node, key: string): O.Option<string> =>
  O.flatMap(child(holder, key), (written) =>
    holder["computed"] === true
      ? literalKey(written)
      : written.type === "Identifier"
        ? O.some(nameOf(written))
        : literalKey(written)
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

/** A list or a record written in place, each of its places with what it holds (a list's by position: "0", "1"). */
interface Fields {
  readonly fields: Readonly<Record<string, Held>>
}

/**
 * What a name one function (or the file) binds holds: a tag read by hand (`tag` in `const tag = x._tag`), a function
 * that hands a tag back (`tagOf` in `const tagOf = (e) => e._tag`), a sentence that names a tag (a template with words,
 * tags joined), a list or a record of these (`const o = { k: x._tag }`, `const t = [x._tag]`), or none of them.
 */
type Held = "tag" | "reader" | "sentence" | "neither" | Fields

const isFields = (held: Held): held is Fields => P.isObject(held)
const fieldOf = (held: Held, key: string): Held =>
  isFields(held) ? O.getOrElse(R.get(held.fields, key), (): Held => "neither") : "neither"
/** True for a tag, or a list or a record with one somewhere in it. */
const holdsTag = (held: Held): boolean => held === "tag" || (isFields(held) && A.some(R.values(held.fields), holdsTag))

/** The names one function (or the file) binds, each with what it holds. */
type Scope = Readonly<Record<string, Held>>

/**
 * The names a pattern binds out of a value that holds `held`: a `_tag` taken out (`{ _tag }`, `{ _tag: kind }`) is a
 * tag; a place taken out of a list or a record (`const [t] = [x._tag]`, `const { k } = { k: x._tag }`) holds what
 * that place holds; anything taken out of a list of tags is a tag.
 */
const namesIn = (pattern: Node, held: Held): ReadonlyArray<readonly [string, Held]> => {
  if (pattern.type === "Identifier") return [[nameOf(pattern), held]]
  if (pattern.type === "AssignmentPattern") {
    return O.match(child(pattern, "left"), { onNone: () => [], onSome: (left) => namesIn(left, held) })
  }
  if (pattern.type === "RestElement") {
    return O.match(child(pattern, "argument"), { onNone: () => [], onSome: (rest) => namesIn(rest, "neither") })
  }
  if (pattern.type === "ArrayPattern") {
    // By position, holes counted: `const [, t] = [n, x._tag]` takes the second.
    const elements: ReadonlyArray<unknown> = A.isArray(pattern["elements"]) ? pattern["elements"] : []
    return A.flatMap(elements, (each, index) =>
      isNode(each) ? namesIn(each, held === "tag" ? "tag" : fieldOf(held, `${index}`)) : []
    )
  }
  if (pattern.type === "ObjectPattern") {
    return A.flatMap(nodes(pattern["properties"]), (property) =>
      property.type === "RestElement"
        ? namesIn(property, "neither")
        : O.match(child(property, "value"), {
            onNone: () => [],
            onSome: (value) =>
              namesIn(
                value,
                isTagKey(property, "key")
                  ? "tag"
                  : O.match(keyOf(property, "key"), {
                      onNone: (): Held => "neither",
                      onSome: (key) => fieldOf(held, key)
                    })
              )
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

/** What a member read out of a list or a record holds: `o.k`, `o["k"]`, `t[0]`. */
const memberHeld = (member: Node, scopes: ReadonlyArray<Scope>): Held =>
  O.match(keyOf(member, "property"), {
    onNone: (): Held => "neither",
    onSome: (key) =>
      O.match(child(member, "object"), {
        onNone: (): Held => "neither",
        onSome: (object) => fieldOf(heldOf(object, scopes), key)
      })
  })

/**
 * True for a value a tag flows into: `x._tag`, a name it was read into, a place of a list or a record it was put in,
 * `x._tag ?? ""`, a choice or a template with it, a method of it (`x._tag.toLowerCase()`), what a function that hands
 * a tag back answers (`kindOf(x)`, `k.of(x)`, `Effect.map(e, (error) => error._tag)`), and what `yield*` or `await`
 * takes out of any of these.
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
  if (node.type === "MemberExpression") return any("object") || memberHeld(node, scopes) === "tag"
  if (node.type !== "CallExpression") return false
  return O.exists(child(node, "callee"), (called) => {
    const callee = unwrapped(called)
    if (callee.type === "MemberExpression" && O.exists(child(callee, "object"), (on) => carriesTag(on, scopes))) {
      return true
    }
    if (readsTagOut(callee, scopes)) return true
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

/** The name a call is made by: `join` in `A.join(…)`, `names.join(…)` and `join(…)`. */
const calledAs = (callee: Node): string =>
  callee.type === "MemberExpression" && callee["computed"] !== true
    ? O.getOrElse(O.map(child(callee, "property"), nameOf), () => "")
    : nameOf(callee)

/** True for a call that joins a list into words: `A.join(list, ", ")`, `list.join(", ")`. */
const isJoin = (node: Node): boolean =>
  typeIs(node, "CallExpression", "NewExpression") &&
  O.exists(O.map(child(node, "callee"), unwrapped), (callee) => calledAs(callee) === "join")

/**
 * True for a sentence that names a tag: a template with words around one (`${x._tag}:1`), tags joined into words
 * (`A.join([x._tag], "")`, `[x._tag].join("")`, `A.join(A.map(xs, (e) => e._tag), ",")`), a name one was put in, and
 * a choice of these. Handed on (a message, a key) it passes; compared, or handed to an expectation, it tells a case.
 */
const namesTag = (value: Node, scopes: ReadonlyArray<Scope>): boolean => {
  const node = unwrapped(value)
  if (node.type === "TemplateLiteral") return templateHoldsTag(node, scopes)
  if (node.type === "Identifier") return heldBy(scopes, nameOf(node)) === "sentence"
  if (node.type === "MemberExpression") return memberHeld(node, scopes) === "sentence"
  const any = (key: string): boolean => O.exists(child(node, key), (inner) => namesTag(inner, scopes))
  if (node.type === "LogicalExpression") return any("left") || any("right")
  if (node.type === "ConditionalExpression") return any("consequent") || any("alternate")
  if (node.type === "BinaryExpression") return node["operator"] === "+" && (any("left") || any("right"))
  if (!isJoin(node)) return false
  // The list joined: what the method is called on (`list.join(…)`), or the first argument (`A.join(list, …)`).
  const listed = A.appendAll(
    O.toArray(
      O.flatMap(
        O.filter(O.map(child(node, "callee"), unwrapped), (callee) => callee.type === "MemberExpression"),
        (callee) => child(callee, "object")
      )
    ),
    A.take(nodes(node["arguments"]), 1)
  )
  return A.some(listed, (list) => holdsTag(heldOf(list, scopes)))
}

/** True for a function that hands a tag back, written in place or named: `(error) => error._tag`, `tagOf`, `k.of`. */
const readsTagOut = (value: Node, scopes: ReadonlyArray<Scope>): boolean => {
  const node = unwrapped(value)
  if (node.type === "Identifier") return heldBy(scopes, nameOf(node)) === "reader"
  if (node.type === "MemberExpression") return memberHeld(node, scopes) === "reader"
  return typeIs(node, "ArrowFunctionExpression", "FunctionExpression") && returnsTag(node, scopes)
}

/** What one place of a list or a record holds, as written: `x._tag`, a function that hands one back, a sentence. */
const heldOf = (value: Node, scopes: ReadonlyArray<Scope>): Held => {
  const node = unwrapped(value)
  if (carriesTag(node, scopes)) return "tag"
  if (readsTagOut(node, scopes)) return "reader"
  if (namesTag(node, scopes)) return "sentence"
  if (node.type === "Identifier") return heldBy(scopes, nameOf(node))
  if (node.type === "MemberExpression") return memberHeld(node, scopes)
  if (node.type === "ArrayExpression") {
    // By position, up to the first spread: after it no place is known.
    const elements: ReadonlyArray<unknown> = A.isArray(node["elements"]) ? node["elements"] : []
    const known = A.takeWhile(elements, (each) => !(isNode(each) && each.type === "SpreadElement"))
    return {
      fields: R.fromEntries(
        A.flatMap(known, (each, index) => (isNode(each) ? [[`${index}`, heldOf(each, scopes)] as const] : []))
      )
    }
  }
  if (node.type === "ObjectExpression") {
    const entries = A.flatMap(nodes(node["properties"]), (property): ReadonlyArray<readonly [string, Held]> => {
      if (property.type === "SpreadElement") {
        const spread = O.match(child(property, "argument"), {
          onNone: (): Held => "neither",
          onSome: (inner) => heldOf(inner, scopes)
        })
        return isFields(spread) ? R.toEntries(spread.fields) : []
      }
      return O.match(keyOf(property, "key"), {
        onNone: () => [],
        onSome: (key) =>
          O.match(child(property, "value"), {
            onNone: () => [],
            onSome: (inner) => [[key, heldOf(inner, scopes)] as const]
          })
      })
    })
    return { fields: R.fromEntries(entries) }
  }
  return "neither"
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

/** What one function declaration binds: its name, as a reader when it hands a tag back. */
const declaredFunction = (declaration: Node, scopes: ReadonlyArray<Scope>): ReadonlyArray<readonly [string, Held]> =>
  O.match(child(declaration, "id"), {
    onNone: () => [],
    onSome: (id) => [[nameOf(id), returnsTag(declaration, scopes) ? "reader" : "neither"] as const]
  })

/** What one declaration binds, read in `scopes` (the outer ones, and what this scope declared before it). */
const declared = (declaration: Node, scopes: ReadonlyArray<Scope>): ReadonlyArray<readonly [string, Held]> => {
  if (declaration.type === "FunctionDeclaration") return declaredFunction(declaration, scopes)
  return A.flatMap(nodes(declaration["declarations"]), (declarator) =>
    O.match(child(declarator, "id"), {
      onNone: () => [],
      onSome: (id) =>
        namesIn(
          id,
          O.match(child(declarator, "init"), { onNone: (): Held => "neither", onSome: (init) => heldOf(init, scopes) })
        )
    })
  )
}

/**
 * What an assignment to a name puts in it (`t = x._tag`, `t += x._tag`, `t ??= x._tag`): what the value holds, when
 * it holds anything. A later assignment of a plain value does not take it back: the tag was in the name once.
 */
const assigned = (assignment: Node, scopes: ReadonlyArray<Scope>): ReadonlyArray<readonly [string, Held]> =>
  O.match(O.map(child(assignment, "left"), unwrapped), {
    onNone: () => [],
    onSome: (left) => {
      if (left.type !== "Identifier") return []
      const held = O.match(child(assignment, "right"), {
        onNone: (): Held => "neither",
        onSome: (right) => heldOf(right, scopes)
      })
      return held === "neither" ? [] : [[nameOf(left), held] as const]
    }
  })

/** True when two scopes say the same of every name a function declaration binds. */
const sameReaders = (before: Scope, after: Scope): boolean =>
  A.every(R.toEntries(after), ([name, held]) => O.exists(R.get(before, name), (was) => was === held))

/**
 * What a function (or the file's top level, `holder` the program) binds: its parameters, its function declarations
 * (hoisted: one may be called before it is written, and one may hand back what another does, so they are read until
 * what they hand back settles), then its declarations and assignments in the order written.
 */
const scopeOf = (holder: Node, outer: ReadonlyArray<Scope>): Scope => {
  const params = A.flatMap(nodes(holder["params"]), (param) => namesIn(param, "neither"))
  const body = holder.type === "Program" ? O.some(holder) : child(holder, "body")
  const own = O.match(body, {
    onNone: () => [],
    onSome: (inside) =>
      ownNodes(inside, (node) => typeIs(node, "VariableDeclaration", "FunctionDeclaration", "AssignmentExpression"))
  })
  const hoisted = A.filter(own, (node) => node.type === "FunctionDeclaration")
  const readFunctions = (scope: Scope): Scope => ({
    ...scope,
    ...R.fromEntries(A.flatMap(hoisted, (declaration) => declaredFunction(declaration, A.append(outer, scope))))
  })
  const settle = (scope: Scope, rounds: number): Scope => {
    const next = readFunctions(scope)
    return rounds <= 0 || sameReaders(scope, next) ? next : settle(next, rounds - 1)
  }
  const withFunctions = settle(R.fromEntries(params), hoisted.length)
  return A.reduce(own, withFunctions, (scope: Scope, node) => ({
    ...scope,
    ...R.fromEntries(
      node.type === "AssignmentExpression"
        ? assigned(node, A.append(outer, scope))
        : node.type === "FunctionDeclaration"
          ? []
          : declared(node, A.append(outer, scope))
    )
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

/** True for an expectation or one of its matchers: `expect(…)`, `expect(…).toBe(…)`, `expect(…).not.toEqual(…)`. */
const isExpectation = (callee: Node): boolean => {
  const node = unwrapped(callee)
  if (node.type === "Identifier") return nameOf(node) === "expect"
  if (node.type === "MemberExpression") return O.exists(child(node, "object"), isExpectation)
  if (node.type === "CallExpression") return O.exists(child(node, "callee"), isExpectation)
  return false
}

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
      // A side that names a tag compares by it, words or none (`${x._tag}:${n}` === "Idle:1", tags joined).
      const side = (inner: Node): boolean => carries(inner) || namesTag(inner, here)
      if (A.some(A.getSomes([child(node, "left"), child(node, "right")]), side)) {
        found.push({ line: lineAt(node.start), how: String(node["operator"]) })
      }
    }
    if (node.type === "SwitchStatement" && O.exists(child(node, "discriminant"), carries)) {
      found.push({ line: lineAt(node.start), how: "switch" })
    }
    if (typeIs(node, "CallExpression", "NewExpression")) {
      // A tag handed over, alone or in a list handed over whole (`expect([status, x._tag]).toEqual(…)`). Tags joined
      // into words are a sentence that names them (`A.join(A.map(steps, said), ", ")`), as a template with words is:
      // the join itself is not a refusal, what is done with its words may be. An expectation compares what it is
      // handed, so a sentence that names a tag handed to one is refused too.
      const spread = (argument: Node): ReadonlyArray<Node> => {
        const value = unwrapped(argument)
        return value.type === "ArrayExpression" ? nodes(value["elements"]) : [argument]
      }
      const handed = A.flatMap(nodes(node["arguments"]), spread)
      if (!isJoin(node)) {
        for (const argument of handed) {
          if (carries(argument)) found.push({ line: lineAt(argument.start), how: "argument" })
        }
      }
      // What an expectation compares: the value `expect` is handed (its second argument is the message said when it
      // fails), and every value a matcher of it is handed.
      const compared = O.match(O.map(child(node, "callee"), unwrapped), {
        onNone: () => [],
        onSome: (callee) =>
          callee.type === "Identifier" && nameOf(callee) === "expect"
            ? A.flatMap(A.take(nodes(node["arguments"]), 1), spread)
            : isExpectation(callee)
              ? handed
              : []
      })
      for (const argument of compared) {
        if (namesTag(argument, here)) found.push({ line: lineAt(argument.start), how: "argument" })
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
