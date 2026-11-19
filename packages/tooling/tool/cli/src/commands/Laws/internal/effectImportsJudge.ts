// What is wrong with one Effect import, and the import statements found by pattern in prose and comments. Pure: what
// the installed packages hold is read once, by the rule, and handed in as `Installed`.
import * as A from "effect/Array"
import * as HashSet from "effect/HashSet"
import * as O from "effect/Option"
import * as R from "effect/Record"
import * as Str from "effect/String"
import type { ImportFault } from "../EffectImports.schema.ts"

/** The modules whose namespace name is not the module's own. beep-effect: effect-laws-v1 law 1, EF-4. */
const aliases: Readonly<Record<string, ReadonlyArray<string>>> = {
  "effect/Array": ["A"],
  "effect/Option": ["O"],
  "effect/Predicate": ["P"],
  "effect/Record": ["R"],
  "effect/Schema": ["S"],
  "effect/String": ["Str"],
  "effect/Equal": ["Eq"],
  "effect/Boolean": ["Bool"],
  "effect/Function": ["F"],
  "effect/BigInt": ["BI"],
  "effect/RegExp": ["Regex"],
  // beep-effect writes both Num and N; Benjamin chose Num (explorations/ideal-architecture/DECISIONS.md).
  "effect/Number": ["Num"]
}
/** Packages whose root is imported by name, as beep-effect does: the test runner's `describe`, `it`, `layer`. */
export const namedRoots: ReadonlyArray<string> = ["@effect/vitest", "@effect/atom-react"]
/** Modules a value may be picked from by name. */
const namedLeaves: ReadonlyArray<string> = ["effect/Function", "@effect/vitest/utils"]

/** Whether a specifier is an Effect package's. */
export const isEffect = (source: string): boolean =>
  source === "effect" || Str.startsWith("effect/")(source) || Str.startsWith("@effect/")(source)

/** The package a specifier belongs to. */
export const packageOf = (source: string): string =>
  Str.startsWith("@")(source) ? A.join(A.take(Str.split("/")(source), 2), "/") : "effect"
const subpathOf = (source: string): string => Str.slice(packageOf(source).length + 1)(source)

/**
 * What the installed Effect packages hold: for each package found, the files under its `dist`; and the names of the
 * flat functions `effect/Function` exports.
 */
export interface Installed {
  readonly dist: Readonly<Record<string, HashSet.HashSet<string>>>
  readonly functionNames: ReadonlyArray<string>
}

/** One name an import statement binds. */
export interface Specifier {
  readonly kind: "namespace" | "named" | "default"
  readonly imported: string
  readonly local: string
  readonly type: boolean
}

/** A wrong import: where it starts, what is wrong with it, and whether it is an example in a comment. */
export interface Hit {
  readonly offset: number
  readonly fault: ImportFault
  readonly inComment: boolean
}

/** "barrel" for a package root or a folder of modules, "leaf" for one module, "missing" for neither. */
export const shapeOf =
  (installed: Installed) =>
  (source: string): "barrel" | "leaf" | "missing" => {
    const files = R.get(installed.dist, packageOf(source))
    if (O.isNone(files)) return "leaf" // not installed where this rule can see it: not this rule's business
    const subpath = subpathOf(source)
    if (subpath === "") return "barrel"
    if (HashSet.has(files.value, `${subpath}/index.js`)) return "barrel"
    return HashSet.has(files.value, `${subpath}.js`) ? "leaf" : "missing"
  }

/** The names a module may take: its listed one, or the last part of its path. */
export const canonicalOf = (source: string): readonly [string, ...Array<string>] => {
  const listed = aliases[source]
  return listed !== undefined && A.isReadonlyArrayNonEmpty(listed)
    ? listed
    : [Str.slice(O.getOrElse(Str.lastIndexOf("/")(source), () => -1) + 1)(source)]
}

/** The flat functions "effect" re-exports from "effect/Function": `pipe`, `flow`, `identity`, `dual`. */
export const isFunctionExport =
  (installed: Installed) =>
  (name: string): boolean =>
    A.contains(installed.functionNames, name)

/** One import line, the house way. */
export const importLine = (line: { readonly local: string; readonly source: string; readonly type: boolean }): string =>
  `import ${line.type ? "type " : ""}* as ${line.local} from "${line.source}"`

/**
 * What is wrong with one import. `taken` says whether a name is bound by something else in the file.
 */
export const judge =
  (installed: Installed) =>
  (
    source: string,
    specifiers: ReadonlyArray<Specifier>,
    taken: (name: string) => boolean
  ): ReadonlyArray<ImportFault> => {
    const shape = shapeOf(installed)(source)
    if (shape === "missing") return [{ _tag: "UnknownPath", source, package: packageOf(source) }]
    if (shape === "barrel") {
      if (A.contains(namedRoots, source)) return []
      const kind = source === "effect" ? "root-barrel" : "nested-barrel"
      if (specifiers.length === 0) return [{ _tag: "BarrelBare", kind, source }]
      return A.map(specifiers, (specifier): ImportFault => {
        if (specifier.kind !== "named") return { _tag: "BarrelWhole", kind, source }
        const imported = specifier.imported
        const leaf = `${source}/${imported}`
        if (shapeOf(installed)(leaf) === "leaf") {
          const write = importLine({ local: canonicalOf(leaf)[0], source: leaf, type: specifier.type })
          return { _tag: "BarrelModule", kind, imported, source, write }
        }
        if (source === "effect" && isFunctionExport(installed)(imported))
          return { _tag: "BarrelFunction", kind, imported }
        return { _tag: "BarrelNoModule", kind, imported, source, leaf }
      })
    }
    return A.flatMap(specifiers, (specifier): ReadonlyArray<ImportFault> => {
      const names = canonicalOf(source)
      if (specifier.kind === "namespace") {
        if (A.contains(names, specifier.local) || A.every(names, taken)) return []
        return [
          {
            _tag: "Alias",
            source,
            local: specifier.local,
            write: importLine({ local: names[0], source, type: specifier.type }),
            others: A.drop(names, 1)
          }
        ]
      }
      if (specifier.type || A.contains(namedLeaves, source) || !Str.startsWith("effect/")(source)) return []
      return [
        {
          _tag: "NamedImport",
          imported: specifier.imported,
          source,
          write: importLine({ local: names[0], source, type: false }),
          name: names[0]
        }
      ]
    })
  }

// ---------------------------------------------------------------------------------------------------------------
// Examples in comments and documents: import statements found by pattern

const statement =
  /import\s+(type\s+)?(\{[^}]*\}|\*\s+as\s+\w+)\s+from\s+(["'])((?:effect|@effect\/[\w-]+)(?:\/[\w-]+)*)\3/g

const readClause = (clause: string, declaredType: boolean): ReadonlyArray<Specifier> =>
  Str.startsWith("*")(clause)
    ? [{ kind: "namespace", imported: "", local: Str.replace(/^\*\s+as\s+/, "")(clause), type: declaredType }]
    : A.flatMap(Str.split(",")(Str.slice(1, -1)(clause)), (raw) => {
        const part = Str.trim(Str.replace(/[\s*]+/g, " ")(raw))
        const match = /^(type )?(\w+)(?: as (\w+))?$/.exec(part)
        const imported = match?.[2]
        if (part === "" || match === null || imported === undefined) return A.empty<Specifier>()
        return A.of<Specifier>({
          kind: "named",
          imported,
          local: match[3] ?? imported,
          type: declaredType || match[1] !== undefined
        })
      })

interface Found {
  readonly offset: number
  readonly whole: string
  readonly source: string
  readonly specifiers: ReadonlyArray<Specifier>
}

const statementsIn = (text: string): ReadonlyArray<Found> =>
  A.map(A.fromIterable(Str.matchAll(statement)(text)), (match) => ({
    offset: match.index ?? 0,
    whole: match[0],
    source: match[4] ?? "",
    specifiers: readClause(match[2] ?? "", match[1] !== undefined)
  }))

/** The line a character offset is on, from 1. */
export const lineOf =
  (text: string) =>
  (offset: number): number =>
    Str.split("\n")(Str.slice(0, offset)(text)).length

/** The wrong import statements in a stretch of prose or comment, each with the offset it starts at. */
export const judgeText =
  (installed: Installed) =>
  (text: string): ReadonlyArray<Hit> =>
    A.flatMap(statementsIn(text), (found) =>
      A.map(
        judge(installed)(found.source, found.specifiers, () => false),
        (fault) => ({ offset: found.offset, fault, inComment: false })
      )
    )

/** The same stretch with every import statement that can be repaired written the house way. */
export const repairText =
  (installed: Installed) =>
  (text: string): string => {
    const shape = shapeOf(installed)
    const pieces = A.reduce(statementsIn(text), { done: "", at: 0 }, (so, found) => {
      const end = found.offset + found.whole.length
      const keep = { done: so.done + Str.slice(so.at, end)(text), at: end }
      if (judge(installed)(found.source, found.specifiers, () => false).length === 0) return keep
      const lineStart = O.getOrElse(Str.lastIndexOf("\n")(Str.slice(0, found.offset)(text)), () => -1) + 1
      const lead = Str.slice(lineStart, found.offset)(text)
      const lines = A.map(found.specifiers, (specifier): O.Option<string> => {
        if (specifier.kind === "namespace") {
          return shape(found.source) === "leaf"
            ? O.some(importLine({ local: canonicalOf(found.source)[0], source: found.source, type: specifier.type }))
            : O.none()
        }
        const leaf = `${found.source}/${specifier.imported}`
        if (shape(found.source) === "barrel" && shape(leaf) === "leaf") {
          return O.some(importLine({ local: canonicalOf(leaf)[0], source: leaf, type: specifier.type }))
        }
        if (found.source === "effect" && isFunctionExport(installed)(specifier.imported)) {
          return O.some(`import { ${specifier.imported} } from "effect/Function"`)
        }
        return O.none()
      })
      if (A.some(lines, O.isNone)) return keep
      return {
        done: so.done + Str.slice(so.at, found.offset)(text) + A.join(A.getSomes(lines), `\n${lead}`),
        at: end
      }
    })
    return pieces.done + Str.slice(pieces.at)(text)
  }
