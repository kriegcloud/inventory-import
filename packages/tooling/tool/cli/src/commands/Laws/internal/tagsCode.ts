// The places one file tells a tagged value's case by its `_tag` by hand, or builds one by hand: `x._tag === "Saving"`,
// `x?._tag !== "None"`, a `switch` on `x._tag`, the same through anything that holds the tag (a name it was read or
// assigned into, a list or a record it was put in, spread into or read back out of, a loop over such a list, tags
// joined, `x._tag ?? ""`, a template, a method of it, what a function that hands it back answers, a method of a record
// included), a tag handed to a call, a tag used as a key, a sentence that names a tag compared or handed to an
// expectation, `P.isTagged` (it takes any value, so its tag is never checked), and an object literal with a `_tag`
// key. Read from the syntax tree, the parser's plain data, as records of unknown values: a comparison split over
// lines, or written with `==`, is the same node. Each expression is judged once where it is read, and kept: one judged
// again along every way to it took a time that doubled with each call of a chain. Every judgement spends the file's
// budget (`budget.ts`); the walks of the tree keep their own list, so no file nests them past the stack; a file that
// needs more steps, judgements or reads deeper inside one another, or that the scan or the parser refuses, is refused
// at the place being read.
import * as A from "effect/Array"
import * as MutableHashMap from "effect/MutableHashMap"
import * as O from "effect/Option"
import * as P from "effect/Predicate"
import * as R from "effect/Record"
import { parseSync } from "oxc-parser"
import {
  type Budget,
  budgetOf,
  maxDepth,
  maxNesting,
  parseFailure,
  type Stopped,
  tagsStepsPerCharacter,
  Unread,
  unreadable
} from "./budget.ts"
import { linesOf } from "./lines.ts"

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

/** The budget of the file being read: one file at a time, read from start to end without a pause. */
const reading: { budget: Budget } = { budget: budgetOf({ length: 0, perCharacter: tagsStepsPerCharacter }) }
/** `read()` as one read inside another of the file being read, at `node`. */
const counted = <A>(node: Node, fallback: A, read: () => A): A => reading.budget.within(node.start, fallback, read)
/** Counts `count` steps of the file being read. */
const tick = (count = 1, at?: number): boolean => reading.budget.tick(count, at)

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
/** True for `isTagged` as a key: `P.isTagged`, `P["isTagged"]`, `{ isTagged }`. */
const isTaggedKey = (holder: Node, key: string): boolean => O.exists(keyOf(holder, key), (name) => name === "isTagged")

const wrappers = [
  "ChainExpression",
  "ParenthesizedExpression",
  "TSNonNullExpression",
  "TSAsExpression",
  "TSSatisfiesExpression",
  "TSTypeAssertion"
]

/** The value under the wrappers that do not change it: brackets, `?.`, a non-null mark, a type assertion. A step each. */
const unwrapped = (node: Node): Node => {
  let inner = node
  while (A.contains(wrappers, inner.type) && tick()) {
    const next = child(inner, "expression")
    if (O.isNone(next)) return inner
    inner = next.value
  }
  return inner
}

/** True for `x._tag`, `x?._tag` and `x["_tag"]`, in brackets or not. */
const isTagRead = (value: Node): boolean => {
  const node = unwrapped(value)
  return node.type === "MemberExpression" && isTagKey(node, "property")
}

/**
 * A list or a record written in place, each of its places with what it holds (a list's by position: "0", "1").
 * `tag` and `sentence` say whether one is somewhere in it, kept when it is made: a record kept in two places of the
 * next one, and that one in two of the one after, is looked into once.
 */
interface Fields {
  readonly fields: Readonly<Record<string, Held>>
  readonly tag: boolean
  readonly sentence: boolean
}

/**
 * What a name one function (or the file) binds holds: a tag read by hand (`tag` in `const tag = x._tag`), a function
 * that hands a tag back (`tagOf` in `const tagOf = (e) => e._tag`), a sentence that names a tag (a template with words,
 * tags joined), `P.isTagged` under another name (`const { isTagged } = P`, `const is = P.isTagged`), a list or a record
 * of these (`const o = { k: x._tag }`, `const t = [x._tag]`), or none of them.
 */
type Held = "tag" | "reader" | "sentence" | "isTagged" | "neither" | Fields

/**
 * The place of a list no position names: what a spread put in it, and everything after the spread (`[...tags]`,
 * `[n, ...rest, x._tag]`). Read for any position the list has no own place for.
 */
const anyPlace = "…"

const isFields = (held: Held): held is Fields => P.isObject(held)
const fieldOf = (held: Held, key: string): Held =>
  isFields(held)
    ? O.getOrElse(
        O.orElse(R.get(held.fields, key), () => R.get(held.fields, anyPlace)),
        (): Held => "neither"
      )
    : "neither"
/** True for a tag, or a list or a record with one somewhere in it. */
const holdsTag = (held: Held): boolean => held === "tag" || (isFields(held) && held.tag)
/** True for a sentence that names a tag, or a list or a record with one somewhere in it. */
const holdsSentence = (held: Held): boolean => held === "sentence" || (isFields(held) && held.sentence)
const fieldsOf = (places: ReadonlyArray<readonly [string, Held]>): Fields => {
  const fields = R.fromEntries(places)
  const held = R.values(fields)
  return { fields, tag: A.some(held, holdsTag), sentence: A.some(held, holdsSentence) }
}

/**
 * One reading of a file. What an expression is, is judged once in each `Env` it is read in and kept there, so a chain
 * of calls or a nest of choices costs its length and not its paths.
 */
interface Pass {
  /** The declared functions an earlier pass found to hand a tag back after it had taken one for not doing so. */
  readonly readers: WeakSet<Node>
  /** The declared functions taken for not handing a tag back before they were read: one that calls itself. */
  readonly assumed: WeakSet<Node>
  /** Those set aside because judgements were too deep inside one another, read when the file has been. */
  readonly aside: Array<{ readonly declaration: Node; readonly env: Env }>
  /** True when one taken for not handing a tag back does: what was judged on it is judged again, in another pass. */
  again: boolean
}

/** What a name is bound to from one point of its function on: what it holds, or the function declared under it. */
type Bound = { readonly from: number; readonly held: Held } | { readonly from: number; readonly declaration: Node }

/** The names one function (or the file) binds, read in one place: each with what it holds, in the order written. */
interface Names {
  readonly outer: Env | undefined
  readonly bound: MutableHashMap.MutableHashMap<string, Array<Bound>>
}

/** What the names of one function hold at one point of it, over the ones it is written in; and what was judged there. */
interface Env {
  readonly pass: Pass
  readonly names: Names
  readonly at: number
  /** The parameters and the declared functions alone, which a declared function is read in. */
  readonly start: Env | undefined
  readonly judged: WeakMap<Node, Judged>
  /** Each function written here, with its own names at the end of it. */
  readonly inside: WeakMap<Node, Env>
  readonly declared: WeakMap<Node, boolean | "being read">
}

/** What one expression is, in one place: each answer kept once it has been asked for. */
interface Judged {
  carries?: boolean
  names?: boolean
  held?: Held
}

const envOf = (pass: Pass, names: Names, at: number, start: Env | undefined): Env => ({
  pass,
  names,
  at,
  start,
  judged: new WeakMap(),
  inside: new WeakMap(),
  declared: new WeakMap()
})

/** What was judged of an expression in one place, empty when nothing has been. */
const judgedOf = (node: Node, env: Env): Judged => {
  const known = env.judged.get(node)
  if (known !== undefined) return known
  const fresh: Judged = {}
  env.judged.set(node, fresh)
  return fresh
}

/**
 * The names a pattern binds out of a value that holds `held`: a `_tag` taken out (`{ _tag }`, `{ _tag: kind }`) is a
 * tag; a place taken out of a list or a record (`const [t] = [x._tag]`, `const { k } = { k: x._tag }`) holds what
 * that place holds; anything taken out of a list of tags is a tag.
 */
const namesIn = (pattern: Node, held: Held): ReadonlyArray<readonly [string, Held]> =>
  counted(pattern, [], () => namesInNow(pattern, held))
const namesInNow = (pattern: Node, held: Held): ReadonlyArray<readonly [string, Held]> => {
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
                  : isTaggedKey(property, "key")
                    ? "isTagged"
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

/** What a name holds in one place: what the innermost function that binds it there last gave it. */
const heldBy = (env: Env, name: string): Held => {
  let here: Env | undefined = env
  while (here !== undefined && tick()) {
    const at = here.at
    const bound = O.flatMap(MutableHashMap.get(here.names.bound, name), (all) =>
      A.findLast(all, (each) => each.from <= at)
    )
    if (O.isSome(bound)) {
      if ("held" in bound.value) return bound.value.held
      return declaredReads(bound.value.declaration, here.start ?? here) ? "reader" : "neither"
    }
    here = here.names.outer
  }
  return "neither"
}

/** Every node under `body`, not looking inside the functions written in it, that `keep` holds. */
const ownNodes = (body: Node, keep: (node: Node) => boolean): ReadonlyArray<Node> => {
  const found: Array<Node> = []
  const left = A.reverse(children(body))
  for (let node = left.pop(); node !== undefined; node = left.pop()) {
    if (keep(node)) found.push(node)
    if (!isFunction(node)) for (const next of A.reverse(children(node))) left.push(next)
  }
  return found
}

/** The next link of a chain: what a member is read from, what is called, the left of a sum, the rest of a choice. */
const nextLink = (node: Node): Node | undefined => {
  const key =
    node.type === "MemberExpression"
      ? "object"
      : node.type === "CallExpression"
        ? "callee"
        : typeIs(node, "BinaryExpression", "LogicalExpression")
          ? "left"
          : node.type === "ConditionalExpression"
            ? "alternate"
            : ""
  return O.getOrUndefined(O.map(child(node, key), unwrapped))
}

/**
 * The links under one, deepest first, whose answer is not known yet: judged in that order, each finds the answer of
 * the one under it, so a chain of thousands is followed by a loop and never by a call inside a call.
 */
const linksUnder = (node: Node, env: Env, asked: "carries" | "names"): ReadonlyArray<Node> => {
  const links: Array<Node> = []
  let next = nextLink(node)
  while (next !== undefined && tick() && !isFunction(next) && env.judged.get(next)?.[asked] === undefined) {
    links.push(next)
    next = nextLink(next)
  }
  return A.reverse(links)
}

/** What a member read out of a list or a record holds: `o.k`, `o["k"]`, `t[0]`. */
const memberHeld = (member: Node, env: Env): Held =>
  O.match(keyOf(member, "property"), {
    onNone: (): Held => "neither",
    onSome: (key) =>
      O.match(child(member, "object"), {
        onNone: (): Held => "neither",
        onSome: (object) => fieldOf(heldOf(object, env), key)
      })
  })

/**
 * True for a value a tag flows into: `x._tag`, a name it was read into, a place of a list or a record it was put in,
 * `x._tag ?? ""`, a choice or a template with it, a method of it (`x._tag.toLowerCase()`), what a function that hands
 * a tag back answers (`kindOf(x)`, `k.of(x)`, `Effect.map(e, (error) => error._tag)`), tags joined (`A.join([x._tag],
 * "")`, `[x._tag].join("")`: with no words between them a joined tag is the tag, with words it is still compared as
 * one), and what `yield*` or `await` takes out of any of these.
 */
const carriesTag = (value: Node, env: Env): boolean =>
  counted(value, false, () => {
    const node = unwrapped(value)
    const judged = judgedOf(node, env)
    if (judged.carries === undefined) {
      for (const link of linksUnder(node, env, "carries")) carriesTag(link, env)
      judged.carries = carriesNow(node, env)
    }
    return judged.carries
  })

const carriesIn = (node: Node, key: string, env: Env): boolean => {
  const inner = child(node, key)
  return O.isSome(inner) && carriesTag(inner.value, env)
}

const carriesNow = (node: Node, env: Env): boolean => {
  if (isTagRead(node)) return true
  if (isJoin(node)) return A.some(joinedLists(node), (list) => holdsTag(heldOf(list, env)))
  if (node.type === "Identifier") return heldBy(env, nameOf(node)) === "tag"
  if (node.type === "LogicalExpression") return carriesIn(node, "left", env) || carriesIn(node, "right", env)
  if (node.type === "BinaryExpression") {
    return node["operator"] === "+" && (carriesIn(node, "left", env) || carriesIn(node, "right", env))
  }
  if (node.type === "ConditionalExpression") {
    return carriesIn(node, "consequent", env) || carriesIn(node, "alternate", env)
  }
  // `${x._tag}` alone is the tag; with words around it, it is a sentence that names it (a message, a key).
  if (node.type === "TemplateLiteral") return isBareTemplate(node) && templateHoldsTag(node, env)
  if (typeIs(node, "AwaitExpression", "YieldExpression")) return carriesIn(node, "argument", env)
  if (node.type === "SequenceExpression") {
    return O.exists(A.last(nodes(node["expressions"])), (inner) => carriesTag(inner, env))
  }
  if (node.type === "MemberExpression") return carriesIn(node, "object", env) || memberHeld(node, env) === "tag"
  if (node.type !== "CallExpression") return false
  const callee = O.map(child(node, "callee"), unwrapped)
  if (O.isNone(callee)) return false
  if (callee.value.type === "MemberExpression" && carriesIn(callee.value, "object", env)) return true
  return readsTagOut(callee.value, env) || A.some(nodes(node["arguments"]), (argument) => readsTagOut(argument, env))
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
const templateHoldsTag = (template: Node, env: Env): boolean =>
  A.some(nodes(template["expressions"]), (inner) => carriesTag(inner, env))

/** The name a call is made by: `join` in `A.join(…)`, `names.join(…)`, `names["join"](…)` and `join(…)`. */
const calledAs = (callee: Node): string =>
  callee.type === "MemberExpression" ? O.getOrElse(keyOf(callee, "property"), () => "") : nameOf(callee)

/** True for a call that joins a list into words: `A.join(list, ", ")`, `list.join(", ")`. */
const isJoin = (node: Node): boolean =>
  typeIs(node, "CallExpression", "NewExpression") &&
  O.exists(O.map(child(node, "callee"), unwrapped), (callee) => calledAs(callee) === "join")

/** The list a join joins: what the method is called on (`list.join(…)`), or the first argument (`A.join(list, …)`). */
const joinedLists = (join: Node): ReadonlyArray<Node> =>
  A.appendAll(
    O.toArray(
      O.flatMap(
        O.filter(O.map(child(join, "callee"), unwrapped), (callee) => callee.type === "MemberExpression"),
        (callee) => child(callee, "object")
      )
    ),
    A.take(nodes(join["arguments"]), 1)
  )

/**
 * True for a sentence that names a tag: a template with words around one (`${x._tag}:1`), sentences joined, a name
 * one was put in, and a choice of these. Handed on (a message, a key) it passes; compared, or handed to an
 * expectation, it tells a case. Tags joined are the tag itself (`carriesTag`).
 */
const namesTag = (value: Node, env: Env): boolean =>
  counted(value, false, () => {
    const node = unwrapped(value)
    const judged = judgedOf(node, env)
    if (judged.names === undefined) {
      for (const link of linksUnder(node, env, "names")) namesTag(link, env)
      judged.names = namesNow(node, env)
    }
    return judged.names
  })

const namesNow = (node: Node, env: Env): boolean => {
  if (node.type === "TemplateLiteral") return templateHoldsTag(node, env)
  if (node.type === "Identifier") return heldBy(env, nameOf(node)) === "sentence"
  if (node.type === "MemberExpression") return memberHeld(node, env) === "sentence"
  const any = (key: string): boolean => O.exists(child(node, key), (inner) => namesTag(inner, env))
  if (node.type === "LogicalExpression") return any("left") || any("right")
  if (node.type === "ConditionalExpression") return any("consequent") || any("alternate")
  if (node.type === "BinaryExpression") return node["operator"] === "+" && (any("left") || any("right"))
  return isJoin(node) && A.some(joinedLists(node), (list) => holdsSentence(heldOf(list, env)))
}

/**
 * True for a value that holds a tag: the tag itself (read, joined, flowed into a name), or a list or a record with one
 * somewhere in it (`[x._tag]`, `{ k: x._tag }`, `[...tags]`). Each check treats it as the tag.
 */
const holdsTagIn = (value: Node, env: Env): boolean => holdsTag(heldOf(value, env))

/** True for a function that hands a tag back, written in place or named: `(error) => error._tag`, `tagOf`, `k.of`. */
const readsTagOut = (value: Node, env: Env): boolean => {
  const node = unwrapped(value)
  if (node.type === "Identifier") return heldBy(env, nameOf(node)) === "reader"
  if (node.type === "MemberExpression") return memberHeld(node, env) === "reader"
  return typeIs(node, "ArrowFunctionExpression", "FunctionExpression") && returnsTag(node, env)
}

/** What one place of a list or a record holds, as written: `x._tag`, a function that hands one back, a sentence. */
const heldOf = (value: Node, env: Env): Held =>
  counted(value, "neither", () => {
    const node = unwrapped(value)
    const judged = judgedOf(node, env)
    if (judged.held === undefined) judged.held = heldNow(node, env)
    return judged.held
  })

const heldNow = (node: Node, env: Env): Held => {
  if (carriesTag(node, env)) return "tag"
  if (readsTagOut(node, env)) return "reader"
  if (namesTag(node, env)) return "sentence"
  if (node.type === "MemberExpression" && isTaggedKey(node, "property")) return "isTagged"
  if (node.type === "Identifier") return heldBy(env, nameOf(node))
  if (node.type === "MemberExpression") return memberHeld(node, env)
  if (node.type === "ArrayExpression") {
    // By position, up to the first spread: after it no place is known, so what the spreads and the places after
    // them hold is held by any place (`[...tags]`, `[...rest, x._tag]`).
    const elements: ReadonlyArray<unknown> = A.isArray(node["elements"]) ? node["elements"] : []
    const isSpread = (each: unknown): boolean => isNode(each) && each.type === "SpreadElement"
    const known = A.takeWhile(elements, (each) => !isSpread(each))
    const after = A.drop(elements, known.length)
    const unplaced = A.some(after, (each) =>
      isNode(each)
        ? isSpread(each)
          ? O.exists(child(each, "argument"), (inner) => holdsTagIn(inner, env))
          : holdsTagIn(each, env)
        : false
    )
    return fieldsOf(
      A.appendAll(
        A.flatMap(known, (each, index) => (isNode(each) ? [[`${index}`, heldOf(each, env)] as const] : [])),
        unplaced ? [[anyPlace, "tag"] as const] : []
      )
    )
  }
  if (node.type === "ObjectExpression") {
    const entries = A.flatMap(nodes(node["properties"]), (property): ReadonlyArray<readonly [string, Held]> => {
      if (property.type === "SpreadElement") {
        const spread = O.match(child(property, "argument"), {
          onNone: (): Held => "neither",
          onSome: (inner) => heldOf(inner, env)
        })
        return isFields(spread) ? R.toEntries(spread.fields) : []
      }
      return O.match(keyOf(property, "key"), {
        onNone: () => [],
        onSome: (key) =>
          O.match(child(property, "value"), {
            onNone: () => [],
            onSome: (inner) => [[key, heldOf(inner, env)] as const]
          })
      })
    })
    tick(entries.length)
    return fieldsOf(entries)
  }
  return "neither"
}

/** True for a function whose answer a tag flows into, read among its own names over the ones it is written in. */
const returnsTag = (fn: Node, outer: Env): boolean =>
  counted(fn, false, () => {
    const body = child(fn, "body")
    if (O.isNone(body)) return false
    const inner = insideOf(fn, outer)
    return body.value.type === "BlockStatement"
      ? A.some(
          ownNodes(body.value, (node) => tick() && node.type === "ReturnStatement"),
          (returned) => O.exists(child(returned, "argument"), (answer) => carriesTag(answer, inner))
        )
      : carriesTag(body.value, inner)
  })

/**
 * How deep judgements that follow names, or reads of any kind, go inside one another before a declared function met
 * there is set aside, and read by itself later: half the depth a file may reach, so one read again from the top has
 * room for as much.
 */
const asideDepth = maxDepth / 2
const asideNesting = maxNesting / 2

/**
 * True for a declared function that hands a tag back, read among the parameters and the declared functions it is
 * written with (hoisted: it may be called before it is written, and hand back what one declared after it does). One
 * that is being read already (it calls itself, directly or through another) is taken for not handing a tag back; when
 * it does, the file is read again with that known (`Pass.again`), so at most once more for each such function.
 */
const declaredReads = (declaration: Node, start: Env): boolean => {
  const pass = start.pass
  if (pass.readers.has(declaration)) return true
  const known = start.declared.get(declaration)
  if (known === "being read") pass.assumed.add(declaration)
  if (known !== undefined) return known === true
  if (reading.budget.depth() >= asideDepth || reading.budget.nesting() >= asideNesting) {
    pass.assumed.add(declaration)
    pass.aside.push({ declaration, env: start })
    return false
  }
  if (!tick()) return false
  start.declared.set(declaration, "being read")
  const reads = reading.budget.following(declaration.start, false, () => returnsTag(declaration, start))
  start.declared.set(declaration, reads)
  if (reads && pass.assumed.has(declaration)) {
    pass.readers.add(declaration)
    pass.again = true
  }
  return reads
}

/** What one declaration binds, read where it is written (the outer names, and what was bound before it). */
const declared = (declaration: Node, env: Env): ReadonlyArray<readonly [string, Held]> =>
  A.flatMap(nodes(declaration["declarations"]), (declarator) =>
    O.match(child(declarator, "id"), {
      onNone: () => [],
      onSome: (id) =>
        namesIn(
          id,
          O.match(child(declarator, "init"), { onNone: (): Held => "neither", onSome: (init) => heldOf(init, env) })
        )
    })
  )

/**
 * What an assignment puts in the names it sets (`t = x._tag`, `t += x._tag`, `t ??= x._tag`, `[t] = [x._tag]`,
 * `({ k: t } = { k: x._tag })`): what the value holds, when it holds anything. A later assignment of a plain value
 * does not take it back: the tag was in the name once.
 */
const assigned = (assignment: Node, env: Env): ReadonlyArray<readonly [string, Held]> =>
  O.match(O.map(child(assignment, "left"), unwrapped), {
    onNone: () => [],
    onSome: (left) => {
      if (!typeIs(left, "Identifier", "ArrayPattern", "ObjectPattern")) return []
      const held = O.match(child(assignment, "right"), {
        onNone: (): Held => "neither",
        onSome: (right) => heldOf(right, env)
      })
      return A.filter(namesIn(left, held), ([, each]) => each !== "neither")
    }
  })

/**
 * What a loop over a list binds (`for (const t of A.map(xs, (e) => e._tag))`, `for (t of tags)`): a tag, when the
 * list holds one anywhere.
 */
const iterated = (loop: Node, env: Env): ReadonlyArray<readonly [string, Held]> => {
  const held: Held = O.exists(child(loop, "right"), (list) => holdsTagIn(list, env)) ? "tag" : "neither"
  return O.match(child(loop, "left"), {
    onNone: () => [],
    onSome: (left) =>
      left.type === "VariableDeclaration"
        ? A.flatMap(nodes(left["declarations"]), (declarator) =>
            O.match(child(declarator, "id"), { onNone: () => [], onSome: (id) => namesIn(id, held) })
          )
        : namesIn(unwrapped(left), held)
  })
}

/** What a function binds, as at its end (`namesOf`), read once for each place the function is read in. */
const insideOf = (fn: Node, outer: Env): Env => {
  const known = outer.inside.get(fn)
  if (known !== undefined) return known
  const inside = namesOf(fn, outer.pass, outer)
  outer.inside.set(fn, inside)
  return inside
}

/**
 * What a function (or the file's top level, `holder` the program) binds, as at its end: its parameters, its function
 * declarations (hoisted), then its declarations and assignments in the order written, each read among those before it.
 */
const namesOf = (holder: Node, pass: Pass, outer: Env | undefined): Env => {
  const names: Names = { outer, bound: MutableHashMap.empty() }
  const bind = (name: string, bound: Bound): void => {
    tick()
    const all = O.getOrUndefined(MutableHashMap.get(names.bound, name))
    if (all === undefined) MutableHashMap.set(names.bound, name, [bound])
    else all.push(bound)
  }
  for (const param of nodes(holder["params"])) {
    for (const [name, held] of namesIn(param, "neither")) bind(name, { from: 0, held })
  }
  const body = holder.type === "Program" ? O.some(holder) : child(holder, "body")
  const found = O.match(body, {
    onNone: (): ReadonlyArray<Node> => [],
    onSome: (inside) =>
      ownNodes(inside, (node) => {
        tick()
        return typeIs(node, "VariableDeclaration", "FunctionDeclaration", "AssignmentExpression", "ForOfStatement")
      })
  })
  // A loop's own declaration (`const t` in `for (const t of tags)`) is bound by the loop, from the list it walks.
  const loopHeads = new WeakSet<Node>()
  for (const node of found) {
    if (node.type === "FunctionDeclaration") {
      for (const id of O.toArray(child(node, "id"))) bind(nameOf(id), { from: 0, declaration: node })
    }
    if (node.type === "ForOfStatement") {
      for (const left of O.toArray(child(node, "left"))) loopHeads.add(left)
    }
  }
  const start = envOf(pass, names, 0, undefined)
  let env = start
  for (const node of found) {
    if (node.type === "FunctionDeclaration" || loopHeads.has(node)) continue
    const given =
      node.type === "AssignmentExpression"
        ? assigned(node, env)
        : node.type === "ForOfStatement"
          ? iterated(node, env)
          : declared(node, env)
    if (!A.isReadonlyArrayNonEmpty(given)) continue
    const from = env.at + 1
    for (const [name, held] of given) bind(name, { from, held })
    env = envOf(pass, names, from, start)
  }
  return env
}

/**
 * Says of each callee whether it is an expectation or one of its matchers: `expect(…)`, `expect(…).toBe(…)`,
 * `expect(…).not.toEqual(…)`. Each link of a chain is kept, so a chain is followed to its root once.
 */
const expectations = (): ((callee: Node) => boolean) => {
  const known = new WeakMap<Node, boolean>()
  return (callee) => {
    const path: Array<Node> = []
    let answer: boolean | undefined
    let node = unwrapped(callee)
    while (answer === undefined) {
      if (!tick()) return false
      answer = known.get(node)
      if (answer !== undefined) break
      path.push(node)
      const next =
        node.type === "MemberExpression"
          ? child(node, "object")
          : node.type === "CallExpression"
            ? child(node, "callee")
            : O.none<Node>()
      if (O.isNone(next)) answer = node.type === "Identifier" && nameOf(node) === "expect"
      else node = unwrapped(next.value)
    }
    for (const link of path) known.set(link, answer)
    return answer
  }
}

/** One place a `_tag` is told apart or built by hand. */
export interface ByHand {
  readonly line: number
  /**
   * "===" and its kin, "switch", "argument" (handed to a call), "method" (a method called on it), "key" (a record
   * read by it) or "literal" (an object built with a `_tag` key).
   */
  readonly how: string
}

/** What reading one file gives: the places, or where and why the law stopped; and what it spent. */
export interface TagsRead {
  /** The places, none when the law stopped. */
  readonly found: ReadonlyArray<ByHand>
  /** Where the law stopped reading and why (`budget.ts`): then nothing else of the file is said. */
  readonly unread: O.Option<{ readonly line: number; readonly unread: Unread }>
  /**
   * The steps the reading took, every pass counted, the judgements it made inside one another by following names,
   * and its reads inside one another of any kind, at most.
   */
  readonly steps: number
  readonly deepest: number
  readonly nestedMost: number
}

/**
 * Every place `source` tells a `_tag` apart or builds one by hand, and the steps it took to say so.
 *
 * @example readTags({ file: "Step.tsx", source: 'if (state._tag === "Idle") stop()' }).found // [{ line: 1, how: "===" }]
 */
export const readTags = (input: { readonly file: string; readonly source: string }): TagsRead => {
  const lineAt = linesOf(input.source)
  const unreadAt = (stopped: Stopped, budget?: Budget): TagsRead => ({
    found: [],
    unread: O.some({ line: lineAt(stopped.at), unread: stopped.unread }),
    steps: budget === undefined ? 0 : budget.steps(),
    deepest: budget === undefined ? 0 : budget.deepest(),
    nestedMost: budget === undefined ? 0 : budget.nestedMost()
  })
  const refused = unreadable(input.source)
  if (refused !== undefined) return unreadAt(refused)
  const parsed = parseSync(input.file, input.source)
  const failed = parseFailure(parsed.errors)
  if (failed !== undefined) return unreadAt(failed)
  const program: unknown = parsed.program
  if (!isNode(program)) return unreadAt({ at: 0, unread: Unread.Unparsed({ message: "no program" }) })
  const budget = budgetOf({ length: input.source.length, perCharacter: tagsStepsPerCharacter })
  reading.budget = budget
  const readers = new WeakSet<Node>()
  for (;;) {
    const pass: Pass = { readers, assumed: new WeakSet(), aside: [], again: false }
    const found = placesIn(program, pass, lineAt)
    for (const { declaration, env } of pass.aside) declaredReads(declaration, env)
    const stopped = budget.stopped()
    if (stopped !== undefined) return unreadAt(stopped, budget)
    if (!pass.again) {
      return {
        found,
        unread: O.none(),
        steps: budget.steps(),
        deepest: budget.deepest(),
        nestedMost: budget.nestedMost()
      }
    }
  }
}

/** One pass over a file: every node, each judged among the names of the function it is written in. */
const placesIn = (program: Node, pass: Pass, lineAt: (offset: number) => number): ReadonlyArray<ByHand> => {
  const found: Array<ByHand> = []
  const isExpectation = expectations()
  const left: Array<{ readonly node: Node; readonly outer: Env }> = []
  const within = (node: Node, outer: Env): void => {
    for (const next of A.reverse(children(node))) left.push({ node: next, outer })
  }
  within(program, namesOf(program, pass, undefined))
  for (let at = left.pop(); at !== undefined && tick(1, at.node.start); at = left.pop()) {
    const { node } = at
    const here = isFunction(node) ? insideOf(node, at.outer) : at.outer
    // A value that holds a tag is the tag in every check: read, joined, flowed into a name, or kept in a list or a
    // record (`[x._tag]`, `{ k: x._tag }`, `[...tags]`).
    const carries = (inner: Node): boolean => holdsTagIn(inner, here)
    // A side that names a tag compares by it, words or none (`${x._tag}:${n}` === "Idle:1").
    const tells = (inner: Node): boolean => carries(inner) || namesTag(inner, here)
    if (node.type === "BinaryExpression" && A.contains(comparisons, node["operator"])) {
      if (A.some(A.getSomes([child(node, "left"), child(node, "right")]), tells)) {
        found.push({ line: lineAt(node.start), how: String(node["operator"]) })
      }
    }
    if (node.type === "SwitchStatement" && O.exists(child(node, "discriminant"), tells)) {
      found.push({ line: lineAt(node.start), how: "switch" })
    }
    if (typeIs(node, "CallExpression", "NewExpression")) {
      // A tag handed over: alone, joined (`A.contains(["Idle"], A.join([x._tag], ""))`, and the join itself), in a
      // list or a record handed over whole (`expect([status, x._tag]).toEqual(…)`, `expect({ k: x._tag })`), or
      // spread into the call. An expectation compares what it is handed, so a sentence that names a tag handed to
      // one is refused too.
      const spread = (argument: Node): ReadonlyArray<Node> =>
        counted(argument, [], () => {
          const value = unwrapped(argument)
          if (value.type === "SpreadElement") return O.toArray(child(value, "argument"))
          return value.type === "ArrayExpression" ? A.flatMap(nodes(value["elements"]), spread) : [argument]
        })
      const handed = A.flatMap(nodes(node["arguments"]), spread)
      for (const argument of handed) {
        if (carries(argument)) found.push({ line: lineAt(argument.start), how: "argument" })
      }
      // `P.isTagged(x, "Text")` is handed `unknown`, so a misspelled tag compiles: the type's own guards, match or
      // `Match.valueTags` check the name against its cases.
      if (O.exists(child(node, "callee"), (called) => heldOf(called, here) === "isTagged")) {
        found.push({ line: lineAt(node.start), how: "isTagged" })
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
        if (property.type === "Property" && isTagKey(property, "key")) {
          found.push({ line: lineAt(property.start), how: "literal" })
        }
      }
    }
    within(node, here)
  }
  return found
}
