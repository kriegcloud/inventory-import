// One test per member of every rule's finding union: the member is a value of its schema, and prints its sentence.
// Each table is keyed by the union's own tags, so a new member without a row here does not compile.
import { describe, expect, it } from "@effect/vitest"
import * as P from "effect/Predicate"
import * as R from "effect/Record"
import * as S from "effect/Schema"
import { OkfFinding, okfSentence } from "../src/commands/Docs/Okf.rules.ts"
import { BoundariesFinding, boundariesSentence } from "../src/commands/Laws/Boundaries.rules.ts"
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
  schema: S.Codec<F, unknown>,
  sentence: (finding: F) => Line | string,
  rows: Rows<F>
) =>
  describe(name, () => {
    for (const [tag, row] of R.toEntries<string, readonly [F, string]>(rows)) {
      it(tag, () => {
        const [finding, printed] = row
        expect(finding._tag).toBe(tag)
        expect(S.is(schema)(finding)).toBe(true)
        const said = sentence(finding)
        expect(P.isString(said) ? said : `${said.to}: ${said.text}`).toBe(printed)
      })
    }
  })

members<CeilingsFinding>("quality ceilings", CeilingsFinding, ceilingsSentence, {
  Ceiling: [{ _tag: "Ceiling", where: "packages/ui", ceiling: 52 }, "out:   packages/ui: 52"],
  Sum: [{ _tag: "Sum", sum: 666, cap: 678 }, "out: ceilings:check  sum 666, cap 678"],
  AboveCap: [
    { _tag: "AboveCap", sum: 679, cap: 678 },
    "err: ceilings:check FAIL  the stage C ceilings add up to 679, above 678"
  ]
})

members<StrictFinding>("quality strict", StrictFinding, strictSentence, {
  NoPlugin: [{ _tag: "NoPlugin" }, "err: check:strict FAIL  no @effect/language-service plugin in tsconfig.base.json"],
  Drift: [
    { _tag: "Drift" },
    "err: check:strict FAIL  the package's plugin options differ from the root's outside `overrides`: copy the root's block again"
  ],
  NoCeilingFile: [
    { _tag: "NoCeilingFile" },
    "err: check:strict FAIL  name the ceiling file: beep-cli quality strict strict-ceiling.json"
  ],
  Ledger: [
    { _tag: "Ledger", rules: ["preferEffectArray", "preferEffectString"], own: ["src/", "test/fixtures/"] },
    "out: Stage C ledger: preferEffectArray, preferEffectString in own code (src/, test/fixtures/)."
  ],
  RuleCount: [{ _tag: "RuleCount", rule: "preferEffectArray", count: 216 }, "out:   preferEffectArray: 216"],
  At: [{ _tag: "At", file: "src/Review.rules.ts", line: 76, column: 75 }, "out:     src/Review.rules.ts:76:75"],
  More: [{ _tag: "More", count: 213 }, "out:     and 213 more (--all lists them)"],
  Total: [{ _tag: "Total", total: 283, ceiling: 283, seconds: "1.6" }, "out: Total: 283, ceiling 283 (1.6 s)."],
  Above: [
    { _tag: "Above", by: 17 },
    "err: check:strict FAIL  17 new finding(s) above the ceiling: write them the Effect way"
  ],
  Below: [
    { _tag: "Below", total: 22, ceilingFile: "strict-ceiling.json" },
    'err: check:strict FAIL  the count fell to 22: set "ceiling" to 22 in strict-ceiling.json'
  ]
})

members<ExportsFinding>("laws exports", ExportsFinding, exportsSentence, {
  Exact: [
    { _tag: "Exact", name: "@inventory/ui", entries: 135 },
    "out: check-exports OK  @inventory/ui: 135 exact entries"
  ],
  Refused: [{ _tag: "Refused", name: "@inventory/ui" }, "err: check-exports FAIL  @inventory/ui"],
  Wildcard: [{ _tag: "Wildcard", key: "./wild/*" }, "err:   ./wild/*: a wildcard export"],
  NamesNoFile: [{ _tag: "NamesNoFile", key: "./Gone" }, "err:   ./Gone: names no file"],
  Unlisted: [{ _tag: "Unlisted", file: "src/components/new.tsx" }, "err:   src/components/new.tsx: no export entry"]
})

members<KeysFinding>("laws keys", KeysFinding, keysSentence, {
  Clean: [{ _tag: "Clean" }, "out: keys:check OK  no key-shaped string in any file git would commit"],
  Refused: [{ _tag: "Refused" }, "err: keys:check FAIL  a key-shaped string is in:"],
  At: [{ _tag: "At", place: "src/a.ts:2" }, "err: src/a.ts:2"]
})

members<BoundariesFinding>("laws boundaries", BoundariesFinding, boundariesSentence, {
  Held: [{ _tag: "Held", workspaces: 23 }, "out: check-boundaries OK  23 workspaces"],
  Refused: [{ _tag: "Refused" }, "err: check-boundaries FAIL"],
  DeclaredAgainstRow: [
    { _tag: "DeclaredAgainstRow", name: "@inventory/kernel", dependency: "@inventory/ui" },
    "err:   @inventory/kernel declares @inventory/ui, which its layer may not use"
  ],
  IntoApps: [
    { _tag: "IntoApps", where: "packages/kernel/src/a.ts", specifier: "../../../apps/inventory/src/x" },
    'err:   packages/kernel/src/a.ts imports "../../../apps/inventory/src/x": a package never reaches into apps/'
  ],
  Undeclared: [
    { _tag: "Undeclared", where: "packages/kernel/src/a.ts", imported: "@inventory/ui", name: "@inventory/kernel" },
    "err:   packages/kernel/src/a.ts imports @inventory/ui, which @inventory/kernel does not declare"
  ],
  ImportedAgainstRow: [
    { _tag: "ImportedAgainstRow", where: "packages/kernel/src/a.ts", imported: "@inventory/ui" },
    "err:   packages/kernel/src/a.ts imports @inventory/ui, which its layer may not use"
  ]
})

members<ScreensFinding>("laws screens", ScreensFinding, screensSentence, {
  Listed: [
    { _tag: "Listed", names: ["@inventory/ui", "@inventory/review"] },
    "out: check-screens OK  2 packages with screens, each in both lists: @inventory/ui, @inventory/review"
  ],
  Refused: [{ _tag: "Refused" }, "err: check-screens FAIL"],
  NoBlock: [
    { _tag: "NoBlock" },
    "err:   apps/inventory/vite.config.ts has no `const screenPackages = { ... }` to read"
  ],
  NoSource: [
    { _tag: "NoSource", name: "@inventory/ui", where: "packages/ui", add: "../../../../packages/ui/src" },
    'err:   @inventory/ui has screens (packages/ui/src) and no `@source` line in apps/inventory/src/web/index.css: add @source "../../../../packages/ui/src";'
  ],
  NotListed: [
    { _tag: "NotListed", name: "@inventory/ui", where: "packages/ui" },
    "err:   @inventory/ui has screens and is not in `screenPackages` in apps/inventory/vite.config.ts with its folder (packages/ui): the production stylesheet would lack its classes"
  ],
  NoPackage: [
    { _tag: "NoPackage", name: "@inventory/ghost", where: "packages/ghost" },
    "err:   screenPackages names @inventory/ghost at packages/ghost, which is no package"
  ],
  NoFolder: [
    { _tag: "NoFolder", where: "packages/nowhere/src" },
    "err:   index.css names the source packages/nowhere/src, which does not exist"
  ]
})

const kitFile = "packages/foundation/modeling/utils/src/Array.ts"
members<VendorCheckFinding>("vendor check", VendorCheckFinding, vendorCheckSentence, {
  Matched: [
    { _tag: "Matched", files: 90, packages: 4, againstSource: true },
    "out: vendor:check: 90 vendored files in 4 packages match their recorded hashes and beep-effect"
  ],
  Patched: [
    { _tag: "Patched", file: kitFile, patches: 2, commit: "c5cebd5c9de7" },
    `out: vendor:check: patched on purpose: ${kitFile} (2 patches, against beep-effect c5cebd5c9de7)`
  ],
  Missing: [{ _tag: "Missing", file: kitFile }, `err: ${kitFile}: listed in vendor.json but missing`],
  NoProvenance: [
    { _tag: "NoProvenance", file: kitFile, expected: "// Vendored from beep-effect c5cebd5c9de7:x/src/Array.ts" },
    `err: ${kitFile}: the first line is not its provenance line (// Vendored from beep-effect c5cebd5c9de7:x/src/Array.ts …)`
  ],
  Changed: [
    { _tag: "Changed", file: kitFile, sha256: "abc" },
    `err: ${kitFile}: changed since it was vendored (sha256 abc)`
  ],
  HashDiffers: [
    { _tag: "HashDiffers", file: kitFile },
    `err: ${kitFile}: copied without rewrites, yet its hash differs from its source hash`
  ],
  PatchEqualsUpstream: [
    { _tag: "PatchEqualsUpstream", file: kitFile },
    `err: ${kitFile}: lists a patch, yet equals upstream`
  ],
  PatchWithoutReason: [{ _tag: "PatchWithoutReason", file: kitFile }, `err: ${kitFile}: a patch has no reason`],
  PatchUnsaid: [{ _tag: "PatchUnsaid", file: kitFile }, `err: ${kitFile}: patched, but its first line does not say so`],
  SourceHashWrong: [
    { _tag: "SourceHashWrong", file: kitFile, commit: "c5cebd5c9de7" },
    `err: ${kitFile}: the recorded source hash is not that of beep-effect c5cebd5c9de7`
  ],
  Stray: [{ _tag: "Stray", file: kitFile }, `err: ${kitFile}: not vendored and not a local file`],
  ExportsDiffer: [
    { _tag: "ExportsDiffer", where: "packages/foundation/modeling/utils" },
    "err: packages/foundation/modeling/utils/package.json: exports differ from those recorded in vendor.json"
  ],
  Failed: [{ _tag: "Failed", problems: 1 }, "err: vendor:check failed: 1 problem"]
})

members<VendorSyncFinding>("vendor sync", VendorSyncFinding, vendorSyncSentence, {
  Vendored: [
    { _tag: "Vendored", name: "@beep/utils", sources: 27, tests: 15 },
    "out: @beep/utils: 27 source files, 15 tests"
  ],
  From: [{ _tag: "From", commit: "c5cebd5c9de7" }, "out: from beep-effect c5cebd5c9de7"]
})

members<OkfFinding>("docs check", OkfFinding, okfSentence, {
  ValidatorMissing: [
    { _tag: "ValidatorMissing", validator: "/repo/validate.sh" },
    "err: docs:check FAIL  the OKF validator is missing (/repo/validate.sh): the okf-open-knowledge-format skill is not installed."
  ],
  ToolMissing: [
    { _tag: "ToolMissing", tool: "awk" },
    "err: docs:check FAIL  'awk' is not installed. The OKF validator needs it."
  ],
  SortWithoutZ: [
    { _tag: "SortWithoutZ" },
    "err: docs:check FAIL  this 'sort' has no -z option. The OKF validator needs GNU or BSD sort."
  ],
  NoMarkdown: [
    { _tag: "NoMarkdown", bundle: "docs" },
    "err: docs:check FAIL  there are no markdown files under docs/."
  ],
  Printed: [{ _tag: "Printed", text: "W1: a warning" }, "out: W1: a warning"],
  NotConformant: [
    { _tag: "NotConformant", bundle: "goals" },
    "err: docs:check FAIL  goals/ is not a conformant OKF bundle. Fix each E line above: a file outside index.md and log.md starts on\n" +
      "    line 1 with a --- frontmatter block that has type:, and only docs/index.md may have frontmatter among the\n" +
      "    index.md files. The okf-open-knowledge-format skill has the rules; any file in docs/standards/ shows the fields."
  ],
  ScannedWrong: [
    { _tag: "ScannedWrong", bundle: "docs", scanned: "", expected: 68 },
    "err: docs:check FAIL  the validator scanned no files of the 68 in docs/, so it did not run properly."
  ],
  Conformant: [
    { _tag: "Conformant", bundle: "docs", files: 68 },
    "out: docs:check OK  all 68 markdown files in docs/ conform to OKF v0.2 (--verbose for the full report)"
  ]
})

// The statements are put together from two halves, so the rule does not read this file's rows as its own imports.
const line = (clause: string, source: string) => `import ${clause} from "${source}"`
const optionLine = line("* as O", "effect/Option")

members<ImportFault>("laws effect-imports, one import", ImportFault, faultSentence, {
  UnknownPath: [
    { _tag: "UnknownPath", source: "effect/Strings", package: "effect" },
    'unknown-path: "effect/Strings" is not a path of the installed effect'
  ],
  BarrelBare: [
    { _tag: "BarrelBare", kind: "root-barrel", source: "effect" },
    'root-barrel: "effect" is a barrel. Import each module from its own path'
  ],
  BarrelWhole: [
    { _tag: "BarrelWhole", kind: "nested-barrel", source: "effect/http" },
    'nested-barrel: "effect/http" is a barrel and cannot be imported whole. Import each module from its own path'
  ],
  BarrelModule: [
    { _tag: "BarrelModule", kind: "root-barrel", imported: "Option", source: "effect", write: optionLine },
    `root-barrel: Option from "effect". Write: ${optionLine}`
  ],
  BarrelFunction: [
    { _tag: "BarrelFunction", kind: "root-barrel", imported: "pipe" },
    `root-barrel: pipe from "effect". Write: ${line("{ pipe }", "effect/Function")}`
  ],
  BarrelNoModule: [
    {
      _tag: "BarrelNoModule",
      kind: "nested-barrel",
      imported: "Whatever",
      source: "effect/sql",
      leaf: "effect/sql/Whatever"
    },
    'nested-barrel: Whatever from "effect/sql", and "effect/sql/Whatever" is not a module. Find its module and import that'
  ],
  Alias: [
    { _tag: "Alias", source: "effect/Option", local: "Option", write: optionLine, others: ["Opt"] },
    `alias: "effect/Option" as Option. Write: ${optionLine} (or Opt)`
  ],
  NamedImport: [
    { _tag: "NamedImport", imported: "some", source: "effect/Option", write: optionLine, name: "O" },
    `named-import: some from "effect/Option". Write: ${optionLine} and O.some`
  ],
  ReExport: [
    { _tag: "ReExport", source: "effect" },
    `re-export from "effect", a barrel. Re-export from the module's own path`
  ],
  DynamicImport: [
    { _tag: "DynamicImport", source: "effect/sql" },
    `import("effect/sql") loads a barrel. Load the module's own path`
  ]
})

members<RepairLeft>("laws effect-imports, what a repair leaves", RepairLeft, leftSentence, {
  SharedName: [{ _tag: "SharedName" }, "two modules would share one name: repair this file by hand"],
  Overlap: [{ _tag: "Overlap" }, "overlapping edits: repair this file by hand"],
  DeclaredAgain: [
    { _tag: "DeclaredAgain", name: "Option", to: "O" },
    "Option is declared again inside the file: rename its uses to O by hand"
  ]
})

members<EffectImportsFinding>("laws effect-imports", EffectImportsFinding, effectImportsSentence, {
  Wrote: [{ _tag: "Wrote", changed: 211, files: 595 }, "out: check-effect-imports wrote 211 of 595 files"],
  Held: [
    { _tag: "Held", files: 597 },
    "out: check-effect-imports OK  597 files, every Effect import from its own path under its own name"
  ],
  Refused: [
    { _tag: "Refused", problems: 15, files: 599 },
    "err: check-effect-imports FAIL  15 in 599 files (docs/standards/effect-imports.md)"
  ],
  Left: [
    { _tag: "Left", file: "src/a.ts", left: { _tag: "Overlap" } },
    "err:   src/a.ts  overlapping edits: repair this file by hand"
  ],
  Fault: [
    { _tag: "Fault", file: "src/a.ts", line: 12, inComment: true, fault: { _tag: "ReExport", source: "effect" } },
    `err:   src/a.ts:12  in a comment, re-export from "effect", a barrel. Re-export from the module's own path`
  ]
})
