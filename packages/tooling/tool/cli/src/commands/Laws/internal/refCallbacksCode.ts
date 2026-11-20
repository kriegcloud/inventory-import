// The refs of one screen, read from its syntax tree: each `ref` an element is given, each function handed to
// `useAtomSubscribe`, and whether it is the same value on every draw. The tree is the parser's plain data, read here as
// records of unknown values. A name is judged by where the file binds it, never by how its line is written.
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

/** How a file binds a name. */
type Binding =
  /**
   * At the file's top level, or imported: made once. `hooks` says it is imported from a module of hooks
   * (`isHookModule`), `fn` is the function a top-level declaration is, `reassigned` says a function sets the name
   * again (a `let` that holds what the last draw gave it is made on every draw all the same), and `filled` says a
   * function writes into what it holds (`refs[id] ??= …`): a cache by hand, whose entries a draw made.
   */
  | {
      readonly kind: "module"
      readonly hooks: boolean
      readonly fn: O.Option<Node>
      readonly reassigned: boolean
      readonly filled: boolean
    }
  /** A parameter of a function (a component's props), or a name taken out of one in the parameter list. */
  | { readonly kind: "param"; readonly prop: O.Option<string> }
  /**
   * The first parameter of a function handed to a list's `map`, `forEach`, `filter` or their kin: one element of
   * `list`, which is read in `listScopes`, the scopes the call is written in. `prop` is the key it is taken out by.
   */
  | {
      readonly kind: "element"
      readonly list: Node
      readonly listScopes: ReadonlyArray<Scope>
      readonly prop: O.Option<string>
    }
  /** A function declared inside another function: made again each time that one runs. */
  | { readonly kind: "inner-function" }
  /** A `const`, `let` or `var` inside a function: `init` is what it is given, `prop` the key when it is taken out of it. */
  | { readonly kind: "inner"; readonly init: O.Option<Node>; readonly prop: O.Option<string> }

/** The names one function (or the file) binds. */
type Scope = Readonly<Record<string, Binding>>

/** The names a pattern binds, each with the key it is taken out by when the pattern takes an object apart. */
const namesIn = (pattern: Node): ReadonlyArray<{ readonly name: string; readonly prop: O.Option<string> }> => {
  if (pattern.type === "Identifier") return [{ name: nameOf(pattern), prop: O.none() }]
  if (pattern.type === "AssignmentPattern")
    return O.match(child(pattern, "left"), { onNone: () => [], onSome: namesIn })
  if (pattern.type === "RestElement") {
    return O.match(child(pattern, "argument"), { onNone: () => [], onSome: namesIn })
  }
  if (pattern.type === "ArrayPattern") return A.flatMap(nodes(pattern["elements"]), namesIn)
  if (pattern.type === "ObjectPattern") {
    return A.flatMap(nodes(pattern["properties"]), (property) => {
      if (property.type === "RestElement") return namesIn(property)
      const key = O.map(child(property, "key"), nameOf)
      return O.match(child(property, "value"), {
        onNone: () => [],
        onSome: (value) => A.map(namesIn(value), (found) => ({ name: found.name, prop: key }))
      })
    })
  }
  // `(props: Props)` with a type, as the parser wraps a parameter that has an accessibility modifier.
  return O.match(child(pattern, "parameter"), { onNone: () => [], onSome: namesIn })
}

/** Every node of a function's body, not looking inside the functions written in it, that `keep` holds. */
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

/** Every declaration a function's body holds, not looking inside the functions written in it. */
const declarationsIn = (body: Node): ReadonlyArray<Node> =>
  ownNodes(body, (node) => typeIs(node, "VariableDeclaration", "FunctionDeclaration"))

const bind = (entries: ReadonlyArray<readonly [string, Binding]>): Scope => R.fromEntries(entries)

/** A list a function is handed to as the callback of its `map` (or kin), and the scopes that call is written in. */
interface ElementOf {
  readonly list: Node
  readonly listScopes: ReadonlyArray<Scope>
}

/** What one function binds: its parameters (the first an element of the list it maps over), and what its body declares. */
const scopeOf = (fn: Node, element: O.Option<ElementOf> = O.none()): Scope =>
  bind([
    ...A.flatMap(nodes(fn["params"]), (param, index) =>
      A.map(namesIn(param), (found): readonly [string, Binding] =>
        index === 0 && O.isSome(element)
          ? [
              found.name,
              { kind: "element", list: element.value.list, listScopes: element.value.listScopes, prop: found.prop }
            ]
          : [found.name, { kind: "param", prop: found.prop }]
      )
    ),
    ...O.match(child(fn, "body"), {
      onNone: () => [],
      onSome: (body) =>
        A.flatMap(declarationsIn(body), (declaration): ReadonlyArray<readonly [string, Binding]> => {
          if (declaration.type === "FunctionDeclaration") {
            return O.match(child(declaration, "id"), {
              onNone: () => [],
              onSome: (id) => [[nameOf(id), { kind: "inner-function" }] as const]
            })
          }
          return A.flatMap(nodes(declaration["declarations"]), (declarator) =>
            O.match(child(declarator, "id"), {
              onNone: () => [],
              onSome: (id) =>
                A.map(
                  namesIn(id),
                  (found) => [found.name, { kind: "inner", init: child(declarator, "init"), prop: found.prop }] as const
                )
            })
          )
        })
    })
  ])

/** The value under the wrappers that do not change it: a type assertion, a non-null mark, parentheses. */
const unwrapped = (node: Node): Node =>
  typeIs(
    node,
    "TSAsExpression",
    "TSNonNullExpression",
    "TSSatisfiesExpression",
    "TSTypeAssertion",
    "ParenthesizedExpression"
  )
    ? O.match(child(node, "expression"), { onNone: () => node, onSome: unwrapped })
    : node

/** A member read (`a.b.c`): the name it starts from and each property after it. */
const memberOf = (node: Node): O.Option<{ readonly root: Node; readonly path: ReadonlyArray<string> }> => {
  if (node.type !== "MemberExpression") return O.none()
  const property = O.getOrElse(O.map(child(node, "property"), nameOf), () => "")
  return O.flatMap(child(node, "object"), (object) => {
    const inner = unwrapped(object)
    return inner.type === "MemberExpression"
      ? O.map(memberOf(inner), (found) => ({ root: found.root, path: A.append(found.path, property) }))
      : O.some({ root: inner, path: [property] })
  })
}

/** What a scope chain says of a name, with the depth of the scope that binds it (0 is the file's top level). */
const lookUpAt = (
  scopes: ReadonlyArray<Scope>,
  name: string
): O.Option<{ readonly binding: Binding; readonly at: number }> =>
  O.flatMap(
    A.findLastIndex(scopes, (scope) => R.has(scope, name)),
    (at) =>
      O.flatMap(O.fromUndefinedOr(scopes[at]), (scope) => O.map(R.get(scope, name), (binding) => ({ binding, at })))
  )

const lookUp = (scopes: ReadonlyArray<Scope>, name: string): O.Option<Binding> =>
  O.map(lookUpAt(scopes, name), (found) => found.binding)

/** The name a call is made by: `useRef` in `useRef(null)` and in `React.useRef(null)`. */
const calleeName = (callee: Node): string =>
  callee.type === "MemberExpression" ? O.getOrElse(O.map(child(callee, "property"), nameOf), () => "") : nameOf(callee)

const namedAsHook = (name: string): boolean => /^use[A-Z0-9]/.test(name)

/** The modules whose `use…` exports are hooks wherever they are imported: React's and the atoms' bindings. */
const hookLibraries = ["react", "react-dom", "@effect/atom-react"]

/**
 * The modules whose `use…` exports are hooks: React's, the atoms' bindings, a module the repository names as one of
 * hooks (`hookModules`, each by its exact specifier: the vendored kit's hooks, a package's `*.hook.ts` export), and a
 * file of ours named `*.hook.ts` imported by its path. A `use…` name from anywhere else, a module that merely sits in
 * a `hooks` or `components` folder among them, is only a name: what it gives is judged as any other call's answer.
 */
const isHookModule =
  (hookModules: ReadonlyArray<string>) =>
  (source: string): boolean =>
    A.contains(hookLibraries, source) ||
    A.contains(hookModules, source) ||
    (Str.startsWith(".")(source) && /\.hook(\.tsx?)?$/.test(source))

/**
 * True for a call of a hook (`useRef(null)`, `useAtomValue(scope)`, `React.useRef()`, `AtomReact.useAtomValue(x)`): a
 * `use…` name imported, by name or through a namespace, from a module of hooks. What it holds, it holds across draws.
 */
const isHookCall = (node: Node, scopes: ReadonlyArray<Scope>): boolean =>
  node.type === "CallExpression" &&
  O.exists(child(node, "callee"), (called) => {
    const callee = unwrapped(called)
    if (!namedAsHook(calleeName(callee))) return false
    const root = callee.type === "MemberExpression" ? O.map(memberOf(callee), (found) => found.root) : O.some(callee)
    return O.exists(
      root,
      (name) =>
        name.type === "Identifier" &&
        O.exists(lookUp(scopes, nameOf(name)), (binding) => binding.kind === "module" && binding.hooks)
    )
  })

/** What a value handed to a ref (or to a subscription) is: steady, a prop the caller decides, or refused with why. */
type Verdict =
  | { readonly kind: "steady" }
  | { readonly kind: "prop"; readonly name: string }
  | { readonly kind: "refused"; readonly why: string }

const steady: Verdict = { kind: "steady" }
const refused = (why: string): Verdict => ({ kind: "refused", why })

/** How many names deep a value is followed; past it, nothing is shown steady, so it is refused. */
const maxDepth = 8
const tooDeep = refused(`followed more than ${maxDepth} names deep: hand the ref a name the file binds nearer to it`)

/** The list methods whose callback is given one element at a time: `rows.map(fn)` and `A.map(rows, fn)`. */
const iterators = [
  "map",
  "flatMap",
  "forEach",
  "filter",
  "filterMap",
  "find",
  "findFirst",
  "findLast",
  "findIndex",
  "findLastIndex",
  "some",
  "every"
]

/** The callback a call hands each element of a list to, and that list: `rows.map(fn)` and `A.map(rows, fn)`. */
const elementCallback = (call: Node): O.Option<{ readonly fn: Node; readonly list: Node }> => {
  if (call.type !== "CallExpression") return O.none()
  return O.flatMap(child(call, "callee"), (called) => {
    const callee = unwrapped(called)
    if (callee.type !== "MemberExpression" || !A.contains(iterators, calleeName(callee))) return O.none()
    const [first, second] = nodes(call["arguments"])
    if (first !== undefined && isFunction(first)) {
      return O.map(child(callee, "object"), (list) => ({ fn: first, list }))
    }
    return first !== undefined && second !== undefined && isFunction(second)
      ? O.some({ fn: second, list: first })
      : O.none()
  })
}

/** Judges a value in the scopes it is written in, innermost last. */
const judge = (value: Node, scopes: ReadonlyArray<Scope>, depth = 0): Verdict => {
  const node = unwrapped(value)
  if (typeIs(node, "ArrowFunctionExpression", "FunctionExpression")) {
    return refused("a function written where it is handed over is a new function on every draw")
  }
  if (typeIs(node, "ConditionalExpression", "LogicalExpression")) {
    return refused("a ref switched on and off by a condition is an effect on that condition under another name")
  }
  if (node.type === "CallExpression") return judgeCall(node, scopes, depth)
  if (node.type === "Literal" || (node.type === "Identifier" && nameOf(node) === "undefined")) return steady
  if (node.type === "ThisExpression") return steady
  const named = (name: string, path: ReadonlyArray<string>): Verdict =>
    O.match(lookUpAt(scopes, name), {
      // Not bound in the file: a global.
      onNone: () => steady,
      onSome: ({ at, binding }): Verdict => {
        if (binding.kind === "module") {
          if (binding.reassigned) {
            return refused(`${name} is a module variable a function sets again: it holds what the last draw gave it`)
          }
          return binding.filled
            ? refused(`${name} is a module record a function fills in place: a cache by hand, holding what a draw made`)
            : steady
        }
        if (binding.kind === "inner-function") {
          return refused(`${name} is a function declared inside the component: made again on every draw`)
        }
        if (binding.kind === "param") {
          // What a caller hands down is the caller's to keep steady, at any depth: every place that hands it is judged.
          const prop = O.getOrElse(binding.prop, () => path[0] ?? "")
          return O.isSome(binding.prop) || A.isReadonlyArrayNonEmpty(path) ? { kind: "prop", name: prop } : steady
        }
        if (depth > maxDepth) return tooDeep
        if (binding.kind === "element") {
          // One element of a list is as steady as the list: a list made in the draw makes what it holds in the draw.
          const from = judge(binding.list, binding.listScopes, depth + 1)
          return from.kind === "refused" ? refused(`${name} is an element of a list: ${from.why}`) : from
        }
        if (O.isNone(binding.init)) return refused(`${name} is declared inside the component with no value`)
        const init = unwrapped(binding.init.value)
        // What it is given is read where it is declared.
        const where = A.take(scopes, at + 1)
        if (isHookCall(init, where)) {
          // A ref object's `.current` is what it held when the draw read it; `useRef` is for a DOM node, never a
          // function kept across draws by hand.
          const current = A.contains(path, "current") || O.exists(binding.prop, (prop) => prop === "current")
          return current
            ? refused(`${name} reads .current of a useRef during the draw: useRef holds a DOM node, never a function`)
            : steady
        }
        // Another name for something else (`const actions = props.actions`, `const { attach } = region`).
        if (typeIs(init, "Identifier", "MemberExpression")) {
          const from = judge(init, where, depth + 1)
          // Taken out of the props: the prop's own name is the one a caller writes.
          return from.kind === "prop" && O.isSome(binding.prop) && init.type === "Identifier"
            ? { kind: "prop", name: binding.prop.value }
            : from
        }
        if (typeIs(init, "ArrowFunctionExpression", "FunctionExpression")) {
          return refused(`${name} is a function made inside the component: a new one on every draw`)
        }
        if (init.type === "ObjectExpression") {
          return refused(`${name} is an object made inside the component: what it holds is new on every draw`)
        }
        if (init.type === "CallExpression" && isLocalHelperCall(init, where)) {
          const from = judgeCall(init, where, depth + 1)
          return from.kind === "refused" ? refused(`${name} is given ${from.why}`) : from
        }
        return refused(`${name} is made inside the component from a call or an expression, again on every draw`)
      }
    })
  if (node.type === "Identifier") return named(nameOf(node), [])
  return O.match(memberOf(node), {
    onNone: () => refused("not a name: give the ref a module-level function, or one an atom or a hook holds"),
    onSome: ({ path, root }) =>
      root.type === "Identifier"
        ? named(nameOf(root), path)
        : root.type === "ThisExpression"
          ? steady
          : judge(root, scopes, depth + 1)
  })
}

/** The function this file declares at its top level that a call calls by name, if it does. */
const localFunction = (call: Node, scopes: ReadonlyArray<Scope>): O.Option<Node> =>
  O.flatMap(child(call, "callee"), (called) => {
    const callee = unwrapped(called)
    if (callee.type !== "Identifier") return O.none()
    return O.flatMap(lookUp(scopes, nameOf(callee)), (binding) => (binding.kind === "module" ? binding.fn : O.none()))
  })

/** True for a call, by a `use…` name, of a function this file declares: what it returns is judged where it is written. */
const isLocalHelperCall = (call: Node, scopes: ReadonlyArray<Scope>): boolean =>
  O.exists(child(call, "callee"), (callee) => namedAsHook(calleeName(unwrapped(callee)))) &&
  O.isSome(localFunction(call, scopes))

/**
 * Judges a call's answer. A hook's holds across draws. Anything else answers anew on every draw, a function named
 * `use…` that is not a hook among them: one this file declares is judged by what it returns.
 */
const judgeCall = (call: Node, scopes: ReadonlyArray<Scope>, depth: number): Verdict => {
  if (isHookCall(call, scopes)) return steady
  const name = O.getOrElse(
    O.map(child(call, "callee"), (callee) => calleeName(unwrapped(callee))),
    () => ""
  )
  if (!namedAsHook(name)) {
    return refused("a call makes its answer again on every draw (a function returned from a call, `.bind`)")
  }
  return O.match(localFunction(call, scopes), {
    onNone: () =>
      refused(
        `${name} is named as a hook but is not one from react, @effect/atom-react or a module of hooks: its answer is new on every draw`
      ),
    onSome: (fn) => {
      const from = depth > maxDepth ? tooDeep : judgeReturns(fn, scopes, depth + 1)
      return from.kind === "refused" ? refused(`${name} is not a hook, and what it returns: ${from.why}`) : from
    }
  })
}

/** Judges what a function this file declares returns, in its own scope over the file's top level. */
const judgeReturns = (fn: Node, scopes: ReadonlyArray<Scope>, depth: number): Verdict => {
  const own = A.append(A.take(scopes, 1), scopeOf(fn))
  const answers = O.match(child(fn, "body"), {
    onNone: () => [],
    onSome: (body) =>
      body.type === "BlockStatement"
        ? A.flatMap(
            ownNodes(body, (node) => node.type === "ReturnStatement"),
            (returned) => O.toArray(child(returned, "argument"))
          )
        : [body]
  })
  const verdicts = A.map(answers, (answer) => judge(answer, own, depth))
  const first = O.getOrElse(
    A.findFirst(verdicts, (verdict) => verdict.kind !== "steady"),
    () => steady
  )
  return first.kind === "prop" ? refused("it hands back what it is given") : first
}

/** What functions do to the names of the file's top level: set them again, or write into what they hold. */
interface Written {
  readonly reassigned: ReadonlyArray<string>
  readonly filled: ReadonlyArray<string>
}

/**
 * The names the file's top level binds, each with whether it is imported from a module of hooks or the function it
 * declares, and what functions do to it.
 */
const topLevel = (program: Node, written: Written, hookModules: ReadonlyArray<string>): Scope =>
  bind(
    A.flatMap(nodes(program["body"]), (statement): ReadonlyArray<readonly [string, Binding]> => {
      const declared = O.getOrElse(child(statement, "declaration"), () => statement)
      const filled = (name: string): boolean => A.contains(written.filled, name)
      if (declared.type === "ImportDeclaration") {
        const source = O.flatMap(child(declared, "source"), (literal) => O.liftPredicate(literal["value"], P.isString))
        const hooks = O.exists(source, isHookModule(hookModules))
        return A.map(nodes(declared["specifiers"]), (specifier) => {
          const name = O.getOrElse(O.map(child(specifier, "local"), nameOf), () => "")
          return [name, { kind: "module", hooks, fn: O.none(), reassigned: false, filled: filled(name) }] as const
        })
      }
      if (declared.type === "VariableDeclaration") {
        const constant = declared["kind"] === "const"
        return A.flatMap(nodes(declared["declarations"]), (declarator) =>
          O.match(child(declarator, "id"), {
            onNone: () => [],
            onSome: (id) =>
              A.map(namesIn(id), (found): readonly [string, Binding] => [
                found.name,
                {
                  kind: "module",
                  hooks: false,
                  fn: O.filter(O.map(child(declarator, "init"), unwrapped), isFunction),
                  reassigned: !constant && A.contains(written.reassigned, found.name),
                  filled: filled(found.name)
                }
              ])
          })
        )
      }
      return O.match(child(declared, "id"), {
        onNone: () => [],
        onSome: (id) => [
          [
            nameOf(id),
            {
              kind: "module",
              hooks: false,
              fn: O.liftPredicate(declared, isFunction),
              reassigned: false,
              filled: filled(nameOf(id))
            }
          ] as const
        ]
      })
    })
  )

/** The name a member write starts from: `refs` in `refs[id] = …`, `refs.a.b ??= …` and `delete refs[id]`. */
const rootOf = (target: Node): O.Option<string> => {
  const node = unwrapped(target)
  if (node.type === "Identifier") return O.some(nameOf(node))
  return node.type === "MemberExpression" ? O.flatMap(child(node, "object"), rootOf) : O.none()
}

/** The calls that write into the object they are handed first: `Object.assign(refs, { [id]: fn })` and its kin. */
const writesInto = [
  "Object.assign",
  "Object.defineProperty",
  "Object.defineProperties",
  "Reflect.set",
  "Reflect.defineProperty"
]

/** The name a call is made by, with what it is called on: `Object.assign` in `Object.assign(refs, …)`. */
const calledPath = (callee: Node): string =>
  O.getOrElse(
    O.map(memberOf(unwrapped(callee)), ({ path, root }) => A.join([nameOf(root), ...path], ".")),
    () => nameOf(unwrapped(callee))
  )

/** How many other names a write is followed through to the top-level name it writes into. */
const maxAliases = 8

/**
 * The top-level name a name inside a function stands for: itself when the file's top level binds it, or what another
 * name of the function was given (`const r = refs`, `const { inner } = refs`), followed to the top.
 */
const topNameOf = (name: string, scopes: ReadonlyArray<Scope>, depth = 0): O.Option<string> =>
  O.flatMap(lookUpAt(scopes, name), ({ at, binding }) => {
    if (at === 0) return O.some(name)
    if (binding.kind !== "inner" || depth > maxAliases) return O.none()
    return O.flatMap(O.flatMap(binding.init, rootOf), (other) => topNameOf(other, A.take(scopes, at + 1), depth + 1))
  })

/**
 * The top level's other names for one another: `const r = refs` makes `r` and `refs` one record, so a write into
 * either fills both.
 */
const topAliases = (program: Node): ReadonlyArray<readonly [string, string]> =>
  A.flatMap(nodes(program["body"]), (statement) => {
    const declared = O.getOrElse(child(statement, "declaration"), () => statement)
    if (declared.type !== "VariableDeclaration") return []
    return A.flatMap(nodes(declared["declarations"]), (declarator) =>
      O.match(child(declarator, "init"), {
        onNone: () => [],
        onSome: (init) =>
          O.match(rootOf(init), {
            onNone: () => [],
            onSome: (other) =>
              O.match(child(declarator, "id"), {
                onNone: () => [],
                onSome: (id) => A.map(namesIn(id), ({ name }) => [name, other] as const)
              })
          })
      })
    )
  })

/** Every name `filled` names, with each top-level name that is another name for one of them. */
const withAliases = (filled: ReadonlyArray<string>, aliases: ReadonlyArray<readonly [string, string]>) => {
  const grow = (names: ReadonlyArray<string>, rounds: number): ReadonlyArray<string> => {
    const next = A.dedupe(
      A.appendAll(
        names,
        A.flatMap(aliases, ([name, other]) =>
          A.contains(names, name) ? [other] : A.contains(names, other) ? [name] : []
        )
      )
    )
    return next.length === names.length || rounds <= 0 ? next : grow(next, rounds - 1)
  }
  return grow(A.dedupe(filled), aliases.length)
}

/**
 * What the functions of a file do to its top level's names: assign one again (`current = next`, `count++`), or write
 * into what one holds (`refs[id] = …`, `refs[id] ??= …`, `refs.count++`, `delete refs[id]`,
 * `Object.assign(refs, { [id]: fn })`), directly or through another name for it (`const r = refs; r[id] ??= fn`).
 */
const writtenInFunctions = (program: Node, top: Scope): Written => {
  const reassigned: Array<string> = []
  const filled: Array<string> = []
  const visit = (node: Node, scopes: ReadonlyArray<Scope>): void => {
    const here = isFunction(node) ? A.append(scopes, scopeOf(node)) : scopes
    const atTop = (name: string): boolean => O.exists(lookUpAt(here, name), (bound) => bound.at === 0)
    const fill = (target: Node): void => {
      for (const name of O.toArray(O.flatMap(rootOf(target), (root) => topNameOf(root, here)))) filled.push(name)
    }
    const deleted = node.type === "UnaryExpression" && node["operator"] === "delete"
    if (here.length > 1 && (deleted || typeIs(node, "AssignmentExpression", "UpdateExpression"))) {
      const target = child(node, node.type === "AssignmentExpression" ? "left" : "argument")
      const member = O.exists(target, (left) => unwrapped(left).type === "MemberExpression")
      if (member) {
        for (const left of O.toArray(target)) fill(left)
      } else {
        for (const { name } of O.match(target, { onNone: () => [], onSome: (left) => namesIn(unwrapped(left)) })) {
          if (atTop(name)) reassigned.push(name)
        }
      }
    }
    if (
      here.length > 1 &&
      node.type === "CallExpression" &&
      O.exists(child(node, "callee"), (callee) => A.contains(writesInto, calledPath(callee)))
    ) {
      for (const first of A.take(nodes(node["arguments"]), 1)) fill(first)
    }
    for (const next of children(node)) visit(next, here)
  }
  visit(program, [top])
  return { reassigned, filled: withAliases(filled, topAliases(program)) }
}

/** One place a screen hands a value over: where, what it is handed as, and the verdict. */
export interface Handed {
  readonly line: number
  /** `ref`, the name of another attribute, or `useAtomSubscribe`. */
  readonly as: string
  readonly verdict: Verdict
}

/** What one screen's tree says: every ref and subscription judged, and every other attribute, for a second look. */
export interface ScreenRefs {
  /** Each `ref` attribute and each function handed to `useAtomSubscribe`. */
  readonly refs: ReadonlyArray<Handed>
  /** Every other attribute given a value in braces: judged only if its name turns out to be handed down to a ref. */
  readonly attributes: ReadonlyArray<Handed>
}

/**
 * Reads one screen. A file the parser cannot read gives nothing: the type-check says so, with the line. `hookModules`
 * names, each by its exact specifier, the modules of the repository whose `use…` exports are hooks besides React's
 * and the atoms' (`@inventory/ui/hooks/use-data-table`).
 *
 * @example readScreen({ file: "List.tsx", source: "const List = () => <p ref={(node) => node?.focus()} />" }).refs[0]?.verdict.kind // "refused"
 */
export const readScreen = (input: {
  readonly file: string
  readonly source: string
  readonly hookModules?: ReadonlyArray<string>
}): ScreenRefs => {
  const { file, source } = input
  const hookModules = input.hookModules ?? []
  const parsed = parseSync(file, source)
  const program: unknown = parsed.program
  if (!isNode(program)) return { refs: [], attributes: [] }
  const starts = A.reduce(Str.split("\n")(source), [0], (offsets, line) =>
    A.append(offsets, (offsets[offsets.length - 1] ?? 0) + line.length + 1)
  )
  const lineAt = (offset: number): number => A.filter(starts, (start) => start <= offset).length
  const top = topLevel(
    program,
    writtenInFunctions(program, topLevel(program, { reassigned: [], filled: [] }, hookModules)),
    hookModules
  )
  const refs: Array<Handed> = []
  const attributes: Array<Handed> = []
  const walk = (node: Node, scopes: ReadonlyArray<Scope>, element: O.Option<ElementOf>): void => {
    const here = isFunction(node) ? A.append(scopes, scopeOf(node, element)) : scopes
    if (node.type === "JSXAttribute") {
      const as = O.getOrElse(O.map(child(node, "name"), nameOf), () => "")
      const held = O.flatMap(child(node, "value"), (value) =>
        value.type === "JSXExpressionContainer" ? child(value, "expression") : O.none()
      )
      if (O.isSome(held) && held.value.type !== "JSXEmptyExpression") {
        const handed = { line: lineAt(node.start), as, verdict: judge(held.value, here) }
        if (as === "ref") refs.push(handed)
        else attributes.push(handed)
      }
    }
    // `useAtomSubscribe(atom, fn)` and `AtomReact.useAtomSubscribe(atom, fn)` alike.
    if (
      node.type === "CallExpression" &&
      O.exists(child(node, "callee"), (callee) => calleeName(unwrapped(callee)) === "useAtomSubscribe")
    ) {
      const heard = nodes(node["arguments"])[1]
      if (heard !== undefined) {
        refs.push({ line: lineAt(heard.start), as: "useAtomSubscribe", verdict: judge(heard, here) })
      }
    }
    const callback = elementCallback(node)
    for (const next of children(node)) {
      walk(
        next,
        here,
        O.flatMap(callback, ({ fn, list }) => (fn === next ? O.some({ list, listScopes: here }) : O.none()))
      )
    }
  }
  walk(program, [top], O.none())
  return { refs, attributes }
}
