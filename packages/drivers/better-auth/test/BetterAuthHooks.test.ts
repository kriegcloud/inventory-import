// A hook written as an Effect answers Better Auth with its value, and its refusal is the `APIError` Better Auth turns
// into a 403 with the same sentence: any other rejection would reach the person as a 500.
import { describe, expect, it } from "@effect/vitest"
import { HookRefused, hook } from "@beep/better-auth/Hooks"
import { APIError } from "better-auth/api"
import * as Effect from "effect/Effect"

describe("a Better Auth hook as an Effect", () => {
  it.effect("answers with the Effect's value", () =>
    Effect.gen(function* () {
      const answer = yield* Effect.promise(() => hook(Effect.succeed({ data: { name: "Dana" } })))
      expect(answer).toEqual({ data: { name: "Dana" } })
    })
  )

  it.effect("rejects a refusal as Better Auth's FORBIDDEN with the sentence", () =>
    Effect.gen(function* () {
      const refusal = HookRefused.make({ message: "New accounts are closed." })
      const rejected = yield* Effect.promise(() => hook(refusal.pipe(Effect.fail))).pipe(
        Effect.as(undefined),
        Effect.catchDefect((defect) => Effect.succeed(defect))
      )
      expect(rejected).toBeInstanceOf(APIError)
      expect(rejected).toMatchObject({ status: "FORBIDDEN", statusCode: 403, message: "New accounts are closed." })
    })
  )
})
