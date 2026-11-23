// The Promises of one file, read from its syntax tree: an `async` function, an `await`, a `new Promise`, a call of
// `Promise.*`, a `Promise<…>` or `PromiseLike<…>` type, a `.then(`, `.catch(` or `.finally(` call, and an Effect run
// as a Promise (`runPromise`). A `.then`, `.catch` or `.finally` called on a name an import binds (`Effect.catch`,
// `Story.then`) is a module's member, not a promise's, and passes; on anything else it is taken for a promise's, which
// errs on the side of the rule; a thenable imported from a module passes, which only the types could tell, and the
// parser alone does not read them. `Promise` itself is caught however it is reached: by its name, through
// `globalThis`, `self` or `window`, by a member written in brackets (`Promise["all"]`), and as a value handed to a
// name (`const Q = Promise`), which is refused where it is taken. The file is read the way the `try` law reads one (`tryCode.ts`): refused at the place
// being read when the scan before parsing or the parser cannot read it, never passed in silence.
import * as A from "effect/Array"
import * as O from "effect/Option"
import { dual } from "effect/Function"
import * as Order from "effect/Order"
import * as P from "effect/Predicate"
import * as R from "effect/Record"
import { type Stopped, Unread, unreadable } from "./budget.ts"
import { linesOf } from "./lines.ts"
import { isNode, type Node, parsedAs } from "./tryCode.ts"

/** What one use of a Promise is. */
export type PromiseUse = "async" | "await" | "new" | "static" | "type" | "chain" | "run" | "value"

/** One use of a Promise: its line, from 1, and what it is. */
export interface PromiseAt {
  readonly line: number
  readonly use: PromiseUse
}

/** What reading one file gives: the uses, or where and why the law stopped. */
export interface PromiseRead {
  /** The uses, by line; none when the law stopped. */
  readonly found: ReadonlyArray<PromiseAt>
  /** Where the law stopped reading and why (`budget.ts`): then nothing else of the file is said. */
  readonly unread: O.Option<{ readonly line: number; readonly unread: Unread }>
}

const promiseNames = ["Promise", "PromiseLike"]
const chained = ["then", "catch", "finally"]
const runs = ["runPromise", "runPromiseExit", "runPromiseWith"]
/** The names the global object goes by, through which `Promise` is reached too. */
const globalObjects = ["globalThis", "self", "window"]
/** Where a name stands as a name, not as a value it reads: a key, a binding, an import's or a label's. */
const naming = ["key", "id", "local", "imported", "exported", "label", "typeName"]

const nameOf = (node: unknown): O.Option<string> =>
  isNode(node) && (node.type === "Identifier" || node.type === "IdentifierName") && P.isString(node["name"])
    ? O.some(node["name"])
    : O.none()

/** A member's name: an identifier after a dot, or a string in brackets (`x["then"]`). */
const propertyOf = (member: Node): O.Option<string> => {
  const property = member["property"]
  if (member["computed"] !== true) return nameOf(property)
  return isNode(property) && property.type === "Literal" && P.isString(property["value"])
    ? O.some(property["value"])
    : O.none()
}

/** Whether a node is `Promise` itself: its name, or a member of the global object that is it. */
const isPromise = (node: unknown): boolean =>
  O.exists(nameOf(node), (name) => name === "Promise") ||
  (isNode(node) &&
    node.type === "MemberExpression" &&
    O.exists(nameOf(node["object"]), (name) => A.contains(globalObjects, name)) &&
    O.exists(propertyOf(node), (name) => name === "Promise"))

/** The member a call is made on: `x.name(…)` or `x["name"](…)`, its object and its name; none for any other call. */
const memberCalled = (call: Node): O.Option<{ readonly object: unknown; readonly name: string }> => {
  const callee = call["callee"]
  if (!isNode(callee) || callee.type !== "MemberExpression") return O.none()
  return O.map(propertyOf(callee), (name) => ({ object: callee["object"], name }))
}

/** The nodes a field holds, when it holds a list. */
const nodesIn = (value: unknown): ReadonlyArray<Node> => (A.isArray(value) ? A.filter(value, isNode) : [])

/** The names the file's imports bind: a module's namespace, or one of its exports. */
const importedNames = (program: Node): ReadonlyArray<string> =>
  A.flatMap(
    A.filter(nodesIn(program["body"]), (node) => node.type === "ImportDeclaration"),
    (declaration: Node) =>
      A.getSomes(A.map(nodesIn(declaration["specifiers"]), (specifier) => nameOf(specifier["local"])))
  )

/** One node of the walk, with the field of its parent it stands in, and that parent. */
interface Placed {
  readonly node: Node
  readonly within: O.Option<{ readonly parent: Node; readonly key: string }>
}

/** A node's children, each with the field it stands in. */
const placedUnder = (parent: Node): ReadonlyArray<Placed> =>
  A.flatMap(R.toEntries(parent), ([key, value]) =>
    key === "parent"
      ? []
      : A.map(A.isArray(value) ? A.filter(value, isNode) : isNode(value) ? [value] : [], (node) => ({
          node,
          within: O.some({ parent, key })
        }))
  )

/**
 * What a reference to `Promise` is, by where it stands: made (`new`), asked a member of (`Promise.all`, called or
 * not), or handed on as a value. A name in a type or a key is none of them.
 */
const referenceUse = (placed: Placed): O.Option<PromiseUse> =>
  O.match(placed.within, {
    onNone: () => O.some<PromiseUse>("value"),
    onSome: ({ key, parent }): O.Option<PromiseUse> => {
      if (parent.type === "NewExpression" && key === "callee") return O.some("new")
      if (parent.type === "MemberExpression" && key === "object") return O.some("static")
      // `x.Promise`: a member's name after a dot, unless the member is the global object's, read as a whole.
      if (parent.type === "MemberExpression" && key === "property" && parent["computed"] !== true) return O.none()
      if (A.contains(naming, key) || parent.type === "TSTypeReference" || parent.type === "TSQualifiedName") {
        return O.none()
      }
      return O.some("value")
    }
  })

/** What a node is, as a use of a Promise, when it is one, given the names the file's imports bind. */
const useOf: {
  (imported: ReadonlyArray<string>): (placed: Placed) => O.Option<PromiseUse>
  (placed: Placed, imported: ReadonlyArray<string>): O.Option<PromiseUse>
} = dual(2, (placed: Placed, imported: ReadonlyArray<string>): O.Option<PromiseUse> => {
  const { node } = placed
  if (isPromise(node)) return referenceUse(placed)
  // `runPromise` itself, called or not: `pipe(effect, Effect.runPromise)`, `const run = Effect.runPromise`.
  if (node.type === "MemberExpression" && O.exists(propertyOf(node), (name) => A.contains(runs, name))) {
    return O.some("run")
  }
  if (
    O.exists(nameOf(node), (name) => A.contains(runs, name)) &&
    O.match(placed.within, {
      onNone: () => true,
      onSome: ({ key, parent }) =>
        !(parent.type === "MemberExpression" && key === "property") && !A.contains(naming, key)
    })
  ) {
    return O.some("run")
  }
  switch (node.type) {
    // `const { Promise: Q } = globalThis`: Promise taken out of the global object under another name.
    case "VariableDeclarator":
      return isNode(node["id"]) &&
        node["id"].type === "ObjectPattern" &&
        O.exists(nameOf(node["init"]), (name) => A.contains(globalObjects, name)) &&
        A.some(nodesIn(node["id"]["properties"]), (property) =>
          O.exists(nameOf(property["key"]), (name) => name === "Promise")
        )
        ? O.some("value")
        : O.none()
    case "FunctionDeclaration":
    case "FunctionExpression":
    case "ArrowFunctionExpression":
      return node["async"] === true ? O.some("async") : O.none()
    case "AwaitExpression":
      return O.some("await")
    case "ForOfStatement":
      return node["await"] === true ? O.some("await") : O.none()
    case "TSTypeReference":
      return O.exists(nameOf(node["typeName"]), (name) => A.contains(promiseNames, name)) ? O.some("type") : O.none()
    case "CallExpression":
      return O.flatMap(memberCalled(node), ({ name, object }): O.Option<PromiseUse> => {
        // A member of `Promise` is said once, where `Promise` is read; `runPromise` where it is named.
        if (isPromise(object) || A.contains(runs, name)) return O.none()
        if (!A.contains(chained, name)) return O.none()
        // A module's member (`Effect.catch`, `Story.then`) is no promise's.
        return O.exists(nameOf(object), (on) => A.contains(imported, on)) ? O.none() : O.some("chain")
      })
    default:
      return O.none()
  }
})

const byLine: Order.Order<PromiseAt> = Order.mapInput(Order.Number, (found: PromiseAt) => found.line)

/**
 * Every use of a Promise in `source`, or where and why it was not read.
 *
 * @example readPromises({ file: "a.ts", source: "export const f = async () => 1" }).found // [{ line: 1, use: "async" }]
 */
export const readPromises = (input: { readonly file: string; readonly source: string }): PromiseRead => {
  const { file, source } = input
  const lineAt = linesOf(source)
  const unreadAt = (stopped: Stopped): PromiseRead => ({
    found: [],
    unread: O.some({ line: lineAt(stopped.at), unread: stopped.unread })
  })
  // The scan before parsing answers at its own edge: a place it stopped, or nothing.
  const refused = O.fromUndefinedOr(unreadable(source))
  if (O.isSome(refused)) return unreadAt(refused.value)
  const whole = parsedAs({ file, source })
  if (O.isSome(whole.failed)) return unreadAt(whole.failed.value)
  if (O.isNone(whole.program)) return unreadAt({ at: 0, unread: Unread.Unparsed({ message: "no program" }) })
  const program = whole.program.value
  const imported = importedNames(program)
  const found: Array<PromiseAt> = []
  // Each node once, from a list of its own rather than the stack, as the `try` law walks.
  const left: Array<Placed> = [{ node: program, within: O.none() }]
  while (A.isArrayNonEmpty(left)) {
    const placed = A.lastNonEmpty(left)
    left.splice(-1, 1)
    const use = useOf(placed, imported)
    if (O.isSome(use)) found.push({ line: lineAt(placed.node.start), use: use.value })
    for (const next of A.reverse(placedUnder(placed.node))) left.push(next)
  }
  return { found: A.sort(found, byLine), unread: O.none() }
}
