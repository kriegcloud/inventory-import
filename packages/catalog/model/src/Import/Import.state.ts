// Where an import is in its life, and the rules that hold of every state of it. Read as a namespace named
// `ImportState`: `ImportState.State`, `ImportState.Open`, `ImportState.guards.Open`.
import * as Effect from "effect/Effect"
import * as S from "effect/Schema"
import { Change, Columns } from "../Review/Change.schema.ts"

/**
 * What every import that was staged and not removed keeps, whatever its status. `replaced` adds each confirm's
 * `updated`, the sender's count, so an item replaced by two confirms counts twice, and nothing bounds it but what the
 * senders said.
 */
const staged = {
  organizationId: S.String.pipe(S.annotateKey({ description: "The organization the import belongs to" })),
  rows: S.Natural.pipe(S.annotateKey({ description: "How many rows the file has" })),
  confirms: S.Int.pipe(
    S.annotateKey({
      description:
        "How many times it was confirmed: an act names it, so one made before a confirm is not taken after a reopen"
    })
  ),
  matching: S.Int.pipe(S.annotateKey({ description: "The number of its last match" })),
  columns: Columns.pipe(S.annotateKey({ description: "Which column fills each field" })),
  changes: Change.pipe(S.annotateKey({ description: "The number of its last change" })),
  confirmedAt: Change.pipe(
    S.annotateKey({ description: "The number of the last confirm that stands; 0 when none does" })
  ),
  inForce: S.Natural.pipe(S.annotateKey({ description: "Items its confirms created that are in force" })),
  replaced: S.Natural.pipe(
    S.annotateKey({
      description: "Replacements its confirms made that were not put back: a count of replacements, not of items"
    })
  ),
  standing: S.Natural.pipe(S.annotateKey({ description: "Its confirms not taken back" })),
  lastGroup: Change.pipe(
    S.annotateKey({ description: "The number of the last act on a group, its undo included; 0 when there was none" })
  ),
  topGroup: Change.pipe(
    S.annotateKey({ description: "The change of the last group still in force; 0 when there is none" })
  )
}

/** Where every count of an open import starts. */
const zero = Effect.succeed(0)

/**
 * **Details**
 *
 * It is the aggregate's initial state, and the only one `StageImport` accepts.
 *
 * **Example** (Start an import with no file)
 *
 * ```ts
 * import * as ImportState from "./Import.state.ts"
 *
 * const initial = ImportState.Unstaged.make({})
 *
 * initial.status // => "Unstaged"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Unstaged extends S.Opaque<Unstaged, { readonly brand: unique symbol }>()(
  S.Struct({
    status: S.tag("Unstaged")
  }).annotate({ description: "An import no file was staged for" })
) {}

/**
 * **Details**
 *
 * Staging names its organization, its rows and its columns; every count starts at zero, so `Open.make` of those
 * three is a staged import. `suggestions` counts this opening only: a reopen starts it at zero again.
 *
 * **Example** (Stage an import with its counts at zero)
 *
 * ```ts
 * import * as ImportState from "./Import.state.ts"
 *
 * const staged = ImportState.Open.make({ organizationId: "org-1", rows: 120, columns: "sku=A;name=B" })
 *
 * staged.status // => "Open"
 * staged.changes // => 0
 * staged.confirms // => 0
 * staged.suggestions // => 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Open extends S.Opaque<Open, { readonly brand: unique symbol }>()(
  S.Struct({
    status: S.tag("Open"),
    ...staged,
    confirms: staged.confirms.pipe(S.withConstructorDefault(zero)),
    matching: staged.matching.pipe(S.withConstructorDefault(zero)),
    changes: staged.changes.pipe(S.withConstructorDefault(zero)),
    confirmedAt: staged.confirmedAt.pipe(S.withConstructorDefault(zero)),
    inForce: staged.inForce.pipe(S.withConstructorDefault(zero)),
    replaced: staged.replaced.pipe(S.withConstructorDefault(zero)),
    standing: staged.standing.pipe(S.withConstructorDefault(zero)),
    lastGroup: staged.lastGroup.pipe(S.withConstructorDefault(zero)),
    topGroup: staged.topGroup.pipe(S.withConstructorDefault(zero)),
    suggestions: S.Int.pipe(
      S.annotateKey({ description: "How many suggestions were recorded in this opening" }),
      S.withConstructorDefault(zero)
    )
  }).annotate({ description: "An import that is open for review" })
) {}

/**
 * **Gotchas**
 *
 * No count has a constructor default: each is carried from the state before, so a field left out of `make` is a type
 * error, not a silent zero.
 *
 * @category models
 * @since 0.0.0
 */
export class Imported extends S.Opaque<Imported, { readonly brand: unique symbol }>()(
  S.Struct({
    status: S.tag("Imported"),
    ...staged,
    created: S.Natural.pipe(S.annotateKey({ description: "Rows its confirm created an item for" })),
    updated: S.Natural.pipe(S.annotateKey({ description: "Rows its confirm replaced an item with" })),
    already: S.Natural.pipe(S.annotateKey({ description: "Rows whose item was already as the file says" })),
    notImported: S.Natural.pipe(S.annotateKey({ description: "Rows its confirm did not import" }))
  }).annotate({ description: "An import that was confirmed: what its confirm did with each row" })
) {}

/**
 * **Details**
 *
 * Only a take-back of a confirmed import leads here; a take-back of an open import leaves it open. Nothing stands
 * after it, and what is in force is what it kept.
 *
 * **Gotchas**
 *
 * No count has a constructor default: each is carried from the state before, so a field left out of `make` is a type
 * error, not a silent zero.
 *
 * @category models
 * @since 0.0.0
 */
export class TakenBack extends S.Opaque<TakenBack, { readonly brand: unique symbol }>()(
  S.Struct({
    status: S.tag("TakenBack"),
    ...staged,
    removed: S.Natural.pipe(S.annotateKey({ description: "Items the take-back removed" })),
    kept: S.Natural.pipe(S.annotateKey({ description: "Items the take-back kept in force" }))
  }).annotate({ description: "An import that was taken back: what was removed and what was kept" })
) {}

/**
 * **Details**
 *
 * It keeps only its organization, and no step leaves it.
 *
 * **Example** (Remove an import, keeping its organization)
 *
 * ```ts
 * import * as ImportState from "./Import.state.ts"
 *
 * const removed = ImportState.Removed.make({ organizationId: "org-1" })
 *
 * removed.status // => "Removed"
 * removed.organizationId // => "org-1"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Removed extends S.Opaque<Removed, { readonly brand: unique symbol }>()(
  S.Struct({
    status: S.tag("Removed"),
    organizationId: staged.organizationId
  }).annotate({ description: "An import that was removed" })
) {}

/**
 * **Details**
 *
 * The cases are told by `status`. Whatever its status, a staged import that was not removed holds the number of its
 * last act on a group and of the last group still in force.
 *
 * **Example** (Say where an import is)
 *
 * ```ts
 * import * as ImportState from "./Import.state.ts"
 *
 * const summary = ImportState.State.match({
 *   Unstaged: () => "no file",
 *   Open: (open) => `open at change ${open.changes}`,
 *   Imported: (imported) => `${imported.created} created`,
 *   TakenBack: (takenBack) => `${takenBack.removed} removed`,
 *   Removed: () => "removed"
 * })
 *
 * summary(ImportState.Open.make({ organizationId: "org-1", rows: 3, columns: "sku=A" })) // => "open at change 0"
 * summary(ImportState.Unstaged.make({})) // => "no file"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const State = S.Union([Unstaged, Open, Imported, TakenBack, Removed])
  .annotate({ description: "Where one import is in its life, with its counts and the number of its last change" })
  .pipe(S.toTaggedUnion("status"))
/**
 * One import's state as `State` decodes it: one of its five cases.
 *
 * @category models
 * @since 0.0.0
 */
export type State = typeof State.Type
/**
 * The guards, the cases and `isAnyOf` of `State`, so the file read as a namespace reads as the state does:
 * `ImportState.guards.Open(s)`.
 *
 * **Details**
 *
 * Each guard checks the whole case against its schema, not only `status`.
 *
 * **Example** (Tell a state's case)
 *
 * ```ts
 * import * as ImportState from "./Import.state.ts"
 *
 * const s: ImportState.State = ImportState.Open.make({ organizationId: "org-1", rows: 3, columns: "sku=A" })
 *
 * ImportState.guards.Open(s) // => true
 * ImportState.isAnyOf(["Imported", "TakenBack"])(s) // => false
 *
 * if (ImportState.guards.Open(s)) {
 *   s.suggestions // => 0
 * }
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const { guards, cases, isAnyOf } = State

/**
 * **Details**
 *
 * A read that shows where an import is takes its status from here, so it cannot name a status no case has.
 *
 * @category models
 * @since 0.0.0
 */
export const Status = S.Literals(["Unstaged", "Open", "Imported", "TakenBack", "Removed"] satisfies ReadonlyArray<
  State["status"]
>).annotate({ description: "Where an import is in its life, as a status" })
/**
 * The decoded value of `Status`: the `status` of one of `State`'s five cases.
 *
 * @category models
 * @since 0.0.0
 */
export type Status = typeof Status.Type

/**
 * A confirmed import's four outcomes add up to the rows in its file, as its command stated them: created, updated,
 * already as the file says, and not imported.
 *
 * @category rules
 * @since 0.0.0
 */
export const OutcomesAddUpToTheRows = (s: State): boolean =>
  !State.guards.Imported(s) || s.created + s.updated + s.already + s.notImported === s.rows

/**
 * A staged import never has more items in force than its file has rows.
 *
 * @category rules
 * @since 0.0.0
 */
export const NoMoreInForceThanRows = (s: State): boolean =>
  State.guards.Unstaged(s) || State.guards.Removed(s) || s.inForce <= s.rows

/**
 * What says "taken back" has no confirm standing.
 *
 * @category rules
 * @since 0.0.0
 */
export const NothingStandsThatWasTakenBack = (s: State): boolean => !State.guards.TakenBack(s) || s.standing === 0

/**
 * What a taken-back import has in force is what its take-back kept.
 *
 * @category rules
 * @since 0.0.0
 */
export const WhatIsInForceThenIsWhatWasKept = (s: State): boolean => !State.guards.TakenBack(s) || s.inForce === s.kept
