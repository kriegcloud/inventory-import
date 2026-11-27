// The test of `alchemy-domain/06-a-found-sequence-keeps-its-time.patch`. Without the patch Verify runs the sequence
// the search found (`WriteEntry` at the solver's time, the epoch) as a story that writes no clock step, because every
// command of it shares one time: the story runs it at 2026-01-01, its own start, records day 20454 where the search
// read day 0, and the report says the sequence does something else when run as a story.
import { Story } from "@alchemy.run/domain/Story"
import * as Verify from "@alchemy.run/domain/Verify"
import * as NodeServices from "@effect/platform-node/NodeServices"
import { expect, layer } from "@effect/vitest"
import * as Effect from "effect/Effect"
import { Diaries, DiaryApi } from "./Diary.model.ts"

layer(NodeServices.layer)("a sequence the search found, of a model whose decide reads now", (it) => {
  it.effect(
    "runs as a story at the time the search ran it, and does what the search read",
    Effect.fnUntraced(function* () {
      const report = yield* Verify.report(Diaries, {
        apis: [DiaryApi],
        story: Story.make(Diaries),
        source: new URL("./Diary.model.ts", import.meta.url),
        depth: 1
      })
      const said = Verify.render(report)
      expect(report.undone, said).toEqual([])
      expect(Verify.verified(report), said).toBe(true)
    }),
    120_000
  )
})
