// What one code file says of the vocabulary's marks, read from its syntax tree: each call of a mark helper, with the
// declaration it is written in and whether its argument is the literal form its position takes; each declaration at
// the top of the module with the names it reads; each annotation key of a mark written by hand; and each module the
// file imports, with whether the import is of types alone. A pattern over the text would take a helper's name out of
// a comment or a fixture string for a call. The walk keeps its own list and visits each node once, so it takes no
// step budget; a file the scan before parsing or the parser refuses is refused whole (`budget.ts`).
import * as A from "effect/Array"
import * as O from "effect/Option"
import * as P from "effect/Predicate"
import * as R from "effect/Record"
import * as Str from "effect/String"
import { parseSync } from "oxc-parser"
import { parseFailure, type Unread, unreadable } from "./budget.ts"
import { linesOf } from "./lines.ts"

/** A node of the syntax tree. */
type Node = Readonly<Record<string, unknown>> & { readonly type: string; readonly start: number; readonly end: number }

const isNode = (value: unknown): value is Node =>
  P.isObject(value) && P.isString(value["type"]) && P.isNumber(value["start"]) && P.isNumber(value["end"])
const nodeAt = (node: Node, key: string): O.Option<Node> => O.liftPredicate(node[key], isNode)
const nodesAt = (node: Node, key: string): ReadonlyArray<Node> => {
  const value = node[key]
  return A.isArray(value) ? A.filter(value, isNode) : []
}
const textAt = (node: Node, key: string): O.Option<string> => O.liftPredicate(node[key], P.isString)

/** The five helpers a record is marked with, as `@inventory/kernel/TermsPointer` names them. */
export const helperNames: ReadonlyArray<string> = ["aboutClass", "aboutProperty", "aboutScheme", "aboutPath", "noTerm"]

/** What the helpers are made with, in `@beep/vocabulary/Pointer`: a second maker would be a second set of helpers. */
export const makerNames: ReadonlyArray<string> = ["pointerFor", "pathFor", "noTermFor"]
const tracked: ReadonlyArray<string> = [...helperNames, ...makerNames]

/** One use of a helper: a call, or the helper handed on as a value (`const mark = aboutClass`). */
export interface HelperUse {
  readonly line: number
  /** The helper, by the name it is exported under, whatever the file calls it. */
  readonly helper: string
  /** The module the file takes it from, as the import writes it: a function of the same name from elsewhere is none. */
  readonly from: string
  /** Whether it is called with the literal form its position takes. A helper handed on as a value is not. */
  readonly literal: boolean
  /** The declaration at the top of the module it is written in, if it is in one. */
  readonly owner: O.Option<string>
}

/** One declaration at the top of the module: its name, its line, and every name its text reads. */
export interface Declaration {
  readonly name: string
  readonly line: number
  /** Whether it is a `const`: only a constant can stand for the mark it is given. */
  readonly constant: boolean
  readonly reads: ReadonlyArray<string>
}

/** One module the file imports or re-exports. */
export interface ImportAt {
  readonly line: number
  readonly specifier: string
  /** Whether the whole statement is `import type` or `export type`: then nothing of the module is loaded. */
  readonly typeOnly: boolean
}

/** What reading one file gives, or where and why the law stopped. */
export interface OntologyTermsRead {
  readonly uses: ReadonlyArray<HelperUse>
  readonly declarations: ReadonlyArray<Declaration>
  /** The lines where a mark's annotation key is written by hand, with the key. */
  readonly handKeys: ReadonlyArray<{ readonly line: number; readonly key: string }>
  readonly imports: ReadonlyArray<ImportAt>
  readonly unread: O.Option<{ readonly line: number; readonly unread: Unread }>
}

const isString = (node: Node): boolean => node.type === "Literal" && P.isString(node["value"])
const stringOf = (node: Node): O.Option<string> =>
  node.type === "Literal" ? O.liftPredicate(node["value"], P.isString) : O.none()

const wrappers = ["ParenthesizedExpression", "TSAsExpression", "TSSatisfiesExpression", "TSNonNullExpression"]

/** An expression without the brackets, `as`, `satisfies` and `!` around it. */
const bare = (node: Node): Node => {
  let inner = node
  for (let next = nodeAt(inner, "expression"); A.contains(wrappers, inner.type) && O.isSome(next);) {
    inner = next.value
    next = nodeAt(inner, "expression")
  }
  return inner
}

/** What a name stands for in the file, when it is a constant there. */
type Lookup = (name: string) => O.Option<Node>
const noLookup: Lookup = () => O.none()

/** Every way to join one text of each part, in order; none when a part has no text. */
const joinedNone: ReadonlyArray<string> = [""]
const joined = (parts: ReadonlyArray<ReadonlyArray<string>>): ReadonlyArray<string> =>
  A.reduce(parts, joinedNone, (so, part) =>
    A.take(
      A.flatMap(so, (head) => A.map(part, (tail) => `${head}${tail}`)),
      64
    )
  )

/**
 * Every text an expression can be read as without running it: a string, a template, a sum of texts, either side of a
 * `?:`, a constant of the file by its name, and any of them in brackets or under `as` and `satisfies`. Anything else
 * gives none.
 */
const textsOf = (written: Node, lookup: Lookup = noLookup, depth = 0): ReadonlyArray<string> => {
  const node = bare(written)
  const of = (key: string): ReadonlyArray<string> =>
    O.match(nodeAt(node, key), { onNone: () => [], onSome: (inner) => textsOf(inner, lookup, depth + 1) })
  if (depth > 8) return []
  if (node.type === "ConditionalExpression") return [...of("consequent"), ...of("alternate")]
  if (node.type === "BinaryExpression" && node["operator"] === "+") return joined([of("left"), of("right")])
  if (node.type === "Identifier") {
    return O.match(O.flatMap(textAt(node, "name"), lookup), {
      onNone: () => [],
      onSome: (held) => textsOf(held, lookup, depth + 1)
    })
  }
  if (node.type === "TemplateLiteral") {
    const quasis = A.map(nodesAt(node, "quasis"), (quasi): ReadonlyArray<string> => {
      const value = quasi["value"]
      return P.isObject(value) && P.isString(value["cooked"]) ? [value["cooked"]] : []
    })
    const holes = A.map(nodesAt(node, "expressions"), (hole) => textsOf(hole, lookup, depth + 1))
    // quasi, hole, quasi, hole, …, quasi
    return joined(A.flatMap(quasis, (quasi, index) => (index < holes.length ? [quasi, holes[index] ?? []] : [quasi])))
  }
  return A.fromOption(stringOf(node))
}

const markKeys: ReadonlyArray<string> = ["term", "path", "noTerm"]

/**
 * The name a property is written under: an identifier, a string, or an expression between square brackets that can
 * be read as a text, which is the same key. Where it can be read as more than one, a mark's key is the one taken.
 */
const keyOf = (property: Node, lookup: Lookup = noLookup): O.Option<string> =>
  property.type !== "Property"
    ? O.none()
    : O.flatMap(nodeAt(property, "key"), (key) => {
        if (property["computed"] !== true) return key.type === "Identifier" ? textAt(key, "name") : stringOf(key)
        const texts = textsOf(key, lookup)
        return O.orElse(
          A.findFirst(texts, (text) => A.contains(markKeys, text)),
          () => A.head(texts)
        )
      })

/** The name a property is written under in the literal form a helper takes: never between square brackets. */
const plainKeyOf = (property: Node): O.Option<string> => (property["computed"] === true ? O.none() : keyOf(property))

/** An object literal whose every member is a written-out key with a value `allowed` accepts. */
const isObjectOf = (node: Node, allowed: (key: string, value: Node) => boolean): boolean =>
  node.type === "ObjectExpression" &&
  A.every(nodesAt(node, "properties"), (property) =>
    O.exists(
      O.all({ key: plainKeyOf(property), value: nodeAt(property, "value") }),
      ({ key, value }) => property["shorthand"] !== true && property["method"] !== true && allowed(key, value)
    )
  )

/** An array literal with no hole and no spread, each element accepted. */
const isArrayOf = (node: Node, allowed: (element: Node) => boolean): boolean => {
  const written = node["elements"]
  return (
    node.type === "ArrayExpression" &&
    A.isArray(written) &&
    A.every(written, (element) => isNode(element) && allowed(element))
  )
}

const isTrue = (node: Node): boolean => node.type === "Literal" && node["value"] === true

/** A step of a path: string values, `reverse: true`, and `fixed` as a list of objects of strings. */
const isStep = (node: Node): boolean =>
  isObjectOf(node, (key, value) =>
    key === "reverse"
      ? isTrue(value)
      : key === "fixed"
        ? isArrayOf(value, (entry) => isObjectOf(entry, (_, text) => isString(text)))
        : isString(value)
  )

/** Whether a helper's arguments are the literal form its position takes (report 14 section 6.7, rule 3). */
const isLiteralCall = (helper: string, given: ReadonlyArray<Node>): boolean => {
  const [first, second, ...rest] = given
  if (first === undefined || A.isReadonlyArrayNonEmpty(rest)) return false
  if (helper === "aboutPath") return second === undefined && isArrayOf(first, isStep)
  if (helper === "noTerm") {
    return second === undefined ? isString(first) : O.contains(stringOf(first), "deferred") && isString(second)
  }
  return second === undefined && isString(first)
}

/** Whether a member has the shape a helper returns: a CURIE under `term`, steps under `path`, a reason under `noTerm`. */
const isMarkShape = (key: string, value: Node): boolean => {
  const hasKey = (object: Node, name: string): boolean =>
    object.type === "ObjectExpression" &&
    A.some(nodesAt(object, "properties"), (inner) => O.contains(keyOf(inner), name))
  if (key === "noTerm") return hasKey(value, "reason")
  if (key === "term") return O.exists(stringOf(value), Str.includes(":"))
  return (
    key === "path" &&
    value.type === "ArrayExpression" &&
    A.some(nodesAt(value, "elements"), (element) => hasKey(element, "property"))
  )
}

/** Whether a member's value is the kind a mark has under that key: a string, a list, an object. A schema is none. */
const isMarkLike = (key: string, value: Node): boolean =>
  key === "term"
    ? isString(value)
    : key === "path"
      ? value.type === "ArrayExpression"
      : value.type === "ObjectExpression"

/**
 * The mark keys an object literal writes by hand. In the argument of an `annotate…` call any of the three keys is
 * one. In an argument of a class factory's second call, which takes the fields and then the annotations, a key whose
 * value is the kind a mark has (a field's value is a schema, never a string, a list or an object literal). Anywhere
 * else only a member with the shape a helper returns, so a record keyed by the three names is not taken for a mark.
 */
const handKeysOf = (
  object: Node,
  annotation: "named" | "second" | "none",
  lookup: Lookup = noLookup
): ReadonlyArray<string> =>
  A.getSomes(
    A.map(nodesAt(object, "properties"), (property) =>
      O.flatMap(O.all({ key: keyOf(property, lookup), value: nodeAt(property, "value") }), ({ key, value }) =>
        A.contains(markKeys, key) &&
        (annotation === "named" || (annotation === "second" && isMarkLike(key, value)) || isMarkShape(key, value))
          ? O.some(key)
          : O.none()
      )
    )
  )

/** Whether a call takes annotations by its name: `x.annotate(…)`, `S.annotateKey(…)`, `$I.annoteSchema(…)`. */
const takesAnnotations = (callee: Node): "named" | "none" => {
  const name =
    callee.type === "Identifier"
      ? textAt(callee, "name")
      : callee.type === "MemberExpression" && callee["computed"] !== true
        ? O.flatMap(nodeAt(callee, "property"), (property) => textAt(property, "name"))
        : O.none()
  return O.exists(name, Str.startsWith("annot")) ? "named" : "none"
}

/** The names one statement at the top of the module declares, each with the node that is its text. */
const declared = (
  statement: Node
): ReadonlyArray<{ readonly name: string; readonly node: Node; readonly constant: boolean }> => {
  const inner =
    statement.type === "ExportNamedDeclaration" || statement.type === "ExportDefaultDeclaration"
      ? O.getOrElse(nodeAt(statement, "declaration"), () => statement)
      : statement
  if (inner.type === "VariableDeclaration") {
    return A.getSomes(
      A.map(nodesAt(inner, "declarations"), (declarator) =>
        O.map(
          O.flatMap(nodeAt(declarator, "id"), (id) => (id.type === "Identifier" ? textAt(id, "name") : O.none())),
          (name) => ({ name, node: declarator, constant: inner["kind"] === "const" })
        )
      )
    )
  }
  return O.match(
    O.flatMap(nodeAt(inner, "id"), (id) => textAt(id, "name")),
    {
      onNone: () => [],
      onSome: (name) => [{ name, node: inner, constant: false }]
    }
  )
}

const importing = ["ImportDeclaration", "ExportNamedDeclaration", "ExportAllDeclaration", "ImportExpression"]

/**
 * What `source` says of the vocabulary's marks.
 *
 * @example readOntologyTerms({ file: "a.ts", source: 'import { vocabulary } from "./Terms.vocab.ts"' }).imports.length // 1
 */
export const readOntologyTerms = (input: { readonly file: string; readonly source: string }): OntologyTermsRead => {
  const lineOf = linesOf(input.source)
  const none: Omit<OntologyTermsRead, "unread"> = { uses: [], declarations: [], handKeys: [], imports: [] }
  const refused = unreadable(input.source)
  if (refused !== undefined) {
    return { ...none, unread: O.some({ line: lineOf(refused.at), unread: refused.unread }) }
  }
  const parsed = parseSync(input.file, input.source)
  const failed = parseFailure(parsed.errors)
  if (failed !== undefined) {
    return { ...none, unread: O.some({ line: lineOf(failed.at), unread: failed.unread }) }
  }
  const program: unknown = parsed.program
  if (!isNode(program)) return { ...none, unread: O.none() }

  // The names this file knows the helpers by, each with the module it comes from: `import { aboutClass as mark }`,
  // and a namespace they are read from. An import of types brings no helper.
  const helpers: Record<string, { readonly helper: string; readonly from: string }> = {}
  const namespaces: Record<string, string> = {}
  for (const statement of nodesAt(program, "body")) {
    if (statement.type !== "ImportDeclaration" || statement["importKind"] === "type") continue
    const from = O.flatMap(nodeAt(statement, "source"), stringOf)
    if (O.isNone(from)) continue
    for (const specifier of nodesAt(statement, "specifiers")) {
      const local = O.flatMap(nodeAt(specifier, "local"), (id) => textAt(id, "name"))
      if (O.isNone(local) || specifier["importKind"] === "type") continue
      if (specifier.type === "ImportNamespaceSpecifier") namespaces[local.value] = from.value
      const imported = O.flatMap(nodeAt(specifier, "imported"), (id) =>
        id.type === "Identifier" ? textAt(id, "name") : stringOf(id)
      )
      if (O.isSome(imported) && A.contains(tracked, imported.value)) {
        helpers[local.value] = { helper: imported.value, from: from.value }
      }
    }
  }
  // Every constant of the file by its name, wherever it is declared: what a name in an annotation, a key or an
  // import stands for. Two constants of one name in two functions are told apart by nothing here; the last is kept.
  const constants: Record<string, Node> = {}
  const everything: Array<Node> = [program]
  for (let node = everything.pop(); node !== undefined; node = everything.pop()) {
    if (node.type === "VariableDeclaration" && node["kind"] === "const") {
      for (const declarator of nodesAt(node, "declarations")) {
        const name = O.flatMap(nodeAt(declarator, "id"), (id) =>
          id.type === "Identifier" ? textAt(id, "name") : O.none()
        )
        const init = nodeAt(declarator, "init")
        if (O.isSome(name) && O.isSome(init)) constants[name.value] = bare(init.value)
      }
    }
    for (const [key, value] of R.toEntries(node)) {
      if (key === "parent") continue
      if (A.isArray(value)) everything.push(...A.filter(value, isNode))
      else if (isNode(value)) everything.push(value)
    }
  }
  const lookup: Lookup = (name) => R.get(constants, name)
  /** The helper an expression names, if it names one: its own name here, `Namespace.helper` or `Namespace["helper"]`. */
  const helperOf = (node: Node): O.Option<{ readonly helper: string; readonly from: string }> => {
    if (node.type === "Identifier") return O.flatMap(textAt(node, "name"), (name) => R.get(helpers, name))
    if (node.type !== "MemberExpression") return O.none()
    const from = O.flatMap(
      O.flatMap(nodeAt(node, "object"), (object) => (object.type === "Identifier" ? textAt(object, "name") : O.none())),
      (name) => R.get(namespaces, name)
    )
    const named = O.flatMap(nodeAt(node, "property"), (property) =>
      node["computed"] === true
        ? A.findFirst(textsOf(property, lookup), (text) => A.contains(tracked, text))
        : textAt(property, "name")
    )
    return O.flatMap(from, (module) =>
      O.map(
        O.filter(named, (name) => A.contains(tracked, name)),
        (helper) => ({ helper, from: module })
      )
    )
  }

  /**
   * The mark keys an annotation is given through a name: the constant the name stands for, and each constant that
   * one spreads. Each is read as the annotation's own object would be, whatever its values are.
   */
  const keysBehind = (given: Node, how: "named" | "second", seen: ReadonlyArray<string>): ReadonlyArray<string> => {
    if (given.type !== "Identifier") return []
    const name = textAt(given, "name")
    if (O.isNone(name) || A.contains(seen, name.value)) return []
    const held = R.get(constants, name.value)
    if (O.isNone(held) || held.value.type !== "ObjectExpression") return []
    return [
      ...handKeysOf(held.value, how, lookup),
      ...A.flatMap(nodesAt(held.value, "properties"), (property) =>
        property.type === "SpreadElement"
          ? O.match(nodeAt(property, "argument"), {
              onNone: () => [],
              onSome: (inner) =>
                bare(inner).type === "ObjectExpression"
                  ? handKeysOf(bare(inner), how, lookup)
                  : keysBehind(bare(inner), how, [...seen, name.value])
            })
          : []
      )
    ]
  }

  const uses: Array<HelperUse> = []
  const handKeys: Array<{ readonly line: number; readonly key: string }> = []
  const imports: Array<ImportAt> = []
  const declarations: Array<Declaration> = []
  // Where each argument of a call that takes annotations starts: an object literal there is an annotation object.
  const named: Array<number> = []
  const second: Array<number> = []

  /** Reads everything under `root`, written in the declaration `owner`; answers the names it reads. */
  const read = (root: Node, owner: O.Option<string>): ReadonlyArray<string> => {
    const names: Array<string> = []
    const left: Array<Node> = [root]
    for (let node = left.pop(); node !== undefined; node = left.pop()) {
      const skipped: Array<string> = []
      // A type's `typeof aboutClass` names the helper and hands nothing on.
      if (node.type === "TSTypeQuery") continue
      if (A.contains(importing, node.type)) {
        const kind = node.type === "ImportDeclaration" ? node["importKind"] : node["exportKind"]
        // A dynamic import's module is an expression: every text it can be read as is a module it may load.
        for (const specifier of O.match(nodeAt(node, "source"), {
          onNone: () => [],
          onSome: (source) => textsOf(source, lookup)
        })) {
          imports.push({ line: lineOf(node.start), specifier, typeOnly: kind === "type" })
        }
      }
      if (node.type === "ImportDeclaration") continue
      // `export { aboutClass as mark } from "…"` hands the helper on under another name, with no name of it here.
      const exportedFrom =
        node.type === "ExportNamedDeclaration" ? O.flatMap(nodeAt(node, "source"), stringOf) : O.none()
      if (O.isSome(exportedFrom) && node["exportKind"] !== "type") {
        for (const specifier of nodesAt(node, "specifiers")) {
          const local = O.flatMap(nodeAt(specifier, "local"), (id) =>
            id.type === "Identifier" ? textAt(id, "name") : stringOf(id)
          )
          const exported = O.flatMap(nodeAt(specifier, "exported"), (id) =>
            id.type === "Identifier" ? textAt(id, "name") : stringOf(id)
          )
          if (O.isSome(local) && A.contains(tracked, local.value) && !O.contains(exported, local.value)) {
            uses.push({
              line: lineOf(specifier.start),
              helper: local.value,
              from: exportedFrom.value,
              literal: false,
              owner
            })
          }
        }
        // Its names are another module's, not this file's: there is nothing under it to read.
        continue
      }
      // `const { aboutClass: mark } = T` takes the helper out of its namespace under a name the law cannot follow.
      if (node.type === "VariableDeclarator") {
        const pattern = O.filter(nodeAt(node, "id"), (id) => id.type === "ObjectPattern")
        const from = O.flatMap(
          O.flatMap(nodeAt(node, "init"), (init) =>
            bare(init).type === "Identifier" ? textAt(bare(init), "name") : O.none()
          ),
          (name) => R.get(namespaces, name)
        )
        if (O.isSome(pattern) && O.isSome(from)) {
          for (const property of nodesAt(pattern.value, "properties")) {
            const key = keyOf(property, lookup)
            if (O.isSome(key) && A.contains(tracked, key.value)) {
              uses.push({ line: lineOf(property.start), helper: key.value, from: from.value, literal: false, owner })
            }
          }
        }
      }
      // `import x = require("x")`: TypeScript's own form, the module named inside its external reference.
      if (node.type === "TSImportEqualsDeclaration") {
        const required = O.flatMap(nodeAt(node, "moduleReference"), (reference) =>
          reference.type === "TSExternalModuleReference"
            ? O.flatMap(nodeAt(reference, "expression"), stringOf)
            : O.none()
        )
        if (O.isSome(required)) {
          imports.push({ line: lineOf(node.start), specifier: required.value, typeOnly: node["importKind"] === "type" })
        }
        continue
      }
      if (node.type === "CallExpression") {
        const callee = nodeAt(node, "callee")
        const helper = O.flatMap(callee, helperOf)
        if (O.isSome(helper)) {
          uses.push({
            line: lineOf(node.start),
            helper: helper.value.helper,
            from: helper.value.from,
            literal: isLiteralCall(helper.value.helper, nodesAt(node, "arguments")),
            owner
          })
          // The callee is the helper called, not the helper handed on.
          skipped.push("callee")
        }
      } else {
        const handed = helperOf(node)
        if (O.isSome(handed)) {
          uses.push({ line: lineOf(node.start), ...handed.value, literal: false, owner })
          if (node.type === "MemberExpression") continue
        }
      }
      if (node.type === "Identifier") {
        const name = textAt(node, "name")
        if (O.isSome(name)) names.push(name.value)
      }
      // What takes annotations: a call named for it, and the second call of a class's factory, which takes the
      // fields and then the annotations (`class X extends Model.Class<X>("X")(fields, annotations)`).
      const annotated: ReadonlyArray<readonly ["named" | "second", Node]> =
        node.type === "CallExpression"
          ? O.exists(nodeAt(node, "callee"), (callee) => takesAnnotations(callee) === "named")
            ? A.map(nodesAt(node, "arguments"), (given) => ["named", given] as const)
            : []
          : node.type === "ClassDeclaration" || node.type === "ClassExpression"
            ? O.match(O.map(nodeAt(node, "superClass"), bare), {
                onNone: () => [],
                onSome: (parent) =>
                  parent.type === "CallExpression" &&
                  O.exists(nodeAt(parent, "callee"), (callee) => bare(callee).type === "CallExpression")
                    ? A.map(nodesAt(parent, "arguments"), (given) => ["second", given] as const)
                    : []
              })
            : []
      for (const [how, written] of annotated) {
        const given = bare(written)
        if (how === "named") named.push(given.start)
        else second.push(given.start)
        // An annotation given a constant by its name is given that constant's object.
        for (const key of keysBehind(given, how, [])) handKeys.push({ line: lineOf(given.start), key })
      }
      if (node.type === "ObjectExpression") {
        const how = A.contains(named, node.start) ? "named" : A.contains(second, node.start) ? "second" : "none"
        for (const key of handKeysOf(node, how, lookup)) {
          handKeys.push({ line: lineOf(node.start), key })
        }
        // What an annotation object spreads is part of it: an object written in place, or a constant by its name.
        if (how !== "none") {
          for (const spread of nodesAt(node, "properties")) {
            const spreading = spread.type === "SpreadElement" ? O.map(nodeAt(spread, "argument"), bare) : O.none()
            if (O.isNone(spreading)) continue
            if (spreading.value.type === "ObjectExpression") {
              if (how === "named") named.push(spreading.value.start)
              else second.push(spreading.value.start)
            }
            for (const key of keysBehind(spreading.value, how, [])) {
              handKeys.push({ line: lineOf(spread.start), key })
            }
          }
        }
      }
      if (node.type === "Property" && node["computed"] !== true) skipped.push("key")
      if (node.type === "MemberExpression" && node["computed"] !== true) skipped.push("property")
      for (const [key, value] of R.toEntries(node)) {
        if (key === "parent" || A.contains(skipped, key)) continue
        if (A.isArray(value)) {
          for (const next of A.reverse(A.filter(value, isNode))) left.push(next)
        } else if (isNode(value)) left.push(value)
      }
    }
    return A.dedupe(names)
  }

  for (const statement of nodesAt(program, "body")) {
    const named = declared(statement)
    if (A.isReadonlyArrayEmpty(named)) {
      read(statement, O.none())
      continue
    }
    for (const { constant, name, node } of named) {
      declarations.push({ name, line: lineOf(node.start), constant, reads: read(node, O.some(name)) })
    }
  }
  return { uses, declarations, handKeys, imports, unread: O.none() }
}
