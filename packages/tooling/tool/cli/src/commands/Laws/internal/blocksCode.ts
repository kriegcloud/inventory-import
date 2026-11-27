// The blocks of @alchemy.run/domain one file declares, read from its syntax tree: a call of a block's maker, under
// whichever name the file imported it by (`Domain.View(` through `import * as Domain from "@alchemy.run/domain"`, or
// from `"@alchemy.run/domain/index"`, `View(` through `import { View } from "@alchemy.run/domain"`, `View.make(`
// through `import * as View from "@alchemy.run/domain/View"`, `Domain["View"](` or `Domain[\`View\`](` with the
// name written out), a call of `RpcMiddleware.Service` (`effect/rpc/RpcMiddleware`) and of `Context.Service`
// (`effect/Context`, a hand-written port). A callee, and the object of a member, is read through what only wraps it:
// parentheses, `!`, `as`, `satisfies`, `<T>x`, `x<T>` and the last expression of a sequence (`(0, Domain.View)(`).
// Every maker the library's index exports a block by is read (`Model`, `Aggregate`, `Decision`, `Command`, `Event`,
// `Rejection`, `RequestContext`, `Relation` and the eleven the block-files law places); `Sealed` makes a field, not a
// block, and is not. A pattern over the text would also take the words out of a comment, a string or a test's fixture
// text, so the tree is read. It also says whether the file holds anything besides its blocks: a statement at its top
// that is not an import, a declaration of types only, or one that declares a block. What it cannot see: a maker
// passed through a variable of the file's own (`const V = Domain.View`), or reached through a module that re-exports
// it; a type-only import makes nothing and is not read. The walk keeps its own list, so no file nests it past the
// stack.
import { LiteralKit } from "@beep/schema/LiteralKit"
import * as A from "effect/Array"
import * as O from "effect/Option"
import * as P from "effect/Predicate"
import * as R from "effect/Record"
import * as Str from "effect/String"
import { parseSync } from "oxc-parser"
import { linesOf } from "./lines.ts"
import { children, isNode, type Node } from "./tryCode.ts"

/**
 * What a file can declare: the eleven blocks the block-files law places by their ending, the other blocks of the
 * library (a model, an aggregate, a decision, a command, an event, a rejection, a request context, a relation), and a
 * hand-written `Context.Service` port (which takes `.port.ts`).
 */
export const BlockKind = LiteralKit([
  "view",
  "query",
  "projection",
  "stream",
  "policy",
  "saga",
  "external",
  "api",
  "rewrite",
  "compaction",
  "middleware",
  "command",
  "port",
  "model",
  "aggregate",
  "decision",
  "event",
  "rejection",
  "context",
  "relation"
])

/** The decoded value of `BlockKind`. */
export type BlockKind = typeof BlockKind.Type

/**
 * One block a file declares: its kind, its name (the class or constant it is declared under, or, for a block written
 * inside another, such as a view in a model's `views`, the name it gives itself), and its line.
 */
export interface BlockAt {
  readonly kind: BlockKind
  readonly name: O.Option<string>
  readonly line: number
}

/**
 * What reading one file gives: its blocks, whether they are all it holds, or the parser's first complaint when it
 * could not read the file.
 */
export interface BlocksRead {
  readonly found: ReadonlyArray<BlockAt>
  /**
   * Whether every statement at the file's top is an import, a declaration of types only (a type, an interface, a
   * `declare namespace`), a list of names it exports, or one that declares a block: a file that holds nothing else
   * may be renamed to its block's ending, and one with other code beside its blocks keeps its name.
   */
  readonly alone: boolean
  readonly unread: O.Option<string>
}

/** The library's makers by the name the package's index exports them under, which is also their module's name. */
const makers: Readonly<Record<string, BlockKind>> = {
  View: "view",
  Query: "query",
  Projection: "projection",
  Stream: "stream",
  Policy: "policy",
  Saga: "saga",
  ExternalSystem: "external",
  Api: "api",
  Rewrite: "rewrite",
  Compaction: "compaction",
  Command: "command",
  Model: "model",
  Aggregate: "aggregate",
  Decision: "decision",
  Event: "event",
  Rejection: "rejection",
  RequestContext: "context",
  Relation: "relation"
}

/** The modules whose `Service` declares a block: a middleware, or a port. */
const services: Readonly<Record<string, BlockKind>> = {
  "effect/rpc/RpcMiddleware": "middleware",
  "effect/Context": "port"
}

const domain = "@alchemy.run/domain"

const child = (node: Node, key: string): O.Option<Node> => O.liftPredicate(node[key], isNode)
const nameOf = (node: Node, key: string): O.Option<string> =>
  O.flatMap(child(node, key), (found) => O.liftPredicate(found["name"], P.isString))
const stringOf = (node: Node, key: string): O.Option<string> =>
  O.flatMap(child(node, key), (found) => O.liftPredicate(found["value"], P.isString))
const specifiersOf = (node: Node): ReadonlyArray<Node> =>
  A.filter(A.isArray(node["specifiers"]) ? node["specifiers"] : [], isNode)
const typeOnly = (node: Node): boolean => node["importKind"] === "type"
const nodesOf = (node: Node, key: string): ReadonlyArray<Node> =>
  A.filter(A.isArray(node[key]) ? node[key] : [], isNode)

/** Nodes that only wrap the expression inside them, under `expression`: it is what they are. */
const wrappers = [
  "ParenthesizedExpression",
  "TSNonNullExpression",
  "TSAsExpression",
  "TSSatisfiesExpression",
  "TSTypeAssertion",
  "TSInstantiationExpression"
]

/** The expression a wrapper holds, or a sequence's last, which is its value. */
const innerOf = (node: Node): O.Option<Node> =>
  A.contains(wrappers, node.type)
    ? child(node, "expression")
    : node.type === "SequenceExpression"
      ? A.last(nodesOf(node, "expressions"))
      : O.none()

/** What an expression is once every wrapper around it is taken off: `Domain.View` of `(0, Domain.View)!`. */
const unwrapped = (node: Node): Node => {
  let at = node
  let inner = innerOf(at)
  while (O.isSome(inner)) {
    at = inner.value
    inner = innerOf(at)
  }
  return at
}

/** The text a node writes out: a string, or a template with nothing put into it (`\`View\``). */
const textOf = (node: Node): O.Option<string> =>
  node.type === "Literal"
    ? O.liftPredicate(node["value"], P.isString)
    : node.type === "TemplateLiteral" && A.isReadonlyArrayEmpty(nodesOf(node, "expressions"))
      ? O.flatMap(A.head(nodesOf(node, "quasis")), (quasi) =>
          O.flatMap(O.liftPredicate(quasi["value"], P.isObject), (value) =>
            O.liftPredicate(value["cooked"], P.isString)
          )
        )
      : O.none()

/** A module's name with a trailing `/index` taken off: `@alchemy.run/domain` of `@alchemy.run/domain/index`. */
const moduleOf = (from: string): string =>
  Str.endsWith("/index")(from) ? Str.slice(0, from.length - "/index".length)(from) : from

/** How the file's names reach a maker: a namespace and the member that is the maker, or a name that is one. */
interface Bindings {
  /** A namespace's local name, to the members of it that are makers. */
  readonly namespaces: Readonly<Record<string, Readonly<Record<string, BlockKind>>>>
  /** A local name that is a maker itself. */
  readonly names: Readonly<Record<string, BlockKind>>
}

/** The makers a module holds, by member name: the index's makers, a module's own `make`, or a `Service`. */
const membersOf = (written: string): Readonly<Record<string, BlockKind>> => {
  const from = moduleOf(written)
  return from === domain
    ? makers
    : O.match(R.get(services, from), {
        onSome: (kind) => R.singleton("Service", kind),
        onNone: () =>
          O.match(
            A.findFirst(R.toEntries(makers), ([name]) => from === `${domain}/${name}`),
            { onNone: () => R.empty<string, BlockKind>(), onSome: ([, kind]) => R.singleton("make", kind) }
          )
      })
}

/** What one import declaration binds: the members a namespace of its module holds as makers, and each name it imports. */
const bindingsOf = (declaration: Node): Bindings => {
  const members = O.match(stringOf(declaration, "source"), {
    onNone: () => R.empty<string, BlockKind>(),
    onSome: membersOf
  })
  const kept = typeOnly(declaration) ? [] : A.filter(specifiersOf(declaration), (specifier) => !typeOnly(specifier))
  const namespaces = A.flatMap(kept, (specifier) =>
    specifier.type === "ImportNamespaceSpecifier" && R.size(members) > 0
      ? O.toArray(O.map(nameOf(specifier, "local"), (local) => [local, members] as const))
      : []
  )
  const names = A.flatMap(kept, (specifier) =>
    specifier.type === "ImportSpecifier"
      ? O.toArray(
          O.flatMap(
            O.orElse(nameOf(specifier, "imported"), () => stringOf(specifier, "imported")),
            (imported) =>
              O.flatMap(R.get(members, imported), (kind) =>
                O.map(nameOf(specifier, "local"), (local) => [local, kind] as const)
              )
          )
        )
      : []
  )
  return { namespaces: R.fromEntries(namespaces), names: R.fromEntries(names) }
}

/**
 * The member a member expression names: `View` of `Domain.View`, and of `Domain["View"]` or `Domain[\`View\`]` with
 * the name written out.
 */
const memberOf = (callee: Node): O.Option<string> =>
  callee["computed"] === true ? O.flatMap(child(callee, "property"), textOf) : nameOf(callee, "property")

/** The name an expression is, once unwrapped: `Domain` of `(Domain satisfies object)`. */
const identifierOf = (node: Node): O.Option<string> =>
  O.flatMap(
    O.liftPredicate(unwrapped(node), (inner) => inner.type === "Identifier"),
    (inner) => O.liftPredicate(inner["name"], P.isString)
  )

/** The kind a call makes, when its callee, unwrapped, is one of the file's makers. */
const kindOfCall = (call: Node, bindings: Bindings): O.Option<BlockKind> =>
  O.flatMap(O.map(child(call, "callee"), unwrapped), (callee) =>
    callee.type === "Identifier"
      ? O.flatMap(identifierOf(callee), (name) => R.get(bindings.names, name))
      : callee.type === "MemberExpression"
        ? O.flatMap(O.flatMap(child(callee, "object"), identifierOf), (space) =>
            O.flatMap(R.get(bindings.namespaces, space), (members) =>
              O.flatMap(memberOf(callee), (member) => R.get(members, member))
            )
          )
        : O.none()
  )

/** A call's first argument when it is a string written out: the name a block gives itself (`Domain.View("Inline")`). */
const firstText = (call: Node): O.Option<string> =>
  O.flatMap(A.head(A.filter(A.isArray(call["arguments"]) ? call["arguments"] : [], isNode)), (first) =>
    first.type === "Literal" ? O.liftPredicate(first["value"], P.isString) : O.none()
  )

/** The name a node declares for what is under it: a class's own, or a constant's. */
const declaredName = (node: Node): O.Option<string> =>
  node.type === "ClassDeclaration" || node.type === "ClassExpression" || node.type === "VariableDeclarator"
    ? nameOf(node, "id")
    : O.none()

/** Statements that bring names in or declare types only: they hold no code beside a file's blocks. */
const typesOnly = ["ImportDeclaration", "TSTypeAliasDeclaration", "TSInterfaceDeclaration", "EmptyStatement"]

/** Whether a statement at a file's top holds no code: an import, types only, or `export { names }`. */
const holdsNoCode = (statement: Node): boolean =>
  A.contains(typesOnly, statement.type) ||
  (statement.type === "TSModuleDeclaration" && statement["declare"] === true) ||
  (statement.type === "ExportNamedDeclaration" &&
    O.match(child(statement, "declaration"), {
      onNone: () => O.isNone(child(statement, "source")),
      onSome: holdsNoCode
    }))

/**
 * Every block `source` declares, in the order written, or why it could not be read.
 *
 * @example readBlocks({ file: "a.ts", source: 'import * as Domain from "@alchemy.run/domain"\nexport class V extends Domain.View("V", {}) {}' }).found // [{ kind: "view", name: Some("V"), line: 2 }]
 */
export const readBlocks = (input: { readonly file: string; readonly source: string }): BlocksRead => {
  const parsed = parseSync(input.file, input.source)
  const complaint = A.head(A.map(parsed.errors, (error) => error.message))
  if (O.isSome(complaint) || !isNode(parsed.program)) {
    return { found: [], alone: false, unread: O.orElse(complaint, () => O.some("it is not a module")) }
  }
  const program = parsed.program
  const body = A.filter(A.isArray(program["body"]) ? program["body"] : [], isNode)
  const declarations = A.filter(body, (statement) => statement.type === "ImportDeclaration")
  const bound = A.map(declarations, bindingsOf)
  const bindings: Bindings = {
    namespaces: A.reduce(bound, R.empty<string, Readonly<Record<string, BlockKind>>>(), (all, one) => ({
      ...all,
      ...one.namespaces
    })),
    names: A.reduce(bound, R.empty<string, BlockKind>(), (all, one) => ({ ...all, ...one.names }))
  }
  const line = linesOf(input.source)
  const found: Array<BlockAt> = []
  // Where each block's call starts, to tell a statement that declares a block from one that holds other code.
  const starts: Array<number> = []
  // Which class or constant has given its name to a block: the first block under it takes its name, and a block
  // written inside another (a view inside a model's `views`) takes the name it gives itself.
  const named: Array<number> = []
  let declared = 0
  // Each node with the name of the nearest class or constant around it, visited once, from a list of its own, in
  // the order written: a node's children go on the list last first, and the list is taken from its end.
  const left: Array<{ readonly node: Node; readonly name: O.Option<string>; readonly scope: number }> = [
    { node: program, name: O.none(), scope: 0 }
  ]
  while (A.isArrayNonEmpty(left)) {
    const { node, name, scope: around } = A.lastNonEmpty(left)
    left.pop()
    const own = declaredName(node)
    if (O.isSome(own)) declared += 1
    const here = O.orElse(own, () => name)
    const scope = O.isSome(own) ? declared : around
    if (node.type === "CallExpression") {
      const kind = kindOfCall(node, bindings)
      if (O.isSome(kind)) {
        starts.push(node.start)
        const first = O.isSome(here) && !A.contains(named, scope)
        if (first) named.push(scope)
        found.push({
          kind: kind.value,
          name: first ? here : O.orElse(firstText(node), () => here),
          line: line(node.start)
        })
      }
    }
    for (const next of A.reverse(children(node))) left.push({ node: next, name: here, scope })
  }
  const alone = A.every(
    body,
    (statement) =>
      holdsNoCode(statement) || A.some(starts, (start) => start >= statement.start && start < statement.end)
  )
  return { found, alone, unread: O.none() }
}
