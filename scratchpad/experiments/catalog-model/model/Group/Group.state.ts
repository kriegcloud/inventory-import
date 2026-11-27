// What one act on a group of rows holds. Read as a namespace named `GroupState`: `GroupState.State`,
// `GroupState.Decided`, `GroupState.guards.Decided`.
import * as Effect from "effect/Effect"
import * as S from "effect/Schema"
import { Change, ImportKey, Label, Patch, Rows, Step } from "../Review/Change.schema.ts"
import { Size } from "./Size.schema.ts"

/**
 * The fields an act on a group is decided with, as its event says them and its state keeps them.
 *
 * **Details**
 *
 * `GroupDecided`'s event takes them and adds `under`; the `Decided` case keeps them and adds `undoneAt` and `under`.
 * One record, so the state can never say less of an act than the event it is built from.
 *
 * @category models
 * @since 0.0.0
 */
export const act = {
  importId: ImportKey.pipe(S.annotateKey({ description: "The import the act belongs to" })),
  organizationId: S.String.pipe(S.annotateKey({ description: "The organization of that import" })),
  change: Change.pipe(S.annotateKey({ description: "The change of its import that recorded it" })),
  by: S.String.pipe(S.annotateKey({ description: "The member who made it" })),
  step: Step.pipe(S.annotateKey({ description: "The step it was made in, which names the group" })),
  patch: Patch.pipe(S.annotateKey({ description: "What it does to each of its rows, as one text" })),
  rows: Rows.pipe(S.annotateKey({ description: "The rows it names, as one text" })),
  count: Size.pipe(S.annotateKey({ description: "How many rows it says it covers" })),
  madeOn: S.Int.pipe(S.annotateKey({ description: "The import's matching it was made on" })),
  label: Label.pipe(S.annotateKey({ description: "What the act was called on screen" }))
}

/**
 * @category models
 * @since 0.0.0
 */
export class Untouched extends S.Opaque<Untouched, { readonly brand: unique symbol }>()(
  S.Struct({
    status: S.tag("Untouched")
  }).annotate({ description: "A group no act was decided for" })
) {}

/**
 * **Details**
 *
 * `undoneAt` is the change that took the act back, or 0 while it is in force: an act is decided in force, so `make`
 * gives the 0 where none is written.
 *
 * **Example** (Decided in force, then taken back)
 *
 * ```ts
 * import * as Change from "../Review/Change.schema.ts"
 * import * as GroupState from "./Group.state.ts"
 *
 * const decided = GroupState.Decided.make({
 *   importId: Change.ImportKey.make("imp-1"),
 *   organizationId: "org-1",
 *   change: 5,
 *   by: "ana",
 *   step: "s-4",
 *   patch: '{"brand":"Acme"}',
 *   rows: '["row-1","row-2"]',
 *   count: 2,
 *   madeOn: 1,
 *   label: "Fill brand",
 *   under: 0
 * })
 *
 * decided.undoneAt // => 0
 * GroupState.Decided.make({ ...decided, undoneAt: 7 }).undoneAt // => 7
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Decided extends S.Opaque<Decided, { readonly brand: unique symbol }>()(
  S.Struct({
    status: S.tag("Decided"),
    ...act,
    undoneAt: Change.pipe(
      S.annotateKey({ description: "The change that took it back; 0 while it is in force" }),
      S.withConstructorDefault(Effect.succeed(0))
    ),
    under: Change.pipe(
      S.annotateKey({ description: "The last group in force on the import when this one was decided; 0 for none" })
    )
  }).annotate({ description: "An act on a group of rows as it was decided, in force or taken back" })
) {}

/**
 * Whether an act on a group still gives its rows what it decided.
 *
 * **Details**
 *
 * `undoneAt` is the change that took the act back, and 0 says none did: a change is numbered from 1. The model's
 * invariants ask it by this name, so the 0 is read here, beside the default that writes it.
 *
 * @category behavior
 * @since 0.0.0
 */
export const inForce = (group: Decided): boolean => group.undoneAt === 0

/**
 * **Details**
 *
 * A group holds nothing yet, or the act as it was decided, in force or taken back.
 *
 * @category models
 * @since 0.0.0
 */
export const State = S.Union([Untouched, Decided])
  .annotate({ description: "What one act on a group of rows holds" })
  .pipe(S.toTaggedUnion("status"))
/**
 * The decoded value of `State`: `Untouched` or `Decided`, told apart by `status`.
 *
 * @category models
 * @since 0.0.0
 */
export type State = typeof State.Type
/**
 * The guards, the cases and `isAnyOf` of `State`: the file read as a namespace reads as the state does.
 *
 * @category models
 * @since 0.0.0
 */
export const { guards, cases, isAnyOf } = State
