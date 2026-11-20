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
   * (`isHookModule`), `fn` is the function a top-level declaration is, `init` what a declaration gives it and `prop`
   * the key it is taken out by, `reassigned` says a function sets the name again (a `let` that holds what the last
   * draw gave it is made on every draw all the same), and `filled` holds each place under it a function writes into
   * (`refs[id] ??= …` writes into the whole record, `[]`; `big.a[id] = …` into `["a"]`): a cache by hand, whose
   * entries a draw made.
   */
  | {
      readonly kind: "module"
      readonly hooks: boolean
      readonly fn: O.Option<Node>
      readonly init: O.Option<Node>
      readonly prop: O.Option<string>
      readonly reassigned: boolean
      readonly filled: ReadonlyArray<ReadonlyArray<string>>
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
  /**
   * A `const`, `let` or `var` inside a function: `init` is what it is given, `prop` the key when it is taken out of it,
   * `also` what the function assigns it afterwards (`r = refs`).
   */
  | {
      readonly kind: "inner"
      readonly init: O.Option<Node>
      readonly prop: O.Option<string>
      readonly also: ReadonlyArray<Node>
    }

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
const scopeOf = (fn: Node, element: O.Option<ElementOf> = O.none()): Scope => {
  // What the function assigns its own names after declaring them: `r = refs` makes `r` another name for `refs`.
  const assignments = O.match(child(fn, "body"), {
    onNone: (): ReadonlyArray<Node> => [],
    onSome: (body) =>
      ownNodes(
        body,
        (node) =>
          node.type === "AssignmentExpression" &&
          O.exists(O.map(child(node, "left"), unwrapped), (left) => left.type === "Identifier")
      )
  })
  const assignedTo = (name: string): ReadonlyArray<Node> =>
    A.flatMap(assignments, (assignment) =>
      O.exists(O.map(child(assignment, "left"), unwrapped), (left) => nameOf(left) === name)
        ? O.toArray(child(assignment, "right"))
        : []
    )
  return bind([
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
                  (found) =>
                    [
                      found.name,
                      {
                        kind: "inner",
                        init: child(declarator, "init"),
                        prop: found.prop,
                        also: assignedTo(found.name)
                      }
                    ] as const
                )
            })
          )
        })
    })
  ])
}

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
  // The place read under its name, as far as its keys are written out: `["lead"]` in `b.lead`, `[]` in `refs[id]`.
  const readPath = O.getOrElse(
    O.map(A.head(placesOf(node)), (place) => place.path),
    (): ReadonlyArray<string> => []
  )
  const named = (name: string, path: ReadonlyArray<string>): Verdict =>
    O.match(lookUpAt(scopes, name), {
      // Not bound in the file: a global.
      onNone: () => steady,
      onSome: ({ at, binding }): Verdict => {
        if (binding.kind === "module") {
          if (binding.reassigned) {
            return refused(`${name} is a module variable a function sets again: it holds what the last draw gave it`)
          }
          // Only a write into the place read, or into what holds it, or under it: `a[id] = …` leaves `b.lead` alone.
          return A.some(binding.filled, (written) => overlaps(written, readPath))
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

/**
 * What functions do to the names of the file's top level: set them again, or write into what they hold (`filledAt`:
 * each place under a name a function writes into, `[]` for the whole of it).
 */
interface Written {
  readonly reassigned: ReadonlyArray<string>
  readonly filledAt: (name: string) => ReadonlyArray<ReadonlyArray<string>>
}

/**
 * The names the file's top level binds, each with whether it is imported from a module of hooks or the function it
 * declares, and what functions do to it.
 */
const topLevel = (program: Node, written: Written, hookModules: ReadonlyArray<string>): Scope =>
  bind(
    A.flatMap(nodes(program["body"]), (statement): ReadonlyArray<readonly [string, Binding]> => {
      const declared = O.getOrElse(child(statement, "declaration"), () => statement)
      const filled = written.filledAt
      if (declared.type === "ImportDeclaration") {
        const source = O.flatMap(child(declared, "source"), (literal) => O.liftPredicate(literal["value"], P.isString))
        const hooks = O.exists(source, isHookModule(hookModules))
        return A.map(nodes(declared["specifiers"]), (specifier) => {
          const name = O.getOrElse(O.map(child(specifier, "local"), nameOf), () => "")
          return [
            name,
            {
              kind: "module",
              hooks,
              fn: O.none(),
              init: O.none(),
              prop: O.none(),
              reassigned: false,
              filled: filled(name)
            }
          ] as const
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
                  init: child(declarator, "init"),
                  prop: found.prop,
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
              init: O.none(),
              prop: O.none(),
              reassigned: false,
              filled: filled(nameOf(id))
            }
          ] as const
        ]
      })
    })
  )

/**
 * A place a value is read from or written into: the name it starts from and the keys after it, as far as they are
 * written out. `open` says a key after them is not (`refs[id]`, `big[k].x`): what is past it may be any place.
 */
interface Place {
  readonly root: string
  readonly path: ReadonlyArray<string>
  readonly open: boolean
}

/** A member's key when it is written out: `a` in `x.a`, `"a"` in `x["a"]`, `0` in `x[0]`; none in `x[id]`. */
const writtenKey = (member: Node): O.Option<string> =>
  member["computed"] === true
    ? O.flatMap(child(member, "property"), (key) =>
        key.type === "Literal" && (P.isString(key["value"]) || P.isNumber(key["value"]))
          ? O.some(`${key["value"]}`)
          : O.none()
      )
    : O.map(child(member, "property"), nameOf)

/**
 * The places a value stands for: a name (`refs`), a member read (`big.a`, `Object["assign"]`, `refs[id]`), either
 * side of `??`, `||` and `&&` (`refs ?? {}`), and either branch of a choice. Anything else is a value made there.
 */
const placesOf = (value: Node): ReadonlyArray<Place> => {
  const node = value.type === "ChainExpression" ? O.getOrElse(child(value, "expression"), () => value) : value
  const bare = unwrapped(node)
  if (bare !== node || node !== value) return placesOf(bare)
  const of = (key: string): ReadonlyArray<Place> => O.match(child(bare, key), { onNone: () => [], onSome: placesOf })
  if (bare.type === "Identifier") return [{ root: nameOf(bare), path: [], open: false }]
  if (bare.type === "LogicalExpression") return A.appendAll(of("left"), of("right"))
  if (bare.type === "ConditionalExpression") return A.appendAll(of("consequent"), of("alternate"))
  if (bare.type !== "MemberExpression") return []
  return A.map(of("object"), (place) =>
    place.open
      ? place
      : O.match(writtenKey(bare), {
          onNone: () => ({ ...place, open: true }),
          onSome: (key) => ({ ...place, path: A.append(place.path, key) })
        })
  )
}

/** A place followed by more keys: `base` then `prop` (a key a pattern took it out by) then `rest`'s keys. */
const extended = (base: Place, prop: O.Option<string>, rest: Place): Place => {
  if (base.open) return base
  const withProp = O.match(prop, { onNone: () => base, onSome: (key) => ({ ...base, path: A.append(base.path, key) }) })
  return { root: withProp.root, path: A.appendAll(withProp.path, rest.path), open: rest.open }
}

const startsWith = (path: ReadonlyArray<string>, prefix: ReadonlyArray<string>): boolean =>
  prefix.length <= path.length && A.every(prefix, (key, index) => path[index] === key)

/** True when a write into one place reaches what the other holds: one is the other, holds it, or is held by it. */
const overlaps = (written: ReadonlyArray<string>, read: ReadonlyArray<string>): boolean =>
  startsWith(read, written) || startsWith(written, read)

/** A value assigned to a top-level name somewhere in the file (`r = refs`), with the scopes it is written in. */
interface TopAssigned {
  readonly name: string
  readonly value: Node
  readonly scopes: ReadonlyArray<Scope>
}

/** How many other names a place is followed through to the top level. */
const maxAliases = 8

/**
 * The places at the file's top level (or a global's, `Object`) a place stands for. A top-level name is itself and
 * whatever it was given or assigned (`const shared = kept`, `const b = big.b`, `const { assign } = Object`); a name
 * inside a function is what it was given or assigned (`const r = refs`, `r = refs`, `const r = refs ?? {}`), followed
 * to the top; a parameter or an element of a list stands for no place of the file. Only what is the same object is
 * followed: `const a = big.a` is `big`'s place `["a"]`, never `big` itself, so a write into `a` reaches `big.a` and
 * not `big.b`.
 */
const resolved = (
  place: Place,
  scopes: ReadonlyArray<Scope>,
  topAssigned: ReadonlyArray<TopAssigned>,
  depth = 0,
  followed: ReadonlyArray<string> = []
): ReadonlyArray<Place> =>
  O.match(lookUpAt(scopes, place.root), {
    onNone: () => [place],
    onSome: ({ at, binding }): ReadonlyArray<Place> => {
      // A name already followed on this path (`cache = cache ?? make()`) adds nothing new: following it again would
      // branch once per such assignment at every step, which grew without bound on a lazily filled module variable.
      const key = `${at}:${place.root}`
      if (depth > maxAliases || A.contains(followed, key)) return binding.kind === "module" ? [place] : []
      const where = A.take(scopes, at + 1)
      const through = (source: Node, sourceScopes: ReadonlyArray<Scope>, prop: O.Option<string>) =>
        A.flatMap(placesOf(source), (from) =>
          resolved(extended(from, prop, place), sourceScopes, topAssigned, depth + 1, [...followed, key])
        )
      if (binding.kind === "module") {
        const given = A.flatMap(O.toArray(binding.init), (init) => through(init, where, binding.prop))
        const assigned = A.flatMap(
          A.filter(topAssigned, (each) => each.name === place.root),
          (each: TopAssigned) => through(each.value, each.scopes, O.none())
        )
        return A.prepend(A.appendAll(given, assigned), place)
      }
      if (binding.kind !== "inner") return []
      return A.appendAll(
        A.flatMap(O.toArray(binding.init), (init) => through(init, where, binding.prop)),
        A.flatMap(binding.also, (value) => through(value, where, O.none()))
      )
    }
  })

/** The calls that write into the object they are handed first: `Object.assign(refs, { [id]: fn })` and its kin. */
const writesInto = [
  "Object.assign",
  "Object.defineProperty",
  "Object.defineProperties",
  "Reflect.set",
  "Reflect.defineProperty"
]

/**
 * What the functions of a file do to its top level's names: assign one again (`current = next`, `count++`), or write
 * into what one holds (`refs[id] = …`, `refs[id] ??= …`, `refs.count++`, `delete refs[id]`,
 * `Object.assign(refs, { [id]: fn })`, under any name for `Object.assign`: `Object["assign"]`, `const { assign } =
 * Object`), directly or through another name for it (`const r = refs; r[id] ??= fn`, `r = refs`, `refs ?? {}`).
 */
const writtenInFunctions = (program: Node, top: Scope): Written => {
  const reassigned: Array<string> = []
  const writes: Array<{ readonly target: Node; readonly scopes: ReadonlyArray<Scope> }> = []
  const calls: Array<{ readonly call: Node; readonly scopes: ReadonlyArray<Scope> }> = []
  const topAssigned: Array<TopAssigned> = []
  const visit = (node: Node, scopes: ReadonlyArray<Scope>): void => {
    const here = isFunction(node) ? A.append(scopes, scopeOf(node)) : scopes
    const atTop = (name: string): boolean => O.exists(lookUpAt(here, name), (bound) => bound.at === 0)
    const deleted = node.type === "UnaryExpression" && node["operator"] === "delete"
    if (deleted || typeIs(node, "AssignmentExpression", "UpdateExpression")) {
      const target = child(node, node.type === "AssignmentExpression" ? "left" : "argument")
      const member = O.exists(target, (left) => unwrapped(left).type === "MemberExpression")
      if (member) {
        if (here.length > 1) for (const left of O.toArray(target)) writes.push({ target: left, scopes: here })
      } else {
        for (const { name } of O.match(target, { onNone: () => [], onSome: (left) => namesIn(unwrapped(left)) })) {
          if (!atTop(name)) continue
          if (here.length > 1) reassigned.push(name)
          // `r = refs`, wherever it is written, makes `r` another name for `refs`.
          const simple = O.exists(O.map(target, unwrapped), (left) => left.type === "Identifier")
          if (simple)
            for (const value of O.toArray(child(node, "right"))) topAssigned.push({ name, value, scopes: here })
        }
      }
    }
    if (here.length > 1 && node.type === "CallExpression") calls.push({ call: node, scopes: here })
    for (const next of children(node)) visit(next, here)
  }
  visit(program, [top])
  const placesIn = (value: Node, scopes: ReadonlyArray<Scope>): ReadonlyArray<Place> =>
    A.flatMap(placesOf(value), (place) => resolved(place, scopes, topAssigned))
  // A call writes into its first argument when what it calls is `Object.assign` or its kin, under any name.
  const filling = A.flatMap(calls, ({ call, scopes }) =>
    O.exists(child(call, "callee"), (callee) =>
      A.some(
        placesIn(callee, scopes),
        (place) => !place.open && A.contains(writesInto, A.join([place.root, ...place.path], "."))
      )
    )
      ? A.map(A.take(nodes(call["arguments"]), 1), (target) => ({ target, scopes }))
      : []
  )
  const slots = A.flatMap(A.appendAll(writes, filling), ({ target, scopes }) => placesIn(target, scopes))
  const filledAt = (name: string): ReadonlyArray<ReadonlyArray<string>> =>
    A.dedupeWith(
      A.flatMap(resolved({ root: name, path: [], open: false }, [top], topAssigned), (own) =>
        A.flatMap(
          A.filter(slots, (slot) => slot.root === own.root),
          (slot: Place): ReadonlyArray<ReadonlyArray<string>> => {
            if (own.open) return overlaps(slot.path, own.path) ? [[]] : []
            if (startsWith(slot.path, own.path)) return [A.drop(slot.path, own.path.length)]
            return startsWith(own.path, slot.path) ? [[]] : []
          }
        )
      ),
      (a, b) => a.length === b.length && startsWith(a, b)
    )
  return { reassigned, filledAt }
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
    writtenInFunctions(program, topLevel(program, { reassigned: [], filledAt: () => [] }, hookModules)),
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
