// One decision as a row keeps it under the current one, and how a row seals the ones below that into one text. The
// one thing not to break: `seal` writes the sizes of a level's texts before the texts, so two different levels never
// seal to the same text.
import * as S from "effect/Schema"
import { Change } from "../Review/Change.schema.ts"

/**
 * **Details**
 *
 * A level holds the change that recorded it (0 when there is none, -1 for a level that was let go), who made it, in
 * which step, its flags, the import's matching it was made on and its label. The sizes are how long each text is: the
 * seal needs each as a number the prover can hold.
 *
 * **Gotchas**
 *
 * `make` checks that every number is a whole number, not that a size is its text's length. `sizesAreTrue` asks that.
 *
 * **Example** (Every number is a whole number)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import * as Level from "./Level.schema.ts"
 *
 * const fields = {
 *   change: 3,
 *   by: "ana",
 *   step: "s-1",
 *   flags: "{}",
 *   madeOn: 1,
 *   label: "Keep",
 *   bySize: 3,
 *   stepSize: 3,
 *   flagsSize: 2,
 *   labelSize: 4
 * }
 *
 * O.isSome(Level.Level.makeOption(fields)) // => true
 * O.isNone(Level.Level.makeOption({ ...fields, madeOn: 1.5 })) // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Level extends S.Opaque<Level, { readonly brand: unique symbol }>()(
  S.Struct({
    change: Change.pipe(S.annotateKey({ description: "The change that recorded it; 0 for none, -1 for one let go" })),
    by: S.String.pipe(S.annotateKey({ description: "The member who made it" })),
    step: S.String.pipe(S.annotateKey({ description: "The step it was made in" })),
    flags: S.String.pipe(S.annotateKey({ description: "The decision's flags, as text" })),
    madeOn: S.Int.pipe(S.annotateKey({ description: "The import's matching it was made on" })),
    label: S.String.pipe(S.annotateKey({ description: "What the act was called on screen" })),
    bySize: S.Int.pipe(S.annotateKey({ description: "How long `by` is" })),
    stepSize: S.Int.pipe(S.annotateKey({ description: "How long `step` is" })),
    flagsSize: S.Int.pipe(S.annotateKey({ description: "How long `flags` is" })),
    labelSize: S.Int.pipe(S.annotateKey({ description: "How long `label` is" }))
  }).annotate({ description: "One decision as a row keeps it under the current one" })
) {}

/**
 * No decision: what lies under a row's first one.
 *
 * @category models
 * @since 0.0.0
 */
export const noLevel: Level = Level.make({
  change: 0,
  by: "",
  step: "",
  flags: "",
  madeOn: -1,
  label: "",
  bySize: 0,
  stepSize: 0,
  flagsSize: 0,
  labelSize: 0
})

/**
 * A level that was let go: an undo stops here and says so.
 *
 * @category models
 * @since 0.0.0
 */
export const letGo: Level = Level.make({
  change: -1,
  by: "",
  step: "",
  flags: "",
  madeOn: -1,
  label: "",
  bySize: 0,
  stepSize: 0,
  flagsSize: 0,
  labelSize: 0
})

/**
 * The sizes a level names are its texts' own. An undo takes the level it brings only when this holds: two levels
 * seal to different texts only when their sizes are true.
 *
 * **Example** (A size that is not its text's length)
 *
 * ```ts
 * import * as Level from "./Level.schema.ts"
 *
 * const fields = {
 *   change: 3,
 *   by: "ana",
 *   step: "s-1",
 *   flags: "{}",
 *   madeOn: 1,
 *   label: "Keep",
 *   bySize: 3,
 *   stepSize: 3,
 *   flagsSize: 2,
 *   labelSize: 4
 * }
 *
 * Level.sizesAreTrue(Level.Level.make(fields)) // => true
 * Level.sizesAreTrue(Level.Level.make({ ...fields, bySize: 2 })) // => false
 * Level.sizesAreTrue(Level.noLevel) // => true
 * ```
 *
 * @category behavior
 * @since 0.0.0
 */
export const sizesAreTrue = (level: Level): boolean =>
  level.bySize === level.by.length &&
  level.stepSize === level.step.length &&
  level.flagsSize === level.flags.length &&
  level.labelSize === level.label.length

/**
 * A decision and everything below it as one text. Its numbers and the sizes of its texts come first, so two different
 * levels whose sizes are true never seal to the same text (`unseal`, in the row's test, reads one back).
 *
 * **Details**
 *
 * The numbers come in this order: the change, the matching, then the sizes of `by`, `step`, `label` and `flags`. The
 * texts follow in that same order, and then `below`, the text the levels under this one sealed to.
 *
 * **Example** (Seal a level over the rest)
 *
 * ```ts
 * import * as Level from "./Level.schema.ts"
 *
 * const kept = Level.Level.make({
 *   change: 3,
 *   by: "ana",
 *   step: "s-1",
 *   flags: "{}",
 *   madeOn: 1,
 *   label: "Keep",
 *   bySize: 3,
 *   stepSize: 3,
 *   flagsSize: 2,
 *   labelSize: 4
 * })
 *
 * Level.seal({ level: Level.noLevel, below: "" }) // => "0:-1:0:0:0:0:"
 * Level.seal({ level: kept, below: "" }) // => "3:1:3:3:4:2:anas-1Keep{}"
 * ```
 *
 * @category behavior
 * @since 0.0.0
 */
export const seal = (sealed: { readonly level: Level; readonly below: string }): string =>
  `${sealed.level.change}:${sealed.level.madeOn}:${sealed.level.bySize}:${sealed.level.stepSize}:${sealed.level.labelSize}:${sealed.level.flagsSize}:${sealed.level.by}${sealed.level.step}${sealed.level.label}${sealed.level.flags}${sealed.below}`

/**
 * What a row may keep below its decisions, in characters. Past it the oldest are let go and an undo stops there, so
 * nobody is ever refused a decision because of the history, and the state stays far from the largest value an object
 * stores.
 *
 * @category models
 * @since 0.0.0
 */
export const MOST_BELOW = 1_000_000
/**
 * What stands for a history that was let go. It can never be a seal: a seal starts with a number.
 *
 * @category models
 * @since 0.0.0
 */
export const CUT = "cut"
