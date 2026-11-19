/**
 * What `laws effect-imports` finds, as data: each way one import is wrong, what a repair had to leave for a person,
 * and the rule's own lines around them.
 *
 * @packageDocumentation
 */
import { $RepoCliId } from "@beep/identity/packages"
import { LiteralKit } from "@beep/schema/LiteralKit"
import * as A from "effect/Array"
import * as S from "effect/Schema"
import { err, type Line, out } from "../../Report.schema.ts"

const $I = $RepoCliId.create("commands/Laws/EffectImports.schema")

/**
 * Which barrel an import came through: the package's root, or a folder of modules.
 *
 * @category schemas
 */
export const BarrelKind = LiteralKit(["root-barrel", "nested-barrel"]).pipe(
  $I.annoteSchema("BarrelKind", { description: "The root barrel, or a folder of modules" })
)

const kind = BarrelKind.pipe(S.annotateKey({ description: "The root barrel, or a folder of modules" }))
const source = S.String.pipe(S.annotateKey({ description: "The specifier the import names" }))
const imported = S.String.pipe(S.annotateKey({ description: "The name picked out of it" }))
const write = S.String.pipe(S.annotateKey({ description: "The import line to write instead" }))

/**
 * One way an import is wrong.
 *
 * @category schemas
 */
export const ImportFault = S.TaggedUnion({
  UnknownPath: {
    source,
    package: S.String.pipe(S.annotateKey({ description: "The installed package that has no such path" }))
  },
  BarrelBare: { kind, source },
  BarrelWhole: { kind, source },
  BarrelModule: { kind, imported, source, write },
  BarrelFunction: { kind, imported },
  BarrelNoModule: {
    kind,
    imported,
    source,
    leaf: S.String.pipe(S.annotateKey({ description: "The path that would be its module, and is not one" }))
  },
  Alias: {
    source,
    local: S.String.pipe(S.annotateKey({ description: "The name the file gave the module" })),
    write,
    others: S.Array(S.String).pipe(S.annotateKey({ description: "Other names the module may take" }))
  },
  NamedImport: {
    imported,
    source,
    write,
    name: S.String.pipe(S.annotateKey({ description: "The module's name, to reach the value through" }))
  },
  ReExport: { source },
  DynamicImport: { source }
}).pipe($I.annoteSchema("ImportFault", { description: "One way an Effect import is not the house form" }))

/**
 * The decoded value of `ImportFault`.
 *
 * @category models
 */
export type ImportFault = typeof ImportFault.Type

/**
 * The sentence for one fault, ending with the line to write.
 *
 * @category rendering
 */
export const faultSentence: (fault: ImportFault) => string = ImportFault.match({
  UnknownPath: (fault) => `unknown-path: "${fault.source}" is not a path of the installed ${fault.package}`,
  BarrelBare: (fault) => `${fault.kind}: "${fault.source}" is a barrel. Import each module from its own path`,
  BarrelWhole: (fault) =>
    `${fault.kind}: "${fault.source}" is a barrel and cannot be imported whole. Import each module from its own path`,
  BarrelModule: (fault) => `${fault.kind}: ${fault.imported} from "${fault.source}". Write: ${fault.write}`,
  BarrelFunction: (fault) =>
    `${fault.kind}: ${fault.imported} from "effect". Write: import { ${fault.imported} } from "effect/Function"`,
  BarrelNoModule: (fault) =>
    `${fault.kind}: ${fault.imported} from "${fault.source}", and "${fault.leaf}" is not a module. Find its module and import that`,
  Alias: (fault) =>
    `alias: "${fault.source}" as ${fault.local}. Write: ${fault.write}` +
    (A.isReadonlyArrayNonEmpty(fault.others) ? ` (or ${A.join(fault.others, ", ")})` : ""),
  NamedImport: (fault) =>
    `named-import: ${fault.imported} from "${fault.source}". Write: ${fault.write} and ${fault.name}.${fault.imported}`,
  ReExport: (fault) => `re-export from "${fault.source}", a barrel. Re-export from the module's own path`,
  DynamicImport: (fault) => `import("${fault.source}") loads a barrel. Load the module's own path`
})

/**
 * What a repair could not do and left for a person.
 *
 * @category schemas
 */
export const RepairLeft = S.TaggedUnion({
  SharedName: {},
  Overlap: {},
  DeclaredAgain: {
    name: S.String.pipe(S.annotateKey({ description: "The name that is declared again inside the file" })),
    to: S.String.pipe(S.annotateKey({ description: "The name its uses should take" }))
  }
}).pipe($I.annoteSchema("RepairLeft", { description: "What a repair left for a person, and why" }))

/**
 * The decoded value of `RepairLeft`.
 *
 * @category models
 */
export type RepairLeft = typeof RepairLeft.Type

/**
 * The sentence for what a repair left.
 *
 * @category rendering
 */
export const leftSentence: (left: RepairLeft) => string = RepairLeft.match({
  SharedName: () => "two modules would share one name: repair this file by hand",
  Overlap: () => "overlapping edits: repair this file by hand",
  DeclaredAgain: ({ name, to }) => `${name} is declared again inside the file: rename its uses to ${to} by hand`
})

const files = S.Int.pipe(S.annotateKey({ description: "How many files were read" }))
const file = S.String.pipe(S.annotateKey({ description: "The file, from the root" }))

/**
 * What the rule says: what it wrote, every file in order, or a refusal and each fault and leftover with its place.
 *
 * @category schemas
 */
export const EffectImportsFinding = S.TaggedUnion({
  Wrote: {
    changed: S.Int.pipe(S.annotateKey({ description: "How many files the repair changed" })),
    files
  },
  Held: { files },
  Refused: {
    problems: S.Int.pipe(S.annotateKey({ description: "How many faults and leftovers were found" })),
    files
  },
  Left: {
    file,
    left: RepairLeft.pipe(S.annotateKey({ description: "What the repair left in that file" }))
  },
  Fault: {
    file,
    line: S.Int.pipe(S.annotateKey({ description: "The line the import starts on, from 1" })),
    inComment: S.Boolean.pipe(S.annotateKey({ description: "Whether the import is an example in a comment" })),
    fault: ImportFault.pipe(S.annotateKey({ description: "What is wrong with it" }))
  }
}).pipe($I.annoteSchema("EffectImportsFinding", { description: "Every import in the house form, or each that is not" }))

/**
 * The decoded value of `EffectImportsFinding`.
 *
 * @category models
 */
export type EffectImportsFinding = typeof EffectImportsFinding.Type

/**
 * The line each finding prints.
 *
 * @category rendering
 */
export const effectImportsSentence: (finding: EffectImportsFinding) => Line = EffectImportsFinding.match({
  Wrote: ({ changed, files: read }) => out(`check-effect-imports wrote ${changed} of ${read} files`),
  Held: ({ files: read }) =>
    out(`check-effect-imports OK  ${read} files, every Effect import from its own path under its own name`),
  Refused: ({ problems, files: read }) =>
    err(`check-effect-imports FAIL  ${problems} in ${read} files (docs/standards/effect-imports.md)`),
  Left: ({ file: where, left }) => err(`  ${where}  ${leftSentence(left)}`),
  Fault: ({ file: where, line, inComment, fault }) =>
    err(`  ${where}:${line}  ${inComment ? "in a comment, " : ""}${faultSentence(fault)}`)
})
