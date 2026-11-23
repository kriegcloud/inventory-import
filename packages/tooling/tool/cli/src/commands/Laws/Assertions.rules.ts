/**
 * The lists of the type-assertion ban, held (Benjamin, 2026-11-22: "type assertions are banned"). oxlint refuses the
 * assertions themselves, `x as T` and `<T>x`, with `typescript/consistent-type-assertions` set to never, over every
 * package at once from the root (`.oxlintrc.assertions.json`, `bun run assertions:check`); `as const` stays allowed.
 * What oxlint cannot hold is its own exceptions, so this law holds them:
 *
 * - each file an override of that configuration names still holds an assertion (read from its syntax tree), so a file
 *   whose last one is gone comes off its list;
 * - no list is longer than its ceiling (`assertionCeilings`), and a ceiling above its list is lowered, so a list only
 *   shrinks;
 * - no comment turns the rule off (`oxlint-disable` or `eslint-disable` naming it), in any code file git would commit.
 *
 * @packageDocumentation
 */
import { $RepoCliId } from "@beep/identity/packages"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as R from "effect/Record"
import * as S from "effect/Schema"
import * as Str from "effect/String"
import { Repo } from "../../Repo.service.ts"
import { scratchpadFolder } from "../../Repo.schema.ts"
import { err, type Line, out } from "../../Report.schema.ts"
import { blankComments } from "../../Sync.rules.ts"
import { silencings } from "./internal/directives.ts"
import { heldAs } from "./internal/held.ts"
import { type Ledger, standingOf, standingWords } from "./internal/ledger.ts"
import { children, isNode, type Node, parsedAs } from "./internal/tryCode.ts"

const $I = $RepoCliId.create("commands/Laws/Assertions.rules")

/** The configuration oxlint runs the ban with, from the root. */
export const assertionsConfig = ".oxlintrc.assertions.json"

/**
 * How long each list of `assertionsConfig` may be, in the order its overrides stand: beep-effect's vendored kit, the
 * registry's components, and everyone else's files. Each only falls: lower it when a list shrinks.
 */
export const assertionCeilings: ReadonlyArray<number> = [23, 33, 60]

const isCode = (file: string) => Str.match(/\.[cm]?[jt]sx?$/)(file).pipe(O.isSome)
const leftOut = [".agents/", ".codex/", `${scratchpadFolder}/`, "vendor/"]

/** Each listed file with its number of assertions today, which only falls. */
export const assertionCounts: Ledger = {
  "apps/inventory/src/api/v1/Document.ts": 3,
  "apps/inventory/src/web/lib/form.ts": 1,
  "apps/inventory/src/web/pages/ReviewGallery.tsx": 1,
  "apps/inventory/src/web/pages/gallery/JobsReview.tsx": 2,
  "apps/inventory/test/server/Telemetry.test.ts": 2,
  "apps/inventory/test/server/WriteLimits.slow.test.ts": 2,
  "apps/inventory/test/server/support/app.ts": 1,
  "apps/inventory/test/web/session.test.ts": 3,
  "apps/inventory/test/web/workspace.test.ts": 1,
  "apps/inventory/vite.config.ts": 2,
  "packages/access/web/src/People.screen.tsx": 2,
  "packages/catalog/model/src/Catalog.memory.ts": 1,
  "packages/catalog/model/src/Review/CellReading.rules.ts": 2,
  "packages/catalog/model/src/Review/Review.rules.ts": 3,
  "packages/catalog/model/src/Suggestion/Suggest.rules.ts": 1,
  "packages/catalog/web/src/ItemsPage.screen.tsx": 5,
  "packages/catalog/web/src/TableAssistant.screen.tsx": 2,
  "packages/catalog/web/src/internal/CellForms.tsx": 2,
  "packages/catalog/web/src/internal/cellDrafts.ts": 1,
  "packages/catalog/web/src/internal/itemText.ts": 1,
  "packages/catalog/web/test/ConfirmDraft.test.ts": 4,
  "packages/catalog/web/test/DraftLines.test.ts": 1,
  "packages/catalog/web/test/DraftPicks.test.ts": 1,
  "packages/catalog/web/test/DraftRegion.test.ts": 3,
  "packages/catalog/web/test/DraftServer.test.ts": 1,
  "packages/catalog/web/test/ItemEditor.test.ts": 8,
  "packages/catalog/web/test/KeptRows.test.ts": 1,
  "packages/catalog/web/test/RemoveImport.test.ts": 1,
  "packages/catalog/web/test/ResultRows.test.ts": 1,
  "packages/catalog/web/test/ReviewDraft.test.ts": 7,
  "packages/catalog/web/test/TabRows.test.ts": 20,
  "packages/catalog/web/test/TakenBackWords.test.ts": 1,
  "packages/catalog/web/test/UploadOwner.test.ts": 6,
  "packages/catalog/web/test/csvDifferential.test.ts": 1,
  "packages/catalog/web/test/readerWarnings.test.ts": 1,
  "packages/catalog/web/test/support/catalog.ts": 6,
  "packages/catalog/web/test/support/draftWorld.ts": 1,
  "packages/catalog/web/test/xlsxParity.test.ts": 1,
  "packages/client/src/Api.atoms.ts": 2,
  "packages/client/src/ApiRuntime.runtime.ts": 2,
  "packages/drivers/better-auth/test/BetterAuth.test.ts": 2,
  "packages/drivers/d1/src/D1.service.ts": 4,
  "packages/drivers/d1/test/D1.test.ts": 1,
  "packages/drivers/d1/test/D1Schemas.property.test.ts": 2,
  "packages/drivers/openrouter/test/OpenRouterSchemas.property.test.ts": 2,
  "packages/foundation/modeling/csv/src/Csv.codec.ts": 9,
  "packages/foundation/modeling/csv/test/CsvSchemas.property.test.ts": 2,
  "packages/foundation/modeling/csv/test/oracle.property.test.ts": 1,
  "packages/foundation/modeling/identity/src/Curie.ts": 1,
  "packages/foundation/modeling/identity/src/Fibered.ts": 6,
  "packages/foundation/modeling/identity/src/Id.ts": 22,
  "packages/foundation/modeling/identity/src/internal/schemaStatics.ts": 1,
  "packages/foundation/modeling/identity/test/Identity.test.ts": 5,
  "packages/foundation/modeling/identity/test/OntologyEntrypoints.test.ts": 2,
  "packages/foundation/modeling/identity/test/PnLocal.test.ts": 1,
  "packages/foundation/modeling/identity/test/TemplateGuards.test.ts": 2,
  "packages/foundation/modeling/schema/src/LiteralKit/LiteralKit.schema.ts": 14,
  "packages/foundation/modeling/schema/src/LiteralKit/internal/builders.ts": 10,
  "packages/foundation/modeling/schema/src/SchemaUtils/internal/staticDescriptors.ts": 1,
  "packages/foundation/modeling/schema/src/SchemaUtils/withStatics.ts": 1,
  "packages/foundation/modeling/schema/test/LiteralKit.test.ts": 16,
  "packages/foundation/modeling/utils/src/FileSystem.ts": 1,
  "packages/foundation/modeling/utils/src/GlobalValue.ts": 1,
  "packages/foundation/modeling/utils/src/Option.ts": 1,
  "packages/foundation/modeling/utils/src/Predicate.ts": 2,
  "packages/foundation/modeling/utils/src/Random.ts": 2,
  "packages/foundation/modeling/utils/src/Struct.ts": 6,
  "packages/foundation/modeling/utils/src/internal/StructPath.ts": 1,
  "packages/foundation/modeling/utils/test/Array.test.ts": 8,
  "packages/foundation/modeling/utils/test/Option.test.ts": 3,
  "packages/foundation/modeling/utils/test/Struct.test.ts": 9,
  "packages/foundation/modeling/xlsx/src/internal/trusted.ts": 1,
  "packages/foundation/modeling/xlsx/test/XlsxSchemas.property.test.ts": 2,
  "packages/foundation/modeling/xlsx/test/oracle.property.test.ts": 3,
  "packages/review/src/ReviewRegion.atoms.ts": 1,
  "packages/review/src/ReviewRegion.component.tsx": 5,
  "packages/review/test/Review.test.ts": 1,
  "packages/review/test/ReviewDecision.property.test.ts": 2,
  "packages/review/test/ReviewRegion.atoms.test.ts": 11,
  "packages/review/test/SavedProgress.test.ts": 1,
  "packages/review/test/fixtures/fabrication.ts": 1,
  "packages/ui/src/ListTable.component.tsx": 7,
  "packages/ui/src/TableSearch.component.tsx": 1,
  "packages/ui/src/components/action-bar.tsx": 2,
  "packages/ui/src/components/chart.tsx": 8,
  "packages/ui/src/components/data-grid/data-grid-cell.tsx": 1,
  "packages/ui/src/components/data-grid/data-grid-column-header.tsx": 1,
  "packages/ui/src/components/data-grid/data-grid-context-menu.tsx": 1,
  "packages/ui/src/components/data-grid/data-grid-data-cell.tsx": 2,
  "packages/ui/src/components/data-grid/data-grid-features.ts": 7,
  "packages/ui/src/components/data-grid/data-grid-paste-dialog.tsx": 1,
  "packages/ui/src/components/data-grid/data-grid-row-models.ts": 16,
  "packages/ui/src/components/data-grid/data-grid-row.tsx": 2,
  "packages/ui/src/components/data-grid/data-grid-search.tsx": 1,
  "packages/ui/src/components/data-grid/data-grid-utils.ts": 3,
  "packages/ui/src/components/data-grid/data-grid.tsx": 1,
  "packages/ui/src/components/data-grid/use-data-grid.ts": 1,
  "packages/ui/src/components/data-table/data-table-config.ts": 4,
  "packages/ui/src/components/data-table/data-table-features.ts": 1,
  "packages/ui/src/components/data-table/data-table-filters.ts": 2,
  "packages/ui/src/components/data-table/data-table-records.tsx": 2,
  "packages/ui/src/components/data-table/data-table-state.ts": 10,
  "packages/ui/src/components/data-table/data-table-toolbar.tsx": 4,
  "packages/ui/src/components/data-table/data-table-utils.ts": 2,
  "packages/ui/src/components/data-table/data-table.tsx": 2,
  "packages/ui/src/components/faceted.tsx": 1,
  "packages/ui/src/components/form.tsx": 2,
  "packages/ui/src/components/input-group.tsx": 1,
  "packages/ui/src/components/sidebar.tsx": 3,
  "packages/ui/src/components/sonner.tsx": 2,
  "packages/ui/src/components/sortable.tsx": 3,
  "packages/ui/src/components/stepper.tsx": 2,
  "packages/ui/src/components/sticky-table.tsx": 1,
  "packages/ui/src/components/toggle-group.tsx": 1,
  "packages/ui/src/components/tour.tsx": 15,
  "packages/ui/src/hooks/use-data-table.ts": 1
}

/**
 * What each list is held by, from its contents (`internal/held.ts`), in the order the overrides stand: a file swapped
 * for another changes the number, and the law refuses the list until it is recorded again. Recorded only when files
 * came off.
 */
export const assertionsHeld: ReadonlyArray<number> = [153817800, -322494103, -948430337]

/** An override that turns the rule off for the files it lists, and nothing else. */
const Override = S.Struct({
  files: S.Array(S.String).pipe(S.annotateKey({ description: "The files the rule is off for, from the root" })),
  rules: S.Struct({ "typescript/consistent-type-assertions": S.Literal("off") }).pipe(
    S.annotateKey({ description: "The rule, off, and no other" })
  )
})

/**
 * The configuration as it must be: the one rule, an error with no assertion style allowed, every other rule off, the
 * folders not read as written here, and three lists. A path added to `ignorePatterns`, a rule changed or a fourth list
 * would let a file go unread, so any of them refuses the whole.
 */
const Profile = S.fromJsonString(
  S.Struct({
    $schema: S.optionalKey(S.String).pipe(S.annotateKey({ description: "oxlint's own schema, for an editor" })),
    plugins: S.Tuple([S.Literal("typescript")]).pipe(S.annotateKey({ description: "The one plugin the rule is in" })),
    categories: S.Struct({ correctness: S.Literal("off") }).pipe(
      S.annotateKey({ description: "The rules on by default, off: each package's own lint runs them" })
    ),
    rules: S.Struct({
      "typescript/consistent-type-assertions": S.Tuple([
        S.Literal("error"),
        S.Struct({ assertionStyle: S.Literal("never") })
      ])
    }).pipe(S.annotateKey({ description: "The one rule, an error, no assertion allowed" })),
    ignorePatterns: S.Tuple([
      S.Literal(".agents/**"),
      S.Literal(".codex/**"),
      S.Literal("scratchpad/**"),
      S.Literal("vendor/**"),
      S.Literal("**/node_modules/**"),
      S.Literal("**/dist/**"),
      S.Literal("**/.wrangler/**"),
      S.Literal("**/.turbo/**"),
      S.Literal(".claude/**")
    ]).pipe(S.annotateKey({ description: "What is not read: what is no source of ours" })),
    overrides: S.Tuple([Override, Override, Override]).pipe(
      S.annotateKey({ description: "The three lists: the vendored kit, the registry's components, everyone else's" })
    )
  }).pipe(
    $I.annoteSchema("AssertionsProfile", { description: "The type-assertion ban's configuration, as it must be" })
  )
)

/** Whether a directive turns the rule off: it names it, under either plugin's spelling. */
const silences = (rules: ReadonlyArray<string>) =>
  A.some(rules, (name) => Str.endsWith("consistent-type-assertions")(name))

/**
 * Whether `source` holds a type assertion: `x as T` with any type but `const`, or `<T>x`.
 *
 * @example holdsAssertion({ file: "a.ts", source: "export const a = [1] as const" }) // false
 */
export const holdsAssertion = (input: { readonly file: string; readonly source: string }): boolean =>
  countAssertions(input) > 0

/**
 * How many type assertions `source` holds: `x as T` with any type but `const`, and `<T>x`.
 *
 * @example countAssertions({ file: "a.ts", source: "export const a = (1 as number) as unknown" }) // 2
 */
export const countAssertions = (input: { readonly file: string; readonly source: string }): number => {
  const read = parsedAs(input)
  if (O.isNone(read.program)) return 0
  const asConst = (node: Node) => {
    const type = node["typeAnnotation"]
    return (
      isNode(type) &&
      type.type === "TSTypeReference" &&
      isNode(type["typeName"]) &&
      type["typeName"]["name"] === "const"
    )
  }
  let count = 0
  const left: Array<Node> = [read.program.value]
  while (A.isArrayNonEmpty(left)) {
    const node = A.lastNonEmpty(left)
    left.splice(-1, 1)
    if (node.type === "TSTypeAssertion" || (node.type === "TSAsExpression" && !asConst(node))) count += 1
    for (const next of children(node)) left.push(next)
  }
  return count
}

/**
 * What `laws assertions` finds: the lists hold, or each way they do not.
 *
 * @category schemas
 */
export const AssertionsFinding = S.TaggedUnion({
  Clean: {
    listed: S.Int.pipe(S.annotateKey({ description: "How many files the lists name" }))
  },
  Refused: {},
  Unreadable: {
    why: S.String.pipe(S.annotateKey({ description: "Why the configuration or git's list could not be read" }))
  },
  Standing: {
    file: S.String.pipe(S.annotateKey({ description: "A listed file whose number of assertions moved" })),
    words: S.String.pipe(S.annotateKey({ description: "How it moved, and what to do" }))
  },
  Uncounted: {
    file: S.String.pipe(
      S.annotateKey({ description: "A listed file with no number held, or a number for no listed file" })
    )
  },
  Grown: {
    list: S.Int.pipe(S.annotateKey({ description: "Which list, from 1, in the order the overrides stand" })),
    length: S.Int.pipe(S.annotateKey({ description: "How many files it names" })),
    ceiling: S.Int.pipe(S.annotateKey({ description: "How many it may name" }))
  },
  Shrunk: {
    list: S.Int.pipe(S.annotateKey({ description: "Which list, from 1" })),
    length: S.Int.pipe(S.annotateKey({ description: "How many files it names" })),
    ceiling: S.Int.pipe(S.annotateKey({ description: "The ceiling still written for it" }))
  },
  Changed: {
    list: S.Int.pipe(S.annotateKey({ description: "Which list, from 1" })),
    held: S.Finite.pipe(S.annotateKey({ description: "The number the list is held by" })),
    now: S.Finite.pipe(S.annotateKey({ description: "The number its files give now" }))
  },
  Silenced: {
    place: S.String.pipe(S.annotateKey({ description: "The file and line of the comment, as file:line" })),
    directive: S.String.pipe(S.annotateKey({ description: "The comment's directive, as written" }))
  }
}).pipe(
  $I.annoteSchema("AssertionsFinding", {
    description: "The type-assertion ban's lists only shrink and name only files that still hold one"
  })
)

/**
 * The decoded value of `AssertionsFinding`.
 *
 * @category models
 */
export type AssertionsFinding = typeof AssertionsFinding.Type

/**
 * The line each finding prints.
 *
 * @category rendering
 */
export const assertionsSentence: (finding: AssertionsFinding) => Line = AssertionsFinding.match({
  Clean: ({ listed }) =>
    out(`assertions:check OK  the type-assertion ban's lists name ${listed} files, each still holding one`),
  Refused: () => err(`assertions:check FAIL  the type-assertion ban's lists (${assertionsConfig}) do not hold:`),
  Unreadable: ({ why }) => err(`  ${why}`),
  Standing: ({ file, words }) => err(`  ${file}  ${words}`),
  Uncounted: ({ file }) =>
    err(
      `  ${file}  is in one of the lists of ${assertionsConfig} or in assertionCounts but not both: the two name the same files`
    ),
  Grown: ({ ceiling, length, list }) =>
    err(
      `  list ${list} names ${length} files, past its ceiling of ${ceiling}: a list only shrinks. Fix the code instead`
    ),
  Shrunk: ({ ceiling, length, list }) =>
    err(`  list ${list} names ${length} files: lower its ceiling from ${ceiling} to ${length} in assertionCeilings`),
  Changed: ({ held, list, now }) =>
    err(
      `  list ${list} names other files than the ones it is held by (${held}): it may only shrink. If files came off it because they are clean, record ${now} in assertionsHeld; never add one`
    ),
  Silenced: ({ directive, place }) =>
    err(`  ${place}  a comment that turns the type-assertion rule off (${directive}): no comment does. Remove it`)
})

/**
 * Reads the configuration's lists and every code file git would commit, holding each list to `holds`.
 *
 * @category rules
 */
/** What the lists are held to: each one's ceiling and the number its contents give, in the order they stand. */
export interface AssertionHolds {
  readonly ceilings: ReadonlyArray<number>
  readonly held: ReadonlyArray<number>
  /** Each listed file with its number of assertions, which only falls (`internal/ledger.ts`). */
  readonly counts: Ledger
}

/** The holds this repository records. */
export const recordedHolds: AssertionHolds = {
  ceilings: assertionCeilings,
  held: assertionsHeld,
  counts: assertionCounts
}

export const assertions = Effect.fn("Assertions.assertions")(function* (holds: AssertionHolds) {
  const repo = yield* Repo
  const refused = (problems: ReadonlyArray<AssertionsFinding>) =>
    A.prepend<AssertionsFinding, AssertionsFinding>(problems, AssertionsFinding.cases.Refused.make({}))
  const text = yield* repo.text(repo.join(repo.root, assertionsConfig))
  const config = S.decodeOption(Profile, { onExcessProperty: "error" })(blankComments(text))
  if (O.isNone(config)) {
    return refused([
      AssertionsFinding.cases.Unreadable.make({
        why: `${assertionsConfig} is not the profile this law holds: one rule, an error, assertionStyle never, the folders not read as written in the law, and three lists`
      })
    ])
  }
  const lists = A.map(config.value.overrides, (override) => override.files)
  const lengths = A.flatMap(
    A.zip(lists, A.zip(holds.ceilings, holds.held)),
    ([files, [ceiling, held]], index): ReadonlyArray<AssertionsFinding> => {
      const list = index + 1
      const now = heldAs(files)
      const changed = now === held ? [] : [AssertionsFinding.cases.Changed.make({ list, held, now })]
      if (files.length > ceiling) {
        return [AssertionsFinding.cases.Grown.make({ list, length: files.length, ceiling }), ...changed]
      }
      if (files.length < ceiling) {
        return [AssertionsFinding.cases.Shrunk.make({ list, length: files.length, ceiling }), ...changed]
      }
      return changed
    }
  )
  const listed = A.flatten(lists)
  // Each listed file at its number of assertions, which only falls; a file in one of the two and not the other is
  // refused, since then nothing holds it.
  const standings = yield* Effect.forEach(
    listed,
    Effect.fnUntraced(function* (file) {
      const path = repo.join(repo.root, file)
      const now = (yield* repo.exists(path)) ? countAssertions({ file, source: yield* repo.text(path) }) : 0
      return O.match(standingOf(holds.counts, { file, now }), {
        onNone: () => A.of<AssertionsFinding>(AssertionsFinding.cases.Uncounted.make({ file })),
        onSome: (standing) =>
          O.match(standingWords(standing, "assertionCounts"), {
            onNone: () => A.empty<AssertionsFinding>(),
            onSome: (words) => A.of<AssertionsFinding>(AssertionsFinding.cases.Standing.make({ file, words }))
          })
      })
    }),
    { concurrency: 1 }
  )
  const counted = A.map(
    A.filter(R.keys(holds.counts), (file) => !A.contains(listed, file)),
    (file) => AssertionsFinding.cases.Uncounted.make({ file })
  )
  const git = yield* repo.run("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard", "--deduplicate"])
  if (git.code !== 0) {
    return refused([
      AssertionsFinding.cases.Unreadable.make({ why: `git could not list the files: ${Str.trim(git.stderr)}` })
    ])
  }
  const code = yield* Effect.filter(
    A.filter(
      Str.split("\0")(git.stdout),
      (file) => isCode(file) && !A.some(leftOut, (path) => Str.startsWith(path)(file))
    ),
    (file) => repo.exists(repo.join(repo.root, file)),
    { concurrency: 1 }
  )
  const silenced = yield* Effect.forEach(
    code,
    (file) =>
      Effect.map(repo.text(repo.join(repo.root, file)), (source) =>
        A.map(silencings({ text: source, silences }), ({ directive, line }) =>
          AssertionsFinding.cases.Silenced.make({ place: `${file}:${line}`, directive })
        )
      ),
    { concurrency: 1 }
  )
  const problems = A.flatten<ReadonlyArray<ReadonlyArray<AssertionsFinding>>>([
    lengths,
    A.flatten(standings),
    counted,
    A.flatten(silenced)
  ])
  return A.isReadonlyArrayNonEmpty(problems)
    ? refused(problems)
    : A.of<AssertionsFinding>(AssertionsFinding.cases.Clean.make({ listed: listed.length }))
})
