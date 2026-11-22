// One test per member of every rule's finding union: the member, made with its own constructor, is a value of its schema
// and prints its sentence.
// Each table is keyed by the union's own tags, so a new member without a row here does not compile.
import { describe, expect, it } from "@effect/vitest"
import * as O from "effect/Option"
import * as P from "effect/Predicate"
import * as R from "effect/Record"
import * as S from "effect/Schema"
import { OkfFinding, okfSentence } from "../src/commands/Docs/Okf.rules.ts"
import { BoundariesFinding, boundariesSentence } from "../src/commands/Laws/Boundaries.rules.ts"
import { DeprecatedApisFinding, deprecatedApisSentence } from "../src/commands/Laws/DeprecatedApis.rules.ts"
import {
  EffectImportsFinding,
  effectImportsSentence,
  faultSentence,
  ImportFault,
  leftSentence,
  RepairLeft
} from "../src/commands/Laws/EffectImports.schema.ts"
import { ExportsFinding, exportsSentence } from "../src/commands/Laws/Exports.rules.ts"
import { KeysFinding, keysSentence } from "../src/commands/Laws/Keys.rules.ts"
import { ScreensFinding, screensSentence } from "../src/commands/Laws/Screens.rules.ts"
import { CeilingsFinding, ceilingsSentence } from "../src/commands/Quality/Ceilings.rules.ts"
import { StrictFinding, strictSentence } from "../src/commands/Quality/Strict.rules.ts"
import { VendorCheckFinding, vendorCheckSentence } from "../src/commands/Vendor/VendorCheck.rules.ts"
import { VendorSyncFinding, vendorSyncSentence } from "../src/commands/Vendor/VendorSync.rules.ts"
import type { Line } from "../src/Report.schema.ts"

type Rows<F extends { readonly _tag: string }> = {
  readonly [K in F["_tag"]]: readonly [finding: Extract<F, { readonly _tag: K }>, printed: string]
}

const members = <F extends { readonly _tag: string }>(
  name: string,
  schema: S.Codec<F, unknown> & { readonly guards: Readonly<Record<string, (input: unknown) => boolean>> },
  sentence: (finding: F) => Line | string,
  rows: Rows<F>
) =>
  describe(name, () => {
    for (const [tag, row] of R.toEntries<string, readonly [F, string]>(rows)) {
      it(tag, () => {
        const [finding, printed] = row
        // The row's key is the member's own case, told by the union's guard for it.
        expect(O.exists(R.get(schema.guards, tag), (is) => is(finding))).toBe(true)
        expect(S.is(schema)(finding)).toBe(true)
        const said = sentence(finding)
        expect(P.isString(said) ? said : `${said.to}: ${said.text}`).toBe(printed)
      })
    }
  })

members<DeprecatedApisFinding>("laws deprecated-apis", DeprecatedApisFinding, deprecatedApisSentence, {
  Clean: [DeprecatedApisFinding.cases.Clean.make({}), "out: deprecated:check OK  no deprecated API is used"],
  Refused: [
    DeprecatedApisFinding.cases.Refused.make({}),
    "err: deprecated:check FAIL  a deprecated API is used. Move to what its note names:"
  ],
  At: [
    DeprecatedApisFinding.cases.At.make({ place: "a.ts:1:2", note: "`old` is deprecated. use next" }),
    "err: a.ts:1:2  `old` is deprecated. use next"
  ],
  Unlisted: [
    DeprecatedApisFinding.cases.Unlisted.make({ why: "not a git repository" }),
    "err: deprecated:check FAIL  git could not list the files, so none was checked: not a git repository"
  ],
  Unread: [
    DeprecatedApisFinding.cases.Unread.make({ listed: 2, read: 1 }),
    "err: deprecated:check FAIL  oxlint read 1 of 2 files: .oxlintrc.deprecated-apis.json leaves none out (no ignorePatterns)"
  ],
  Unowned: [
    DeprecatedApisFinding.cases.Unowned.make({ file: "packages/a/test/a.test.ts" }),
    "err: deprecated:check FAIL  packages/a/test/a.test.ts is in no tsconfig, so it is read without its package's types: include it in one the root tsconfig.json references"
  ]
})

members<CeilingsFinding>("quality ceilings", CeilingsFinding, ceilingsSentence, {
  Ceiling: [CeilingsFinding.cases.Ceiling.make({ where: "packages/ui", ceiling: 52 }), "out:   packages/ui: 52"],
  Sum: [CeilingsFinding.cases.Sum.make({ sum: 666, cap: 678 }), "out: ceilings:check  sum 666, cap 678"],
  AboveCap: [
    CeilingsFinding.cases.AboveCap.make({ sum: 679, cap: 678 }),
    "err: ceilings:check FAIL  the stage C ceilings add up to 679, above 678"
  ]
})

members<StrictFinding>("quality strict", StrictFinding, strictSentence, {
  NoPlugin: [
    StrictFinding.cases.NoPlugin.make({}),
    "err: check:strict FAIL  no @effect/language-service plugin in tsconfig.base.json"
  ],
  Drift: [
    StrictFinding.cases.Drift.make({}),
    "err: check:strict FAIL  the package's plugin options differ from the root's outside `overrides`: copy the root's block again"
  ],
  NoCeilingFile: [
    StrictFinding.cases.NoCeilingFile.make({}),
    "err: check:strict FAIL  name the ceiling file: beep-cli quality strict strict-ceiling.json"
  ],
  Ledger: [
    StrictFinding.cases.Ledger.make({
      rules: ["preferEffectArray", "preferEffectString"],
      own: ["src/", "test/fixtures/"]
    }),
    "out: Stage C ledger: preferEffectArray, preferEffectString in own code (src/, test/fixtures/)."
  ],
  RuleCount: [
    StrictFinding.cases.RuleCount.make({ rule: "preferEffectArray", count: 216 }),
    "out:   preferEffectArray: 216"
  ],
  At: [
    StrictFinding.cases.At.make({ file: "src/Review.rules.ts", line: 76, column: 75 }),
    "out:     src/Review.rules.ts:76:75"
  ],
  More: [StrictFinding.cases.More.make({ count: 213 }), "out:     and 213 more (--all lists them)"],
  Total: [
    StrictFinding.cases.Total.make({ total: 283, ceiling: 283, seconds: "1.6" }),
    "out: Total: 283, ceiling 283 (1.6 s)."
  ],
  Above: [
    StrictFinding.cases.Above.make({ by: 17 }),
    "err: check:strict FAIL  17 new finding(s) above the ceiling: write them the Effect way"
  ],
  Below: [
    StrictFinding.cases.Below.make({ total: 22, ceilingFile: "strict-ceiling.json" }),
    'err: check:strict FAIL  the count fell to 22: set "ceiling" to 22 in strict-ceiling.json'
  ]
})

members<ExportsFinding>("laws exports", ExportsFinding, exportsSentence, {
  Exact: [
    ExportsFinding.cases.Exact.make({ name: "@inventory/ui", entries: 135 }),
    "out: check-exports OK  @inventory/ui: 135 exact entries"
  ],
  Refused: [ExportsFinding.cases.Refused.make({ name: "@inventory/ui" }), "err: check-exports FAIL  @inventory/ui"],
  Wildcard: [ExportsFinding.cases.Wildcard.make({ key: "./wild/*" }), "err:   ./wild/*: a wildcard export"],
  NamesNoFile: [ExportsFinding.cases.NamesNoFile.make({ key: "./Gone" }), "err:   ./Gone: names no file"],
  Unlisted: [
    ExportsFinding.cases.Unlisted.make({ file: "src/components/new.tsx" }),
    "err:   src/components/new.tsx: no export entry"
  ]
})

members<KeysFinding>("laws keys", KeysFinding, keysSentence, {
  Clean: [KeysFinding.cases.Clean.make({}), "out: keys:check OK  no key-shaped string in any file git would commit"],
  Refused: [KeysFinding.cases.Refused.make({}), "err: keys:check FAIL  a key-shaped string is in:"],
  At: [KeysFinding.cases.At.make({ place: "src/a.ts:2" }), "err: src/a.ts:2"]
})

members<BoundariesFinding>("laws boundaries", BoundariesFinding, boundariesSentence, {
  Held: [BoundariesFinding.cases.Held.make({ workspaces: 23 }), "out: check-boundaries OK  23 workspaces"],
  Refused: [BoundariesFinding.cases.Refused.make({}), "err: check-boundaries FAIL"],
  DeclaredAgainstRow: [
    BoundariesFinding.cases.DeclaredAgainstRow.make({ name: "@inventory/kernel", dependency: "@inventory/ui" }),
    "err:   @inventory/kernel declares @inventory/ui, which its layer may not use"
  ],
  IntoApps: [
    BoundariesFinding.cases.IntoApps.make({
      where: "packages/kernel/src/a.ts",
      specifier: "../../../apps/inventory/src/x"
    }),
    'err:   packages/kernel/src/a.ts imports "../../../apps/inventory/src/x": a package never reaches into apps/'
  ],
  Undeclared: [
    BoundariesFinding.cases.Undeclared.make({
      where: "packages/kernel/src/a.ts",
      imported: "@inventory/ui",
      name: "@inventory/kernel"
    }),
    "err:   packages/kernel/src/a.ts imports @inventory/ui, which @inventory/kernel does not declare"
  ],
  UndeclaredThirdParty: [
    BoundariesFinding.cases.UndeclaredThirdParty.make({
      where: "packages/ui/src/a.tsx",
      imported: "use-callback-ref",
      name: "@inventory/ui"
    }),
    "err:   packages/ui/src/a.tsx imports use-callback-ref, which @inventory/ui does not declare (add it where it is used)"
  ],
  TestOnly: [
    BoundariesFinding.cases.TestOnly.make({
      where: "packages/review/src/a.ts",
      imported: "@tanstack/store",
      name: "@inventory/review"
    }),
    "err:   packages/review/src/a.ts imports @tanstack/store, which @inventory/review declares only for its tests (devDependencies): declare it in dependencies, or keep it in test"
  ],
  ImportedAgainstRow: [
    BoundariesFinding.cases.ImportedAgainstRow.make({ where: "packages/kernel/src/a.ts", imported: "@inventory/ui" }),
    "err:   packages/kernel/src/a.ts imports @inventory/ui, which its layer may not use"
  ]
})

members<ScreensFinding>("laws screens", ScreensFinding, screensSentence, {
  Listed: [
    ScreensFinding.cases.Listed.make({ names: ["@inventory/ui", "@inventory/review"] }),
    "out: check-screens OK  2 packages with screens, each in both lists: @inventory/ui, @inventory/review"
  ],
  Refused: [ScreensFinding.cases.Refused.make({}), "err: check-screens FAIL"],
  NoBlock: [
    ScreensFinding.cases.NoBlock.make({}),
    "err:   apps/inventory/vite.config.ts has no `const screenPackages = { ... }` to read"
  ],
  NoSource: [
    ScreensFinding.cases.NoSource.make({
      name: "@inventory/ui",
      where: "packages/ui",
      add: "../../../../packages/ui/src"
    }),
    'err:   @inventory/ui has screens (packages/ui/src) and no `@source` line in apps/inventory/src/web/index.css: add @source "../../../../packages/ui/src";'
  ],
  NotListed: [
    ScreensFinding.cases.NotListed.make({ name: "@inventory/ui", where: "packages/ui" }),
    "err:   @inventory/ui has screens and is not in `screenPackages` in apps/inventory/vite.config.ts with its folder (packages/ui): the production stylesheet would lack its classes"
  ],
  NoPackage: [
    ScreensFinding.cases.NoPackage.make({ name: "@inventory/ghost", where: "packages/ghost" }),
    "err:   screenPackages names @inventory/ghost at packages/ghost, which is no package"
  ],
  NoFolder: [
    ScreensFinding.cases.NoFolder.make({ where: "packages/nowhere/src" }),
    "err:   index.css names the source packages/nowhere/src, which does not exist"
  ]
})

const kitFile = "packages/foundation/modeling/utils/src/Array.ts"
members<VendorCheckFinding>("vendor check", VendorCheckFinding, vendorCheckSentence, {
  Matched: [
    VendorCheckFinding.cases.Matched.make({ files: 90, packages: 4, againstSource: true }),
    "out: vendor:check: 90 vendored files in 4 packages match their recorded hashes and beep-effect"
  ],
  Patched: [
    VendorCheckFinding.cases.Patched.make({ file: kitFile, patches: 2, commit: "c5cebd5c9de7" }),
    `out: vendor:check: patched on purpose: ${kitFile} (2 patches, against beep-effect c5cebd5c9de7)`
  ],
  Missing: [
    VendorCheckFinding.cases.Missing.make({ file: kitFile }),
    `err: ${kitFile}: listed in vendor.json but missing`
  ],
  NoProvenance: [
    VendorCheckFinding.cases.NoProvenance.make({
      file: kitFile,
      expected: "// Vendored from beep-effect c5cebd5c9de7:x/src/Array.ts"
    }),
    `err: ${kitFile}: the first line is not its provenance line (// Vendored from beep-effect c5cebd5c9de7:x/src/Array.ts …)`
  ],
  Changed: [
    VendorCheckFinding.cases.Changed.make({ file: kitFile, sha256: "abc" }),
    `err: ${kitFile}: changed since it was vendored (sha256 abc)`
  ],
  HashDiffers: [
    VendorCheckFinding.cases.HashDiffers.make({ file: kitFile }),
    `err: ${kitFile}: copied without rewrites, yet its hash differs from its source hash`
  ],
  PatchEqualsUpstream: [
    VendorCheckFinding.cases.PatchEqualsUpstream.make({ file: kitFile }),
    `err: ${kitFile}: lists a patch, yet equals upstream`
  ],
  PatchWithoutReason: [
    VendorCheckFinding.cases.PatchWithoutReason.make({ file: kitFile }),
    `err: ${kitFile}: a patch has no reason`
  ],
  PatchUnsaid: [
    VendorCheckFinding.cases.PatchUnsaid.make({ file: kitFile }),
    `err: ${kitFile}: patched, but its first line does not say so`
  ],
  SourceHashWrong: [
    VendorCheckFinding.cases.SourceHashWrong.make({ file: kitFile, commit: "c5cebd5c9de7" }),
    `err: ${kitFile}: the recorded source hash is not that of beep-effect c5cebd5c9de7`
  ],
  Stray: [VendorCheckFinding.cases.Stray.make({ file: kitFile }), `err: ${kitFile}: not vendored and not a local file`],
  ExportsDiffer: [
    VendorCheckFinding.cases.ExportsDiffer.make({ where: "packages/foundation/modeling/utils" }),
    "err: packages/foundation/modeling/utils/package.json: exports differ from those recorded in vendor.json"
  ],
  Failed: [VendorCheckFinding.cases.Failed.make({ problems: 1 }), "err: vendor:check failed: 1 problem"]
})

members<VendorSyncFinding>("vendor sync", VendorSyncFinding, vendorSyncSentence, {
  Vendored: [
    VendorSyncFinding.cases.Vendored.make({ name: "@beep/utils", sources: 27, tests: 15 }),
    "out: @beep/utils: 27 source files, 15 tests"
  ],
  From: [VendorSyncFinding.cases.From.make({ commit: "c5cebd5c9de7" }), "out: from beep-effect c5cebd5c9de7"]
})

members<OkfFinding>("docs check", OkfFinding, okfSentence, {
  ValidatorMissing: [
    OkfFinding.cases.ValidatorMissing.make({ validator: "/repo/validate.sh" }),
    "err: docs:check FAIL  the OKF validator is missing (/repo/validate.sh): the okf-open-knowledge-format skill is not installed."
  ],
  ToolMissing: [
    OkfFinding.cases.ToolMissing.make({ tool: "awk" }),
    "err: docs:check FAIL  'awk' is not installed. The OKF validator needs it."
  ],
  SortWithoutZ: [
    OkfFinding.cases.SortWithoutZ.make({}),
    "err: docs:check FAIL  this 'sort' has no -z option. The OKF validator needs GNU or BSD sort."
  ],
  NoMarkdown: [
    OkfFinding.cases.NoMarkdown.make({ bundle: "docs" }),
    "err: docs:check FAIL  there are no markdown files under docs/."
  ],
  Printed: [OkfFinding.cases.Printed.make({ text: "W1: a warning" }), "out: W1: a warning"],
  NotConformant: [
    OkfFinding.cases.NotConformant.make({ bundle: "goals" }),
    "err: docs:check FAIL  goals/ is not a conformant OKF bundle. Fix each E line above: a file outside index.md and log.md starts on\n" +
      "    line 1 with a --- frontmatter block that has type:, and only docs/index.md may have frontmatter among the\n" +
      "    index.md files. The okf-open-knowledge-format skill has the rules; any file in docs/standards/ shows the fields."
  ],
  ScannedWrong: [
    OkfFinding.cases.ScannedWrong.make({ bundle: "docs", scanned: "", expected: 68 }),
    "err: docs:check FAIL  the validator scanned no files of the 68 in docs/, so it did not run properly."
  ],
  Conformant: [
    OkfFinding.cases.Conformant.make({ bundle: "docs", files: 68 }),
    "out: docs:check OK  all 68 markdown files in docs/ conform to OKF v0.2 (--verbose for the full report)"
  ]
})

// The statements are put together from two halves, so the rule does not read this file's rows as its own imports.
const line = (clause: string, source: string) => `import ${clause} from "${source}"`
const optionLine = line("* as O", "effect/Option")

members<ImportFault>("laws effect-imports, one import", ImportFault, faultSentence, {
  UnknownPath: [
    ImportFault.cases.UnknownPath.make({ source: "effect/Strings", package: "effect" }),
    'unknown-path: "effect/Strings" is not a path of the installed effect'
  ],
  BarrelBare: [
    ImportFault.cases.BarrelBare.make({ kind: "root-barrel", source: "effect" }),
    'root-barrel: "effect" is a barrel. Import each module from its own path'
  ],
  BarrelWhole: [
    ImportFault.cases.BarrelWhole.make({ kind: "nested-barrel", source: "effect/http" }),
    'nested-barrel: "effect/http" is a barrel and cannot be imported whole. Import each module from its own path'
  ],
  BarrelModule: [
    ImportFault.cases.BarrelModule.make({
      kind: "root-barrel",
      imported: "Option",
      source: "effect",
      write: optionLine
    }),
    `root-barrel: Option from "effect". Write: ${optionLine}`
  ],
  BarrelFunction: [
    ImportFault.cases.BarrelFunction.make({ kind: "root-barrel", imported: "pipe" }),
    `root-barrel: pipe from "effect". Write: ${line("{ pipe }", "effect/Function")}`
  ],
  BarrelNoModule: [
    ImportFault.cases.BarrelNoModule.make({
      kind: "nested-barrel",
      imported: "Whatever",
      source: "effect/sql",
      leaf: "effect/sql/Whatever"
    }),
    'nested-barrel: Whatever from "effect/sql", and "effect/sql/Whatever" is not a module. Find its module and import that'
  ],
  Alias: [
    ImportFault.cases.Alias.make({ source: "effect/Option", local: "Option", write: optionLine, others: ["Opt"] }),
    `alias: "effect/Option" as Option. Write: ${optionLine} (or Opt)`
  ],
  NamedImport: [
    ImportFault.cases.NamedImport.make({ imported: "some", source: "effect/Option", write: optionLine, name: "O" }),
    `named-import: some from "effect/Option". Write: ${optionLine} and O.some`
  ],
  ReExport: [
    ImportFault.cases.ReExport.make({ source: "effect" }),
    `re-export from "effect", a barrel. Re-export from the module's own path`
  ],
  DynamicImport: [
    ImportFault.cases.DynamicImport.make({ source: "effect/sql" }),
    `import("effect/sql") loads a barrel. Load the module's own path`
  ]
})

members<RepairLeft>("laws effect-imports, what a repair leaves", RepairLeft, leftSentence, {
  SharedName: [RepairLeft.cases.SharedName.make({}), "two modules would share one name: repair this file by hand"],
  Overlap: [RepairLeft.cases.Overlap.make({}), "overlapping edits: repair this file by hand"],
  DeclaredAgain: [
    RepairLeft.cases.DeclaredAgain.make({ name: "Option", to: "O" }),
    "Option is declared again inside the file: rename its uses to O by hand"
  ]
})

members<EffectImportsFinding>("laws effect-imports", EffectImportsFinding, effectImportsSentence, {
  Wrote: [
    EffectImportsFinding.cases.Wrote.make({ changed: 211, files: 595 }),
    "out: check-effect-imports wrote 211 of 595 files"
  ],
  Held: [
    EffectImportsFinding.cases.Held.make({ files: 597 }),
    "out: check-effect-imports OK  597 files, every Effect import from its own path under its own name"
  ],
  Refused: [
    EffectImportsFinding.cases.Refused.make({ problems: 15, files: 599 }),
    "err: check-effect-imports FAIL  15 in 599 files (docs/standards/effect-imports.md)"
  ],
  Left: [
    EffectImportsFinding.cases.Left.make({ file: "src/a.ts", left: RepairLeft.cases.Overlap.make({}) }),
    "err:   src/a.ts  overlapping edits: repair this file by hand"
  ],
  Fault: [
    EffectImportsFinding.cases.Fault.make({
      file: "src/a.ts",
      line: 12,
      inComment: true,
      fault: ImportFault.cases.ReExport.make({ source: "effect" })
    }),
    `err:   src/a.ts:12  in a comment, re-export from "effect", a barrel. Re-export from the module's own path`
  ]
})
