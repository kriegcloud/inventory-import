// Stages a table the way the browser does, through the real upload endpoints: begin with the head, send every
// chunk, finish. Tests that need an import to work on start here, so they exercise the one staging path there is.
// Each step answers a StagingOutcome; these helpers turn a FileProblem into the test's failure, as the browser does.
import { Effect, MutableRef } from "effect"
import type { HttpApiClient } from "effect/http-api"
import type { Api } from "../../../src/api/v1/Api.ts"
import type { StagedTable } from "../../../src/domain/ItemImport.ts"
import { uploadChunks } from "../../../src/domain/Upload.ts"
import { type ImportId, UploadKey } from "../../../src/domain/Ids.ts"

type Client = HttpApiClient.ForApi<typeof Api>

// Each upload a test starts gets its own key, as each file the browser starts to send does.
const started = MutableRef.make(0)
const nextKey = Effect.sync(() => UploadKey.make(`test-upload-${MutableRef.incrementAndGet(started)}`))

/**
 * Begins an upload of `table` and sends no rows. Returns the upload id, the chunks to send and the key it began with;
 * pass `key` to begin again with the same one, as a browser retrying a begin whose answer was lost does.
 */
export const beginUpload = Effect.fn("beginUpload")(function* (input: {
  readonly client: Client
  readonly table: StagedTable
  readonly key?: UploadKey
}) {
  const { client, table } = input
  const { rows, ...head } = table
  const chunks = uploadChunks({ rows })
  const key = input.key ?? (yield* nextKey)
  const begun = yield* client.imports.beginUpload({
    payload: { key, head, rowCount: rows.length, chunkCount: chunks.length }
  })
  const { id } = yield* Effect.fromResult(begun)
  return { id, chunks, key }
})

/** Sends chunk `seq` of an upload. Answers the step's StagingOutcome as it is. */
export const putChunk = (input: {
  readonly client: Client
  readonly id: ImportId
  readonly chunks: ReadonlyArray<StagedTable["rows"]>
  readonly seq: number
}) =>
  input.client.imports.putChunk({
    params: { id: input.id },
    payload: { seq: input.seq, rows: input.chunks[input.seq] ?? [] }
  })

/** The whole upload of `table`, as the upload screen sends it. Returns the import it became. */
export const upload = Effect.fn("upload")(function* (input: { readonly client: Client; readonly table: StagedTable }) {
  const { client } = input
  const { id, chunks } = yield* beginUpload(input)
  yield* Effect.forEach(chunks, (_, seq) => Effect.flatMap(putChunk({ client, id, chunks, seq }), Effect.fromResult), {
    concurrency: 1,
    discard: true
  })
  const finished = yield* client.imports.finishUpload({ params: { id } })
  return yield* Effect.fromResult(finished)
})

/** Finishes an upload: the import it became, or its FileProblem as the failure. */
export const finishUpload = (input: { readonly client: Client; readonly id: ImportId }) =>
  Effect.flatMap(input.client.imports.finishUpload({ params: { id: input.id } }), Effect.fromResult)

/** Sends chunk `seq` of an upload: what was stored, or its FileProblem as the failure. */
export const sendChunk = (input: Parameters<typeof putChunk>[0]) => Effect.flatMap(putChunk(input), Effect.fromResult)
