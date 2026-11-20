// The review's saver, one per import for the page's life: a screen that opens again while a save is still out must
// not make it forget what it is sending. The rule that hurts when wrong: the next request would be worked out from
// decisions the server does not hold yet, and would clear the person's own decision.
import { describe, expect, it } from "@effect/vitest"
import * as Deferred from "effect/Deferred"
import * as Effect from "effect/Effect"
import { type DecisionDelta, decisionFromFlags, type SavedDecisions } from "@inventory/catalog-contract/Decision"
import { makeSaver } from "../src/Draft.controller.ts"

const leftOut = decisionFromFlags({ out: true })
const quiet = { onSaved: () => {}, onRefused: () => {} }

/** A server that answers each save only when the test says so, and keeps what it was sent. */
const server = () => {
  const sent: Array<DecisionDelta> = []
  const answers: Array<Deferred.Deferred<{ readonly revision: number }>> = []
  const send = (delta: DecisionDelta) => {
    const answer = Deferred.makeUnsafe<{ readonly revision: number }>()
    sent.push(delta)
    answers.push(answer)
    return answer.pipe(Deferred.await, Effect.runPromise)
  }
  const answer = (n: number, revision: number) => Deferred.succeed(answers[n]!, { revision })
  return { send, sent, answer }
}

/** Long enough for the promises a save chains to run. */
const settle = Effect.sleep("10 millis")

describe("the review's saver", () => {
  it.live("is not reset under a save still out: its next request clears nothing the person decided", () =>
    Effect.gen(function* () {
      const s = server()
      const saver = makeSaver(s.send)
      const before: SavedDecisions = {}
      const decided: SavedDecisions = { "row-12": leftOut }
      expect(saver.reset(before)).toBe(true)
      saver.change(decided, quiet)
      yield* settle
      expect(s.sent).toHaveLength(1)
      // The screen opens again while the save is out and sees a view that does not hold row 12 yet.
      expect(saver.reset(before)).toBe(false)
      expect(saver.wanted()).toEqual(decided)
      yield* s.answer(0, 2)
      yield* settle
      // Nothing more to send: no request that takes row 12 back.
      expect(s.sent).toHaveLength(1)
      expect(saver.pending()).toEqual({ set: {}, clear: [] })
      // With nothing out and nothing unsent, a newer draft from the server is taken.
      expect(saver.reset({})).toBe(true)
    })
  )
})
