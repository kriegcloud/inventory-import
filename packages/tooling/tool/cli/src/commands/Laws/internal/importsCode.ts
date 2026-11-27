// The modules one file imports, read from its syntax tree: `import … from "x"`, `export … from "x"`, `import "x"`,
// `import x = require("x")`, `import("x")` with a written-out name (a string, or a template with nothing put into it,
// `import(\`x\`)`), and the type `import("x")` (`typeof import("x")`, `import("x").T`). A pattern over the text would
// also take the word out of a comment, and an import planted in a test's fixture text for one of the file's own.
import * as A from "effect/Array"
import * as O from "effect/Option"
import * as P from "effect/Predicate"
import * as R from "effect/Record"
import { parseSync } from "oxc-parser"

/** A node of the syntax tree. */
type Node = Readonly<Record<string, unknown>> & { readonly type: string }

const isNode = (value: unknown): value is Node => P.isObject(value) && P.isString(value["type"])
const children = (node: Node): ReadonlyArray<Node> =>
  A.flatMap(R.toEntries(node), ([key, value]) =>
    key === "parent" ? [] : A.isArray(value) ? A.filter(value, isNode) : isNode(value) ? [value] : []
  )

const importing = [
  "ImportDeclaration",
  "ExportNamedDeclaration",
  "ExportAllDeclaration",
  "ImportExpression",
  "TSImportType"
]

/** The name a specifier writes out: a string, or a template with nothing put into it (`\`./x.ts\``). */
const writtenOf = (source: Node): O.Option<string> =>
  source.type === "TemplateLiteral"
    ? A.isArray(source["expressions"]) && A.isReadonlyArrayEmpty(source["expressions"])
      ? O.flatMap(A.head(A.isArray(source["quasis"]) ? A.filter(source["quasis"], isNode) : []), (quasi) =>
          O.flatMap(O.liftPredicate(quasi["value"], P.isObject), (value) =>
            O.liftPredicate(value["cooked"], P.isString)
          )
        )
      : O.none()
    : O.liftPredicate(source["value"], P.isString)

/**
 * Every module specifier `source` imports or re-exports, in the order written.
 *
 * @example readImports({ file: "a.ts", source: 'import * as A from "effect/Array"' }) // ["effect/Array"]
 */
export const readImports = (input: { readonly file: string; readonly source: string }): ReadonlyArray<string> => {
  const { program } = parseSync(input.file, input.source)
  if (!isNode(program)) return []
  const found: Array<string> = []
  const walk = (node: Node): void => {
    if (A.contains(importing, node.type)) {
      const named = O.liftPredicate(node["source"], isNode).pipe(O.flatMap(writtenOf))
      if (O.isSome(named)) found.push(named.value)
    }
    // `import x = require("x")`: TypeScript's own form, the module named inside its external reference.
    if (node.type === "TSImportEqualsDeclaration") {
      const required = O.liftPredicate(node["moduleReference"], isNode).pipe(
        O.filter((reference) => reference.type === "TSExternalModuleReference"),
        O.flatMap((reference) => O.liftPredicate(reference["expression"], isNode)),
        O.flatMap((literal) => O.liftPredicate(literal["value"], P.isString))
      )
      if (O.isSome(required)) found.push(required.value)
    }
    for (const next of children(node)) walk(next)
  }
  walk(program)
  return found
}
