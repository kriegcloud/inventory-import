// What one act on a group of rows holds. Read as a namespace named `GroupState`: `GroupState.State`,
// `GroupState.Decided`, `GroupState.guards.Decided`.
import * as Effect from "effect/Effect"
import * as S from "effect/Schema"
import { Change } from "../Review/Change.schema.ts"

/**
 * **Details**
 *
 * The count is a whole number, and it is its sender's word: the model reads no row out of a group's rows, so nothing
 * ties it to them. It is held by the schema of the event and of the state, so Verify proves it kept as part of "the
 * state stays in its schema".
 *
 * **Example** (A group covers at least one row)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import * as GroupState from "./Group.state.ts"
 *
 * O.isSome(GroupState.Size.makeOption(1)) // => true
 * O.isNone(GroupState.Size.makeOption(0)) // => true
 * O.isNone(GroupState.Size.makeOption(1.5)) // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const Size = S.Int.check(S.isGreaterThanOrEqualTo(1)).annotate({
  description: "How many rows an act on a group covers: at least one"
})

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
 * import * as GroupState from "./Group.state.ts"
 *
 * const decided = GroupState.Decided.make({
 *   importId: "imp-1",
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
    importId: S.String.pipe(S.annotateKey({ description: "The import the act belongs to" })),
    organizationId: S.String.pipe(S.annotateKey({ description: "The organization of that import" })),
    change: Change.pipe(S.annotateKey({ description: "The change of its import that recorded it" })),
    by: S.String.pipe(S.annotateKey({ description: "The member who made it" })),
    step: S.String.pipe(S.annotateKey({ description: "The step it was made in, which names the group" })),
    patch: S.String.pipe(S.annotateKey({ description: "What it does to each of its rows, as one text" })),
    rows: S.String.pipe(S.annotateKey({ description: "The rows it names, as one text" })),
    count: Size.pipe(S.annotateKey({ description: "How many rows it says it covers" })),
    madeOn: S.Int.pipe(S.annotateKey({ description: "The import's matching it was made on" })),
    label: S.String.pipe(S.annotateKey({ description: "What the act was called on screen" })),
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
