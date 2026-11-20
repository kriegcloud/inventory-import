// The modules one file imports, read from its syntax tree: `import … from "x"`, `export … from "x"`, `import "x"`
// and `import("x")` with a written-out name. A pattern over the text would also take the word out of a comment, and
// an import planted in a test's fixture text for one of the file's own.
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

const importing = ["ImportDeclaration", "ExportNamedDeclaration", "ExportAllDeclaration", "ImportExpression"]

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
      const named = O.liftPredicate(node["source"], isNode).pipe(
        O.flatMap((source) => O.liftPredicate(source["value"], P.isString))
      )
      if (O.isSome(named)) found.push(named.value)
    }
    for (const next of children(node)) walk(next)
  }
  walk(program)
  return found
}
