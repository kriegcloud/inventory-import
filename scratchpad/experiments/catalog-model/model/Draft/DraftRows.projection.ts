// Every decided row of an import, written to the draft store and appended to the import's acts. A trial block of the
// module-taxonomy exploration (decision 9c), never copied into a package.
import * as Domain from "@alchemy.run/domain"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import { ImportKey } from "../Review/Change.schema.ts"
import { Row } from "../Row/Row.aggregate.ts"
import * as RowDecided from "../Row/RowDecided.event.ts"
import { DraftRow, DraftStore } from "./DraftStore.port.ts"
import { ImportActs, RowActed } from "./ImportActs.stream.ts"

/**
 * **Details**
 *
 * It reads rows and is keyed by the import each row names, because the stream it writes is keyed by the import and a
 * stream's one writer is keyed like it.
 *
 * @category projections
 * @since 0.0.0
 */
export class DraftRows extends Domain.Projection(
  "DraftRows",
  {
    from: [Row],
    key: ImportKey,
    keyOf: { RowDecided: ({ event }) => O.getOrUndefined(ImportKey.makeOption(event.importId)) },
    on: [RowDecided.Event],
    writes: [ImportActs]
  },
  { description: "Every decided row of an import, as the review reads it back" }
) {}

/**
 * Records each decided row through `DraftStore` under the id of the event it came from, so a replay upserts the same
 * row, and appends it to the import's acts.
 *
 * @category layers
 * @since 0.0.0
 */
export const DraftRowsLive = DraftRows.toLayer(
  Effect.gen(function* () {
    const store = yield* DraftStore
    const acts = yield* ImportActs
    return Effect.fn("DraftRows.write")(function* (batch) {
      yield* store.record(
        A.map(batch, ({ key, source, event, envelope }) =>
          DraftRow.make({
            id: `${envelope.stream}:${envelope.seq}`,
            importId: key,
            row: source.id,
            organizationId: event.organizationId,
            change: event.change,
            label: event.label,
            by: event.by
          })
        )
      )
      yield* Effect.forEach(
        batch,
        (input) =>
          acts.append(
            input,
            RowActed.make({
              row: input.source.id,
              change: input.event.change,
              label: input.event.label,
              by: input.event.by
            })
          ),
        { concurrency: 1, discard: true }
      )
    })
  })
)
