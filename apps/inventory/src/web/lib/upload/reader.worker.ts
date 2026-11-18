// The spreadsheet reader, off the page's thread. A module worker that the build emits as its own file on our origin,
// so the content security policy's `script-src 'self'` covers it; never a blob: worker, which the policy blocks (a
// library that made one hung here). It runs the same `readSpreadsheet` the tests run, then trims the table to what
// the server stages and hands it to the page in the chunks the server stores. Every file takes this path.
import { Effect, Result } from "effect"
import { type FileProblem, fileProblem } from "../../../domain/FileProblem.ts"
import { stageTable, stagingProblem } from "../../../domain/ItemImport.ts"
import { maxChunkChars, uploadChunks } from "../../../domain/Upload.ts"
import { readSpreadsheet } from "../spreadsheet/read.ts"
import type { ReadMessage, ReadRequest } from "./protocol.ts"

const post = (message: ReadMessage) => self.postMessage(message)

/** The file cannot be staged: its problem goes to the page as plain fields. */
const refuse = (problem: FileProblem) =>
  post({
    _tag: "Refused",
    problem: {
      _tag: "FileProblem",
      kind: problem.kind,
      fileName: problem.fileName,
      problem: problem.problem,
      todo: problem.todo
    }
  })

/** At most one progress message every 50 ms: the page redraws on each. */
const throttle = (send: (message: ReadMessage) => void) => {
  let last = -Infinity
  return (progress: { rowsRead: number; rowsAbout: number | null; exact: boolean }) => {
    const now = performance.now()
    if (now - last < 50 && !progress.exact) return
    last = now
    send({ _tag: "Progress", ...progress })
  }
}

const read = async ({ file, sheet }: ReadRequest) => {
  const result = await Effect.runPromise(
    Effect.result(readSpreadsheet({ file, ...(sheet === null ? {} : { sheet }), onProgress: throttle(post) }))
  )
  if (Result.isFailure(result)) return refuse(result.failure)
  const table = result.success
  const { rows, ...head } = stageTable({ table })
  const problem = stagingProblem({ fileName: head.fileName, rowCount: rows.length, columnCount: head.columns.length })
  if (problem !== null) return refuse(problem)
  const chunks = uploadChunks({ rows })
  // The server refuses a chunk or a head over this size with the same words; saying it here sends nothing.
  if (JSON.stringify(head).length > maxChunkChars) {
    return refuse(fileProblem.tooLong({ fileName: head.fileName, part: "headings" }))
  }
  if (chunks.some((chunk) => JSON.stringify(chunk).length > maxChunkChars)) {
    return refuse(fileProblem.tooLong({ fileName: head.fileName, part: "cells" }))
  }
  post({
    _tag: "Head",
    head,
    chunkSizes: chunks.map((chunk) => chunk.length),
    workbook: table.format._tag === "xlsx" ? { sheets: table.format.sheets, chosen: table.format.chosen } : null
  })
  chunks.forEach((chunk, seq) => post({ _tag: "Chunk", seq, rows: chunk }))
  post({ _tag: "Done" })
}

self.onmessage = (event: MessageEvent<ReadRequest>) => {
  // The reader itself broke (not the file): a sentence about the page, not a problem with the file.
  read(event.data).catch(() =>
    post({
      _tag: "Crashed",
      message: `"${event.data.file.name}" could not be read. Try again, and reload the page if it keeps happening.`
    })
  )
}
