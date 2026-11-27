// The draft store kept in memory, for stories: a map of rows by id behind a Ref. A trial block of the module-taxonomy
// exploration (decision 9c), never copied into a package.
import type * as Domain from "@alchemy.run/domain"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as HashMap from "effect/HashMap"
import * as Layer from "effect/Layer"
import * as O from "effect/Option"
import * as Order from "effect/Order"
import * as Ref from "effect/Ref"
import type { ImportKey } from "../Review/Change.schema.ts"
import { DraftRow, DraftStore } from "./DraftStore.port.ts"

const byId = Order.mapInput(Order.String, (row: DraftRow) => row.id)

/**
 * The draft store in memory: a row recorded again under the same id replaces the first, and a page holds one
 * organization's import's rows after the cursor, in order of id, with the last id as the cursor when more follow.
 *
 * @category layers
 * @since 0.0.0
 */
export const DraftStoreMemory = Layer.effect(
  DraftStore,
  Effect.map(Ref.make(HashMap.empty<string, DraftRow>()), (held) =>
    DraftStore.of({
      record: Effect.fn("DraftStore.record")(function* (rows: ReadonlyArray<DraftRow>) {
        yield* Ref.update(held, (all) => A.reduce(rows, all, (acc, row) => HashMap.set(acc, row.id, row)))
      }),
      remove: Effect.fn("DraftStore.remove")(function* (ids: ReadonlyArray<string>) {
        yield* Ref.update(held, HashMap.removeMany(ids))
      }),
      forImport: Effect.fn("DraftStore.forImport")(function* (
        organizationId: string,
        importId: ImportKey,
        page: Domain.Query.PageRequest
      ) {
        const all = yield* Ref.get(held)
        const after = O.fromUndefinedOr(page.after)
        const following = all.pipe(
          HashMap.values,
          A.fromIterable,
          A.filter(
            (row) =>
              row.organizationId === organizationId &&
              row.importId === importId &&
              !O.exists(after, (cursor) => row.id <= cursor)
          ),
          A.sort(byId)
        )
        const entries = A.take(following, page.take)
        const cursor = O.match(A.last(entries), {
          onNone: () => null,
          onSome: (row) => (following.length > entries.length ? row.id : null)
        })
        return { entries, cursor }
      })
    })
  )
)
