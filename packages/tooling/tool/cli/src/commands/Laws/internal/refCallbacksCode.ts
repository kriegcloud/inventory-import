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
  /** At the file's top level, or imported: made once. */
  | { readonly kind: "module" }
  /** A parameter of a function (a component's props), or a name taken out of one in the parameter list. */
  | { readonly kind: "param"; readonly prop: O.Option<string> }
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

/** Every declaration a function's body holds, not looking inside the functions written in it. */
const declarationsIn = (body: Node): ReadonlyArray<Node> => {
  const found: Array<Node> = []
  const visit = (node: Node): void => {
    if (typeIs(node, "VariableDeclaration", "FunctionDeclaration")) found.push(node)
    if (isFunction(node)) return
    for (const next of children(node)) visit(next)
  }
  for (const next of children(body)) visit(next)
  return found
}

const bind = (entries: ReadonlyArray<readonly [string, Binding]>): Scope => R.fromEntries(entries)

/** What one function binds: its parameters, and what its body declares. */
const scopeOf = (fn: Node): Scope =>
  bind([
    ...A.flatMap(nodes(fn["params"]), (param) =>
      A.map(namesIn(param), (found) => [found.name, { kind: "param", prop: found.prop }] as const)
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

/** True for a call of a hook (`useRef(null)`, `useAtomValue(scope)`, `React.useRef()`): what it holds, it holds across draws. */
const isHookCall = (node: Node): boolean =>
  node.type === "CallExpression" &&
  O.exists(child(node, "callee"), (callee) => {
    const called =
      callee.type === "MemberExpression"
        ? O.getOrElse(O.map(child(callee, "property"), nameOf), () => "")
        : nameOf(callee)
    return /^use[A-Z0-9]/.test(called)
  })

/** What a value handed to a ref (or to a subscription) is: steady, a prop the caller decides, or refused with why. */
type Verdict =
  | { readonly kind: "steady" }
  | { readonly kind: "prop"; readonly name: string }
  | { readonly kind: "refused"; readonly why: string }

const steady: Verdict = { kind: "steady" }
const refused = (why: string): Verdict => ({ kind: "refused", why })

const lookUp = (scopes: ReadonlyArray<Scope>, name: string): O.Option<Binding> =>
  A.findFirst(A.reverse(scopes), (scope) => R.has(scope, name)).pipe(O.flatMap((scope) => R.get(scope, name)))

/** Judges a value in the scopes it is written in, innermost last. */
const judge = (value: Node, scopes: ReadonlyArray<Scope>, depth = 0): Verdict => {
  const node = unwrapped(value)
  if (typeIs(node, "ArrowFunctionExpression", "FunctionExpression")) {
    return refused("a function written where it is handed over is a new function on every draw")
  }
  if (typeIs(node, "ConditionalExpression", "LogicalExpression")) {
    return refused("a ref switched on and off by a condition is an effect on that condition under another name")
  }
  if (node.type === "CallExpression") {
    return isHookCall(node)
      ? steady
      : refused("a call makes its answer again on every draw (a function returned from a call, `.bind`)")
  }
  if (node.type === "Literal" || (node.type === "Identifier" && nameOf(node) === "undefined")) return steady
  if (node.type === "ThisExpression") return steady
  const named = (name: string, path: ReadonlyArray<string>): Verdict =>
    O.match(lookUp(scopes, name), {
      // Not bound in the file: a global.
      onNone: () => steady,
      onSome: (binding): Verdict => {
        if (binding.kind === "module") return steady
        if (binding.kind === "inner-function") {
          return refused(`${name} is a function declared inside the component: made again on every draw`)
        }
        if (binding.kind === "param") {
          // What a caller hands down is the caller's to keep steady: every place that hands it is judged too.
          const prop = O.getOrElse(binding.prop, () => path[0] ?? "")
          return O.isSome(binding.prop) || path.length === 1 ? { kind: "prop", name: prop } : steady
        }
        if (O.isNone(binding.init)) return refused(`${name} is declared inside the component with no value`)
        const init = unwrapped(binding.init.value)
        if (isHookCall(init)) return steady
        if (depth > 8) return steady
        // Another name for something else (`const actions = props.actions`, `const { attach } = region`).
        if (typeIs(init, "Identifier", "MemberExpression")) {
          const from = judge(init, scopes, depth + 1)
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
          : judge(root, scopes)
  })
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
 * Reads one screen. A file the parser cannot read gives nothing: the type-check says so, with the line.
 *
 * @example readScreen({ file: "List.tsx", source: "const List = () => <p ref={(node) => node?.focus()} />" }).refs[0]?.verdict.kind // "refused"
 */
export const readScreen = (input: { readonly file: string; readonly source: string }): ScreenRefs => {
  const { file, source } = input
  const parsed = parseSync(file, source)
  const program: unknown = parsed.program
  if (!isNode(program)) return { refs: [], attributes: [] }
  const starts = A.reduce(Str.split("\n")(source), [0], (offsets, line) =>
    A.append(offsets, (offsets[offsets.length - 1] ?? 0) + line.length + 1)
  )
  const lineAt = (offset: number): number => A.filter(starts, (start) => start <= offset).length
  const top = bind([
    ...A.flatMap(nodes(program["body"]), (statement): ReadonlyArray<readonly [string, Binding]> => {
      const declared = O.getOrElse(child(statement, "declaration"), () => statement)
      if (declared.type === "ImportDeclaration") {
        return A.map(nodes(declared["specifiers"]), (specifier) => [
          O.getOrElse(O.map(child(specifier, "local"), nameOf), () => ""),
          { kind: "module" } as const
        ])
      }
      if (declared.type === "VariableDeclaration") {
        return A.flatMap(nodes(declared["declarations"]), (declarator) =>
          O.match(child(declarator, "id"), {
            onNone: () => [],
            onSome: (id) => A.map(namesIn(id), (found) => [found.name, { kind: "module" }] as const)
          })
        )
      }
      return O.match(child(declared, "id"), {
        onNone: () => [],
        onSome: (id) => [[nameOf(id), { kind: "module" }] as const]
      })
    })
  ])
  const refs: Array<Handed> = []
  const attributes: Array<Handed> = []
  const walk = (node: Node, scopes: ReadonlyArray<Scope>): void => {
    const here = isFunction(node) ? A.append(scopes, scopeOf(node)) : scopes
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
    if (
      node.type === "CallExpression" &&
      O.exists(child(node, "callee"), (callee) => nameOf(callee) === "useAtomSubscribe")
    ) {
      const heard = nodes(node["arguments"])[1]
      if (heard !== undefined) {
        refs.push({ line: lineAt(heard.start), as: "useAtomSubscribe", verdict: judge(heard, here) })
      }
    }
    for (const next of children(node)) walk(next, here)
  }
  walk(program, [top])
  return { refs, attributes }
}
