// The Effect imports of one source file, read from its syntax tree: what is wrong with them, and the file written the
// house way. The tree is the parser's plain data, read here as records of unknown values.
import * as A from "effect/Array"
import * as O from "effect/Option"
import * as Order from "effect/Order"
import * as P from "effect/Predicate"
import * as R from "effect/Record"
import * as Str from "effect/String"
import { parseSync } from "oxc-parser"
import { ImportFault, RepairLeft } from "../EffectImports.schema.ts"
import {
  canonicalOf,
  type Hit,
  importLine,
  type Installed,
  isEffect,
  isFunctionExport,
  judge,
  judgeText,
  namedRoots,
  repairText,
  shapeOf,
  type Specifier
} from "./effectImportsJudge.ts"

/** A node of the syntax tree. */
type Node = Readonly<Record<string, unknown>> & { readonly type: string; readonly start: number; readonly end: number }

const isNode = (value: unknown): value is Node =>
  P.isObject(value) && P.isString(value["type"]) && P.isNumber(value["start"]) && P.isNumber(value["end"])
const nodes = (value: unknown): ReadonlyArray<Node> => (A.isArray(value) ? A.filter(value, isNode) : [])
const child = (node: Node, key: string): O.Option<Node> => O.liftPredicate(node[key], isNode)
const text = (node: Node, key: string): O.Option<string> => O.liftPredicate(node[key], P.isString)
const nameOf = (node: Node): string => O.getOrElse(text(node, "name"), () => "")
const typeIs = (node: Node, ...types: ReadonlyArray<string>): boolean => A.contains(types, node.type)

const children = (node: Node): ReadonlyArray<Node> =>
  A.flatMap(R.toEntries(node), ([key, value]) =>
    key === "parent" ? [] : A.isArray(value) ? A.filter(value, isNode) : isNode(value) ? [value] : []
  )
const walk = (node: Node, parent: O.Option<Node>, visit: (node: Node, parent: O.Option<Node>) => void): void => {
  visit(node, parent)
  for (const next of children(node)) walk(next, O.some(node), visit)
}

/** The specifier an import, a re-export or a dynamic import names, when it is a string. */
const sourceOf = (node: Node): O.Option<string> => O.flatMap(child(node, "source"), (source) => text(source, "value"))
const localOf = (specifier: Node): string => O.getOrElse(O.map(child(specifier, "local"), nameOf), () => "")

const specifiersOf = (declaration: Node): ReadonlyArray<Specifier> =>
  A.map(nodes(declaration["specifiers"]), (specifier): Specifier => {
    const type = declaration["importKind"] === "type" || specifier["importKind"] === "type"
    const local = localOf(specifier)
    if (specifier.type === "ImportNamespaceSpecifier") return { kind: "namespace", imported: "", local, type }
    if (specifier.type === "ImportDefaultSpecifier") return { kind: "default", imported: "", local, type }
    const imported = O.flatMap(child(specifier, "imported"), (node) =>
      O.orElse(text(node, "name"), () => text(node, "value"))
    )
    return { kind: "named", imported: O.getOrElse(imported, () => ""), local, type }
  })

/** The names a file's top level binds, other than through its Effect imports. */
const boundNames = (program: Node): ReadonlyArray<string> => {
  const declared = (node: O.Option<Node>): ReadonlyArray<string> =>
    O.match(node, {
      onNone: () => [],
      onSome: (found) => {
        if (found.type === "VariableDeclaration") {
          return A.flatMap(nodes(found["declarations"]), (declarator) =>
            O.match(child(declarator, "id"), {
              onNone: () => A.empty<string>(),
              onSome: (id) => (id.type === "Identifier" ? [nameOf(id)] : [])
            })
          )
        }
        return O.match(child(found, "id"), {
          onNone: () => A.empty<string>(),
          onSome: (id) => (id.type === "Identifier" ? [nameOf(id)] : [])
        })
      }
    })
  return A.flatMap(nodes(program["body"]), (node) => {
    if (node.type === "ImportDeclaration") {
      return O.exists(sourceOf(node), isEffect) ? [] : A.map(nodes(node["specifiers"]), localOf)
    }
    if (typeIs(node, "ExportNamedDeclaration", "ExportDefaultDeclaration")) return declared(child(node, "declaration"))
    return declared(O.some(node))
  })
}

const parse = (path: string, source: string) => {
  const parsed = parseSync(path, source)
  return { program: O.liftPredicate<unknown, Node>(parsed.program, isNode), comments: parsed.comments }
}

/** What is wrong with the Effect imports of one source file, and with the examples in its comments. */
export const judgeCode =
  (installed: Installed) =>
  (path: string, source: string): ReadonlyArray<Hit> => {
    const parsed = parse(path, source)
    if (O.isNone(parsed.program)) return []
    const program = parsed.program.value
    const body = nodes(program["body"])
    const bound = boundNames(program)
    const shape = shapeOf(installed)
    const fromBody = A.flatMap(body, (node): ReadonlyArray<Hit> => {
      const from = sourceOf(node)
      if (O.isNone(from) || !isEffect(from.value)) return []
      if (node.type === "ImportDeclaration") {
        // A name is taken when something other than an Effect import of this same module binds it.
        const others = A.flatMap(body, (other) =>
          other.type === "ImportDeclaration" &&
          O.exists(sourceOf(other), (otherSource) => isEffect(otherSource) && otherSource !== from.value)
            ? A.map(nodes(other["specifiers"]), localOf)
            : []
        )
        const taken = (name: string) => A.contains(bound, name) || A.contains(others, name)
        return A.map(judge(installed)(from.value, specifiersOf(node), taken), (fault) => ({
          offset: node.start,
          fault,
          inComment: false
        }))
      }
      return shape(from.value) !== "leaf"
        ? [{ offset: node.start, fault: ImportFault.cases.ReExport.make({ source: from.value }), inComment: false }]
        : []
    })
    let dynamic: ReadonlyArray<Hit> = []
    walk(program, O.none(), (node) => {
      if (node.type !== "ImportExpression") return
      const literal = O.filter(child(node, "source"), (inner) => inner.type === "Literal")
      const from = O.flatMap(literal, (inner) => text(inner, "value"))
      if (
        O.isSome(from) &&
        isEffect(from.value) &&
        shape(from.value) !== "leaf" &&
        !A.contains(namedRoots, from.value)
      ) {
        dynamic = A.append(dynamic, {
          offset: node.start,
          fault: ImportFault.cases.DynamicImport.make({ source: from.value }),
          inComment: false
        })
      }
    })
    const inComments = A.flatMap(parsed.comments, (comment) =>
      A.map(judgeText(installed)(comment.value), (hit) => ({
        offset: comment.start + hit.offset,
        fault: hit.fault,
        inComment: true
      }))
    )
    return A.flatten([fromBody, dynamic, inComments])
  }

const is = (parent: Node, key: string, node: Node): boolean => parent[key] === node

/** Positions where an identifier is a property's name, not a reference to a binding. */
const isName = (node: Node, parent: Node): boolean =>
  (parent.type === "MemberExpression" && is(parent, "property", node) && parent["computed"] !== true) ||
  (parent.type === "TSQualifiedName" && is(parent, "right", node)) ||
  (parent.type === "JSXMemberExpression" && is(parent, "property", node)) ||
  (parent.type === "JSXAttribute" && is(parent, "name", node)) ||
  (typeIs(
    parent,
    "Property",
    "MethodDefinition",
    "PropertyDefinition",
    "AccessorProperty",
    "TSPropertySignature",
    "TSMethodSignature",
    "TSEnumMember"
  ) &&
    is(parent, "key", node) &&
    parent["computed"] !== true &&
    parent["shorthand"] !== true) ||
  (typeIs(parent, "LabeledStatement", "BreakStatement", "ContinueStatement") && is(parent, "label", node)) ||
  typeIs(parent, "ImportSpecifier", "ImportNamespaceSpecifier", "ImportDefaultSpecifier") ||
  (parent.type === "TSModuleDeclaration" && is(parent, "id", node))

/** Positions where an identifier declares a new binding, which would shadow an import of the same name. */
const declares = (node: Node, parent: Node): boolean =>
  (parent.type === "VariableDeclarator" && is(parent, "id", node)) ||
  (typeIs(
    parent,
    "FunctionDeclaration",
    "FunctionExpression",
    "ClassDeclaration",
    "ClassExpression",
    "TSTypeAliasDeclaration",
    "TSInterfaceDeclaration",
    "TSEnumDeclaration"
  ) &&
    is(parent, "id", node)) ||
  (parent.type === "TSTypeParameter" && is(parent, "name", node)) ||
  (typeIs(parent, "FunctionDeclaration", "FunctionExpression", "ArrowFunctionExpression") &&
    A.contains(nodes(parent["params"]), node)) ||
  (parent.type === "CatchClause" && is(parent, "param", node)) ||
  parent.type === "ArrayPattern" ||
  parent.type === "RestElement" ||
  (parent.type === "AssignmentPattern" && is(parent, "left", node))

interface Use extends Specifier {
  readonly path: string
  readonly flat: boolean
}
interface Plan {
  readonly declaration: Node
  readonly uses: ReadonlyArray<Use>
}
interface Module {
  readonly path: string
  readonly locals: ReadonlyArray<string>
  readonly type: boolean
  readonly first: Node
}
interface Edit {
  readonly start: number
  readonly end: number
  readonly replacement: string
}

const latestFirst = Order.mapInput(Order.flip(Order.Number), (edit: { readonly start: number }) => edit.start)

/**
 * One file written the house way: every barrel import split into its modules, every namespace given its name, and
 * the identifiers that follow from a changed name renamed with it. Returns the new text, and what it had to leave.
 */
export const repairCode =
  (installed: Installed) =>
  (path: string, source: string): { readonly text: string; readonly left: ReadonlyArray<RepairLeft> } => {
    const parsed = parse(path, source)
    if (O.isNone(parsed.program)) return { text: source, left: [] }
    const program = parsed.program.value
    const bound = boundNames(program)
    const shape = shapeOf(installed)
    const declarations = A.filter(
      nodes(program["body"]),
      (node) => node.type === "ImportDeclaration" && O.exists(sourceOf(node), isEffect)
    )
    // What each declaration becomes; one that cannot be planned whole is judged, and left for a person.
    const plans = A.flatMap(declarations, (declaration): ReadonlyArray<Plan> => {
      const from = O.getOrElse(sourceOf(declaration), () => "")
      const specifiers = specifiersOf(declaration)
      const kind = shape(from)
      if (kind === "leaf") {
        const only = specifiers[0]
        return specifiers.length === 1 && only !== undefined && only.kind === "namespace"
          ? [{ declaration, uses: [{ ...only, path: from, flat: false }] }]
          : []
      }
      if (kind === "barrel" && !A.contains(namedRoots, from) && specifiers.length > 0) {
        const uses = A.map(specifiers, (specifier): O.Option<Use> => {
          const leaf = `${from}/${specifier.imported}`
          if (specifier.kind === "named" && shape(leaf) === "leaf")
            return O.some({ ...specifier, path: leaf, flat: false })
          if (specifier.kind === "named" && from === "effect" && isFunctionExport(installed)(specifier.imported)) {
            return O.some({ ...specifier, path: "effect/Function", flat: true })
          }
          return O.none()
        })
        return A.every(uses, O.isSome) ? [{ declaration, uses: A.getSomes(uses) }] : []
      }
      return []
    })
    // Every namespace this file ends up with, in the order first met.
    const modules = A.reduce(
      A.flatMap(plans, (plan) => A.map(plan.uses, (use) => ({ use, declaration: plan.declaration }))),
      A.empty<Module>(),
      (so, { use, declaration }) => {
        if (use.flat) return so
        return A.some(so, (entry) => entry.path === use.path)
          ? A.map(so, (entry) =>
              entry.path === use.path
                ? { ...entry, locals: A.append(entry.locals, use.local), type: entry.type && use.type }
                : entry
            )
          : A.append(so, { path: use.path, locals: [use.local], type: use.type, first: declaration })
      }
    )
    const named = A.map(modules, (entry) => {
      const names = canonicalOf(entry.path)
      const others = A.flatMap(modules, (other) => (other.path === entry.path ? [] : other.locals))
      const kept = A.findFirst(names, (name) => A.contains(entry.locals, name))
      const free = A.findFirst(names, (name) => !A.contains(bound, name) && !A.contains(others, name))
      const final = O.getOrElse(
        O.orElse(kept, () => free),
        () => entry.locals[0] ?? ""
      )
      return { ...entry, final }
    })
    const renames = R.fromEntries(
      A.flatMap(named, (entry) =>
        A.flatMap(entry.locals, (local) => (local !== entry.final ? [[local, entry.final] as const] : []))
      )
    )
    // A module's name must not collide with another module's in the same file.
    const finals = A.map(named, (entry) => entry.final)
    if (A.dedupe(finals).length !== finals.length) {
      return { text: source, left: [RepairLeft.cases.SharedName.make({})] }
    }
    const moduleOf = (modulePath: string) => A.findFirst(named, (entry) => entry.path === modulePath)

    let written: ReadonlyArray<string> = []
    const importEdits = A.flatMap(plans, ({ declaration, uses }): ReadonlyArray<Edit> => {
      const original = Str.slice(declaration.start, declaration.end)(source)
      const semicolon = Str.endsWith(";")(Str.trimEnd(original)) ? ";" : ""
      const namespaces = A.flatMap(uses, (use) => {
        if (use.flat) return A.empty<string>()
        const entry = moduleOf(use.path)
        if (O.isNone(entry) || entry.value.first !== declaration || A.contains(written, use.path)) return []
        written = A.append(written, use.path)
        return [importLine({ local: entry.value.final, source: use.path, type: entry.value.type }) + semicolon]
      })
      const flat = A.filter(uses, (use) => use.flat)
      const functions = A.isReadonlyArrayNonEmpty(flat)
        ? [
            `import { ${A.join(
              A.map(flat, (use) => (use.local === use.imported ? use.imported : `${use.imported} as ${use.local}`)),
              ", "
            )} } from "effect/Function"${semicolon}`
          ]
        : []
      const replacement = A.join(A.appendAll(namespaces, functions), "\n")
      if (replacement === original) return []
      if (replacement === "") {
        // The module is already imported above: drop this line with its line break.
        const end = source[declaration.end] === "\n" ? declaration.end + 1 : declaration.end
        return [{ start: declaration.start, end, replacement: "" }]
      }
      return [{ start: declaration.start, end: declaration.end, replacement }]
    })

    const renamed = R.keys(renames)
    let shadowed: ReadonlyArray<string> = []
    let references: ReadonlyArray<{ readonly node: Node; readonly parent: O.Option<Node> }> = []
    if (A.isReadonlyArrayNonEmpty(renamed)) {
      walk(program, O.none(), (node, parent) => {
        const above = O.getOrUndefined(parent)
        if (above !== undefined && typeIs(above, "ImportDeclaration", "ImportSpecifier")) return
        if (!typeIs(node, "Identifier", "JSXIdentifier") || !A.contains(renamed, nameOf(node))) return
        if (above !== undefined && typeIs(above, "ImportNamespaceSpecifier", "ImportDefaultSpecifier")) return
        if (above !== undefined && isName(node, above)) return
        if (above !== undefined && (declares(node, above) || above.type === "ExportSpecifier")) {
          shadowed = A.append(shadowed, nameOf(node))
        } else references = A.append(references, { node, parent })
      })
    }
    const referenceEdits = A.flatMap(references, ({ node, parent }): ReadonlyArray<Edit> => {
      const name = nameOf(node)
      if (A.contains(shadowed, name)) return []
      const next = renames[name] ?? name
      const shorthand = O.exists(parent, (above) => above.type === "Property" && above["shorthand"] === true)
      return [{ start: node.start, end: node.end, replacement: shorthand ? `${name}: ${next}` : next }]
    })
    const left = A.map(A.dedupe(shadowed), (name): RepairLeft =>
      RepairLeft.cases.DeclaredAgain.make({ name, to: renames[name] ?? name })
    )
    // Examples in comments follow the names of the file they sit in.
    const commentEdits = A.isReadonlyArrayNonEmpty(renamed)
      ? A.flatMap(parsed.comments, (comment): ReadonlyArray<Edit> => {
          const before = Str.slice(comment.start, comment.end)(source)
          const pattern = new RegExp(`(?<![\\w.$])(${A.join(renamed, "|")})\\.(?=[A-Za-z_$])`, "g")
          const after = A.reduce(A.reverse(A.fromIterable(Str.matchAll(pattern)(before))), before, (so, match) => {
            const name = match[1] ?? ""
            const at = match.index ?? 0
            return `${Str.slice(0, at)(so)}${renames[name] ?? name}.${Str.slice(at + match[0].length)(so)}`
          })
          return after !== before ? [{ start: comment.start, end: comment.end, replacement: after }] : []
        })
      : []

    const sorted = A.sort(A.flatten([importEdits, referenceEdits, commentEdits]), latestFirst)
    // A reference inside a comment that was rewritten whole cannot happen; overlapping edits would be a bug.
    const overlapping = A.some(sorted, (edit, index) => {
      const before = sorted[index - 1]
      return index > 0 && before !== undefined && edit.end > before.start
    })
    if (overlapping) return { text: source, left: [RepairLeft.cases.Overlap.make({})] }
    const edited = A.reduce(
      sorted,
      source,
      (so, edit) => Str.slice(0, edit.start)(so) + edit.replacement + Str.slice(edit.end)(so)
    )
    // Import statements inside comments.
    const again = parse(path, edited)
    const next = A.reduce(A.sort(again.comments, latestFirst), edited, (so, comment) => {
      const before = Str.slice(comment.start, comment.end)(so)
      const after = repairText(installed)(before)
      return after !== before ? Str.slice(0, comment.start)(so) + after + Str.slice(comment.end)(so) : so
    })
    return { text: next, left }
  }
