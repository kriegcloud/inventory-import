import { dual } from "effect/Function"
// Where an import's suggestions are stored: the `importSuggestion` table, read and written through the two mappers
// of the contract, so the stored rows keep their shape. A write is one batch with its audit line.
import * as O from "effect/Option"
import * as S from "effect/Schema"
import * as SchemaGetter from "effect/SchemaGetter"
import { identity } from "effect/Function"
import { SuggestionId, RowId, ImportId } from "@inventory/catalog-contract/Ids"
import {
  SuggestionKind,
  SuggestionByKind,
  suggestionFromStored,
  suggestionToStored
} from "@inventory/catalog-contract/Suggestion"
import { Field } from "@inventory/catalog-contract/Staged"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { SuggestionStore, StoreSuggestions } from "@inventory/catalog-model/SuggestionStore"
import * as SqlClient from "effect/sql/SqlClient"
import * as SqlSchema from "effect/sql/SqlSchema"
import { D1 } from "@beep/d1/D1"
import { D1Instant } from "@beep/d1/D1Instant"
import { auditLine, lineOf } from "./internal/auditLine.ts"
import { OrganizationId, MemberId } from "@inventory/kernel/Ids"
import { LiteralKit } from "@beep/schema/LiteralKit"

// A suggestion as its table's columns hold it; `suggestionFromStored` reads it and `suggestionToStored` writes it.
const noRowId = "" as const
const Stored = S.Struct({
  id: SuggestionId,
  kind: SuggestionKind,
  rowId: S.Union([RowId, S.Literal("")]).pipe(
    S.decodeTo(RowId.pipe(S.toType, S.Option), {
      decode: SchemaGetter.transform((id) => (id === "" ? O.none() : O.some(id))),
      encode: SchemaGetter.transform(O.match({ onNone: () => noRowId, onSome: identity }))
    })
  ),
  rowNumber: S.OptionFromNullOr(S.Int),
  field: Field,
  from: S.String,
  to: S.String,
  column: S.OptionFromNullOr(S.Int),
  by: SuggestionByKind,
  model: S.OptionFromNullOr(S.String),
  confidence: LiteralKit(["medium", "low"]),
  basis: S.String
}).annotate({ description: "A suggestion as its table holds it: the row id is empty, not null, for a column" })

/** `SuggestionStore` on D1. */
export const SuggestionStoreD1 = Layer.effect(
  SuggestionStore,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    const { batch } = yield* D1
    const line = auditLine(sql)

    const findAll = SqlSchema.findAll({
      Request: S.Struct({ org: OrganizationId, id: S.String }),
      Result: Stored,
      execute: (r) => sql`SELECT id, kind, rowId, rowNumber, field, fromValue AS "from", toValue AS "to",
        columnIndex AS "column", madeBy AS "by", model, confidence, basis
      FROM importSuggestion WHERE organizationId = ${r.org} AND importId = ${r.id} ORDER BY createdAt, id`
    })

    // Written only while the import is open, and only where the row and field have no suggestion yet.
    const insert = D1.statement({
      Request: S.Struct({
        org: OrganizationId,
        importId: S.String,
        actor: MemberId,
        at: D1Instant,
        row: Stored
      }),
      Result: S.Array(S.Struct({ id: S.String })),
      execute: (r) => sql`INSERT INTO importSuggestion (id, organizationId, importId, kind, rowId, rowNumber, field,
        fromValue, toValue, columnIndex, madeBy, model, confidence, basis, askedById, createdAt)
      SELECT ${r.row.id}, ${r.org}, ${r.importId}, ${r.row.kind}, ${r.row.rowId}, ${r.row.rowNumber},
        ${r.row.field}, ${r.row.from}, ${r.row.to}, ${r.row.column}, ${r.row.by}, ${r.row.model},
        ${r.row.confidence}, ${r.row.basis}, ${r.actor}, ${r.at}
      WHERE EXISTS (SELECT 1 FROM importDraft WHERE organizationId = ${r.org} AND id = ${r.importId}
        AND status = 'open')
      ON CONFLICT (organizationId, importId, rowId, field) DO NOTHING RETURNING id`
    })

    const list = Effect.fn("Suggestions.list")(function* (organizationId: OrganizationId, importId: ImportId) {
      const rows = yield* findAll({ org: organizationId, id: importId })
      return A.getSomes(A.map(rows, suggestionFromStored))
    }, Effect.orDie)

    const store = Effect.fn("Suggestions.store")(function* (write: StoreSuggestions) {
      const audit = lineOf(write.audit)
      // One batch: the audit line and every suggestion land together or not at all.
      const answers = yield* batch([
        line(audit),
        ...A.map(write.suggestions, (suggestion) =>
          insert({
            org: audit.org,
            importId: write.draft,
            actor: audit.actor,
            at: audit.at,
            row: suggestionToStored(suggestion)
          })
        )
      ])
      // Only the rows this batch wrote: one another request stored first is not counted as made here.
      const written = A.flatMap(A.drop(answers, 1), (rowsBack) => A.map(rowsBack, (row) => row.id))
      return A.filter(write.suggestions, (suggestion) => A.contains(written, suggestion.id))
    }, Effect.orDie)

    return SuggestionStore.of({
      list: dual(2, (self: ImportId, organizationId: OrganizationId) => list(organizationId, self)),
      store
    })
  })
)
