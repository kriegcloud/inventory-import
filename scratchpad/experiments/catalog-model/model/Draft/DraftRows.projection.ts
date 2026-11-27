// The decision each row of an import holds now, written to the draft store, and every act on a row appended to the
// import's acts. A trial block of the module-taxonomy exploration (decision 9c), never copied into a package.
import * as Domain from "@alchemy.run/domain"
import * as Effect from "effect/Effect"
import * as Match from "effect/Match"
import { ImportKey, UNDO_LABEL } from "../Review/Change.schema.ts"
import * as RowState from "../Row/Row.state.ts"
import * as RowDecided from "../Row/RowDecided.event.ts"
import * as StepUndone from "../Row/StepUndone.event.ts"
import { DraftRow, DraftStore } from "./DraftStore.port.ts"
import { ImportActs, RowActed } from "./ImportActs.stream.ts"
import { RowHolds } from "./RowHolds.view.ts"

const reached = (state: RowState.State | null): state is RowState.Decided | RowState.Undecided =>
  RowState.guards.Decided(state) || RowState.guards.Undecided(state)

const importOf = ({ state }: { readonly state: RowState.State | null }): ImportKey | undefined =>
  reached(state) ? state.importId : undefined

const actOf = (event: RowDecided.Event | StepUndone.Event) =>
  Match.valueTags(event, {
    RowDecided: ({ change, label, by }) => ({ change, label, by }),
    StepUndone: ({ undo, by }) => ({ change: undo, label: UNDO_LABEL, by })
  })

/**
 * **Details**
 *
 * It reads `RowHolds`, so each input carries what the row holds after it, and is keyed by the import that row belongs
 * to, because the stream it writes is keyed by the import and a stream's one writer is keyed like it. A row that holds
 * nothing (an undo on a row no act reached) is routed nowhere: `keyOf` returns `undefined`, the library's word for no
 * key.
 *
 * @category projections
 * @since 0.0.0
 */
export class DraftRows extends Domain.Projection(
  "DraftRows",
  {
    from: [RowHolds],
    key: ImportKey,
    keyOf: { RowDecided: importOf, StepUndone: importOf },
    on: [RowDecided.Event, StepUndone.Event],
    writes: [ImportActs]
  },
  { description: "The decision each row of an import holds now, and every act on its rows" }
) {}

/**
 * Takes each input in order: records the decision the row holds after it under the row's instance, so a later
 * decision replaces the earlier one and a replay writes the same row, or removes the row when it holds no decision
 * after an undo; then appends the act to the import's acts.
 *
 * **Details**
 *
 * An undo that puts back an earlier decision records that decision again, as the row holds it, with its own change,
 * label and author. The act appended for an undo names the change it took back, `undo` and who undid it.
 *
 * @category layers
 * @since 0.0.0
 */
export const DraftRowsLive = DraftRows.toLayer(
  Effect.gen(function* () {
    const store = yield* DraftStore
    const acts = yield* ImportActs
    return Effect.fn("DraftRows.write")(function* (batch) {
      yield* Effect.forEach(
        batch,
        Effect.fnUntraced(function* (input) {
          const { source, state, event } = input
          if (!reached(state)) return
          yield* RowState.guards.Decided(state)
            ? store.record([
                DraftRow.make({
                  id: source.id,
                  organizationId: state.organizationId,
                  importId: state.importId,
                  change: state.change,
                  label: state.label,
                  by: state.by
                })
              ])
            : store.remove([source.id])
          yield* acts.append(
            input,
            RowActed.make({ row: source.id, organizationId: state.organizationId, ...actOf(event) })
          )
        }),
        { concurrency: 1, discard: true }
      )
    })
  })
)
