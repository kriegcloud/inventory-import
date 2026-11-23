// The Promises of one file, read from its syntax tree: an `async` function, an `await`, a `new Promise`, a call of
// `Promise.*`, a `Promise<…>` or `PromiseLike<…>` type, a `.then(`, `.catch(` or `.finally(` call, and an Effect run
// as a Promise (`runPromise`). A `.then`, `.catch` or `.finally` called on a name an import binds (`Effect.catch`,
// `Story.then`) is a module's member, not a promise's, and passes; on anything else it is taken for a promise's, which
// errs on the side of the rule. The file is read the way the `try` law reads one (`tryCode.ts`): refused at the place
// being read when the scan before parsing or the parser cannot read it, never passed in silence.
import * as A from "effect/Array"
import * as O from "effect/Option"
import * as Order from "effect/Order"
import * as P from "effect/Predicate"
import { type Stopped, Unread, unreadable } from "./budget.ts"
import { linesOf } from "./lines.ts"
import { children, isNode, type Node, parsedAs } from "./tryCode.ts"

/** What one use of a Promise is. */
export type PromiseUse = "async" | "await" | "new" | "static" | "type" | "chain" | "run"

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

const nameOf = (node: unknown): O.Option<string> =>
  isNode(node) && (node.type === "Identifier" || node.type === "IdentifierName") && P.isString(node["name"])
    ? O.some(node["name"])
    : O.none()

/** The member a call is made on: `x.name(…)`, its object and its name; none for any other call. */
const memberCalled = (call: Node): O.Option<{ readonly object: unknown; readonly name: string }> => {
  const callee = call["callee"]
  if (!isNode(callee) || callee.type !== "MemberExpression" || callee["computed"] === true) return O.none()
  return O.map(nameOf(callee["property"]), (name) => ({ object: callee["object"], name }))
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

/** What a node is, as a use of a Promise, when it is one. */
const useOf = (node: Node, imported: ReadonlyArray<string>): O.Option<PromiseUse> => {
  switch (node.type) {
    case "FunctionDeclaration":
    case "FunctionExpression":
    case "ArrowFunctionExpression":
      return node["async"] === true ? O.some("async") : O.none()
    case "AwaitExpression":
      return O.some("await")
    case "ForOfStatement":
      return node["await"] === true ? O.some("await") : O.none()
    case "NewExpression":
      return O.exists(nameOf(node["callee"]), (name) => name === "Promise") ? O.some("new") : O.none()
    case "TSTypeReference":
      return O.exists(nameOf(node["typeName"]), (name) => A.contains(promiseNames, name)) ? O.some("type") : O.none()
    case "CallExpression":
      return O.flatMap(memberCalled(node), ({ name, object }): O.Option<PromiseUse> => {
        if (O.exists(nameOf(object), (on) => on === "Promise")) return O.some("static")
        if (A.contains(runs, name)) return O.some("run")
        if (!A.contains(chained, name)) return O.none()
        // A module's member (`Effect.catch`, `Story.then`) is no promise's.
        return O.exists(nameOf(object), (on) => A.contains(imported, on)) ? O.none() : O.some("chain")
      }).pipe(
        O.orElse(() =>
          O.exists(nameOf(node["callee"]), (name) => A.contains(runs, name)) ? O.some<PromiseUse>("run") : O.none()
        )
      )
    default:
      return O.none()
  }
}

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
  const refused = unreadable(source)
  if (refused !== undefined) return unreadAt(refused)
  const whole = parsedAs({ file, source })
  if (O.isSome(whole.failed)) return unreadAt(whole.failed.value)
  if (O.isNone(whole.program)) return unreadAt({ at: 0, unread: Unread.Unparsed({ message: "no program" }) })
  const program = whole.program.value
  const imported = importedNames(program)
  const found: Array<PromiseAt> = []
  // Each node once, from a list of its own rather than the stack, as the `try` law walks.
  const left: Array<Node> = [program]
  for (let node = left.pop(); node !== undefined; node = left.pop()) {
    const use = useOf(node, imported)
    if (O.isSome(use)) found.push({ line: lineAt(node.start), use: use.value })
    for (const next of A.reverse(children(node))) left.push(next)
  }
  return { found: A.sort(found, byLine), unread: O.none() }
}
