import * as Match from "effect/Match"
import { stringify } from "@inventory/ui/Json"
// The spreadsheet reader, off the page's thread. A module worker that the build emits as its own file on our origin,
// so the content security policy's `script-src 'self'` covers it; never a blob: worker, which the policy blocks (a
// library that made one hung here). It runs the same `readSpreadsheet` the tests run, then trims the table to what
// the server stages and hands it to the page in the chunks the server stores. Every file takes this path.
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as Result from "effect/Result"
import * as S from "effect/Schema"
import { StagedHead, StagedRow } from "@inventory/catalog-contract/Staged"
import { type FileProblem, fileProblem } from "@inventory/catalog-contract/FileProblem"
import { maxChunkChars, uploadChunks } from "@inventory/catalog-model/Upload"
import { readSpreadsheet, type ReadProgress } from "./spreadsheet/read.ts"
import { ReadMessage, ReadRequest } from "./protocol.ts"
import { stageTable, stagingProblem } from "@inventory/catalog-model/Staging"

const post = (message: ReadMessage) => self.postMessage(message)

// An Option loses its prototype in the copy between threads (protocol.ts), so a chunk crosses in the form the wire
// carries, and the page decodes it with the same schema.
// Keep head-bound validation at its existing staging/server boundaries and preserve their refusal words.
const encodeHead = S.encodeOption(StagedHead, { disableChecks: true })
const encodeChunk = S.encodeOption(S.Array(StagedRow))

const crashed = (file: File) =>
  ReadMessage.Crashed({
    message: `"${file.name}" could not be read. Try again, and reload the page if it keeps happening.`
  })

/** The file cannot be staged: its problem goes to the page as plain fields. */
const refuse = (problem: FileProblem) =>
  post(
    ReadMessage.Refused({
      problem: { kind: problem.kind, fileName: problem.fileName, problem: problem.problem, todo: problem.todo }
    })
  )

/** At most one progress message every 50 ms: the page redraws on each. */
const throttle = (send: (message: ReadMessage) => void) => {
  let last = -Infinity
  return (progress: ReadProgress) => {
    const now = performance.now()
    if (now - last < 50 && !progress.exact) return
    last = now
    send(ReadMessage.Progress(progress))
  }
}

const read = ({ file, sheet }: ReadRequest) =>
  readSpreadsheet({ file, sheet, onProgress: throttle(post) }).pipe(
    Effect.result,
    Effect.map((result) => {
      if (Result.isFailure(result)) return refuse(result.failure)
      const table = result.success
      const { rows, ...stagedHead } = stageTable({ table })
      const problem = stagingProblem({
        fileName: stagedHead.fileName,
        rowCount: rows.length,
        columnCount: stagedHead.columns.length
      })
      if (O.isSome(problem)) return refuse(problem.value)
      // Keep the staging refusals above ahead of encoding, as for chunks below.
      // The complete head crosses in its schema's encoded form, just as the chunks do.
      const encodedHead = encodeHead(stagedHead)
      if (O.isNone(encodedHead)) return post(crashed(file))
      const head = encodedHead.value
      const encoded = O.all(A.map(uploadChunks({ rows }), (chunk) => encodeChunk(chunk)))
      // Rows the reader made always encode: a chunk that does not is the reader's own failure, not the file's.
      if (O.isNone(encoded)) return post(crashed(file))
      const chunks = encoded.value
      // The server refuses a chunk or a head over this size with the same words; saying it here sends nothing.
      if (stringify(head).length > maxChunkChars) {
        return refuse(fileProblem.tooLong({ fileName: head.fileName, part: "headings" }))
      }
      if (chunks.some((chunk) => stringify(chunk).length > maxChunkChars)) {
        return refuse(fileProblem.tooLong({ fileName: head.fileName, part: "cells" }))
      }
      post(
        ReadMessage.Head({
          head,
          chunkSizes: A.map(chunks, (chunk) => chunk.length),
          workbook: Match.valueTags(table.format, {
            xlsx: (format) => ({ sheets: format.sheets, chosen: format.chosen }),
            csv: () => null
          })
        })
      )
      chunks.forEach((chunk, seq) => post(ReadMessage.Chunk({ seq, rows: chunk })))
      post(ReadMessage.Done())
    })
  )

self.onmessage = (event: MessageEvent<typeof ReadRequest.Encoded>) => {
  // The reader itself broke (not the file): a sentence about the page, not a problem with the file.
  S.decodeEffect(ReadRequest)(event.data)
    .pipe(Effect.flatMap(read), Effect.runPromise)
    .catch(() => post(crashed(event.data.file)))
}
