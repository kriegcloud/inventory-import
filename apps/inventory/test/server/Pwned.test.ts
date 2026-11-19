// @effect-diagnostics globalFetch:off
import { expect, it } from "@effect/vitest"
import { betterAuth } from "better-auth"
import { memoryAdapter } from "better-auth/adapters/memory"
import { Array as Arr, Effect, String as Str } from "effect"
import * as S from "effect/Schema"
import { vi } from "vitest"
import { authOptions } from "@inventory/access-host/AuthOptions"

// The breach check (Have I Been Pwned) is a setting, PWNED_PASSWORD_CHECK. Off, sign-up never calls the service. On
// and unreachable, sign-up is refused: the check fails closed, as the README says. The real service is asked in
// test/server/Pwned.slow.test.ts. Better Auth runs here with this app's options on its in-memory adapter: the check
// sits in its password hashing, before anything is stored, so the database does not change what is tested.

/** A password that has been in breaches many times: what the check exists to refuse. */
const breached = "password1234"

/** Better Auth with this app's options, the breach check as given, on a fresh in-memory store. */
const authWith = (pwnedPasswordCheck: boolean) =>
  betterAuth(
    authOptions({
      database: memoryAdapter({
        user: [],
        session: [],
        account: [],
        verification: [],
        organization: [],
        member: [],
        invitation: [],
        rateLimit: []
      }),
      secret: Str.repeat(32)("x"),
      pwnedPasswordCheck,
      rateLimit: false
    })
  )

const toJson = S.encodeEffect(S.fromJsonString(S.Unknown))

/** A sign-up as the app's own page sends it. */
const signUp = Effect.fnUntraced(function* (auth: ReturnType<typeof authWith>, email: string) {
  const body = yield* toJson({ name: "Someone", email, password: breached }).pipe(Effect.orDie)
  return yield* Effect.promise(() =>
    auth.handler(
      new Request("http://localhost/api/auth/sign-up/email", {
        method: "POST",
        headers: { "content-type": "application/json", origin: "http://localhost", "sec-fetch-site": "same-origin" },
        body
      })
    )
  )
})

/** Every request to the breach service while `effect` runs, answered by `answer`; anything else goes out as usual. */
const watchingPwned = <A, E, R>(answer: () => Promise<Response>, effect: Effect.Effect<A, E, R>) =>
  Effect.acquireUseRelease(
    Effect.sync(() => {
      const calls: Array<string> = []
      const real = globalThis.fetch
      const spy = vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
        const url = String(input instanceof Request ? input.url : input)
        if (Str.startsWith("https://api.pwnedpasswords.com/")(url)) {
          calls.push(url)
          return answer()
        }
        return real(input, init)
      })
      return { calls, spy }
    }),
    ({ calls }) => Effect.map(effect, (result) => ({ result, calls })),
    ({ spy }) => Effect.sync(() => spy.mockRestore())
  )

it.effect("off: a breached password is let through and the service is never called", () =>
  Effect.gen(function* () {
    const { result, calls } = yield* watchingPwned(
      () => Promise.reject(new Error("the breach service must not be called")),
      signUp(authWith(false), "off@example.test")
    )
    expect(result.status).toBe(200)
    expect(calls).toEqual([])
  })
)

it.effect("on and unreachable: sign-up is refused, and only a hash prefix was sent", () =>
  Effect.gen(function* () {
    const { result, calls } = yield* watchingPwned(
      () => Promise.reject(new TypeError("fetch failed")),
      signUp(authWith(true), "offline@example.test")
    )
    expect(result.status).toBe(500)
    const answer = yield* Effect.promise(() => result.json())
    expect(answer).toMatchObject({
      message: "Failed to check password. Please try again later."
    })
    // Only the first five characters of the SHA-1 hash go out: never the password.
    expect(Arr.map(calls, Str.replace(/[0-9A-F]{5}$/, "XXXXX"))).toEqual(["https://api.pwnedpasswords.com/range/XXXXX"])
  })
)
