// Better Auth on the model's Worker (host-03): the second construction from the site's one options module, on
// Alchemy's package. What it holds: a person who signed in on the site's construction is read on the model's from the
// cookie alone, on the same tables, with the site's secret, the session's end included; a cookie signed with another
// secret reads nobody; no secret is a fault of the Worker, not of the request; a read here renews no session, so the
// site's next read still renews the browser's cookie; and the construction answers no sign-in request of its own. What it does not hold: the D1 database (the store is in memory, as both constructions'
// tests have it), a Secure cookie (a deployed stage's), and the cookie the site's Worker forwards on a deploy.
import { Memory } from "@alchemy.run/better-auth/Memory"
import { BetterAuth } from "@beep/better-auth/BetterAuth"
import { describe, expect, it, vi } from "@effect/vitest"
import { assertSome } from "@effect/vitest/utils"
import * as Context from "effect/Context"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import * as Layer from "effect/Layer"
import * as O from "effect/Option"
import { ModelSignIn } from "../src/SignIn.ts"
import type { MemoryDB } from "better-auth/adapters/memory"
import { authStore, signedInMember, siteAuth, siteSecret, withWorkerSettings } from "./support/signIn.ts"

/** The model's construction on `store`, the settings it reads its secret from given at each call. */
const modelAuth = (store: MemoryDB) => ModelSignIn({ secureCookies: false }).pipe(Layer.provide(Memory(store)))

/** The session the model's construction reads from `cookie`, with `secret` as the Worker's setting, if any. */
const readOn = Effect.fnUntraced(function* (store: MemoryDB, cookie: string, secret: O.Option<string>) {
  const auth = yield* modelAuth(store).pipe(Layer.build, Effect.map(Context.get(BetterAuth)))
  return yield* auth.session(new Headers({ cookie })).pipe(withWorkerSettings(secret))
}, Effect.scoped)

const ana = { email: "ana@example.test", memberId: "mem_ana", organizationId: "org_prairie", role: "editor" } as const

/** Better Auth's clock (`Date`) moved two days on for the rest of the test's scope, then put back. */
const twoDaysOn = Effect.acquireRelease(
  Effect.sync(() => vi.useFakeTimers({ toFake: ["Date"], now: vi.getRealSystemTime() + 2 * 24 * 60 * 60 * 1000 })),
  () => Effect.sync(() => vi.useRealTimers())
)

describe("Better Auth on the model's Worker", () => {
  it.effect(
    "reads the session the site signed, from its cookie alone: the account, its organization and the session's end",
    Effect.fnUntraced(function* () {
      const store = authStore()
      const signedIn = yield* signedInMember(store, ana)
      const session = yield* readOn(store, signedIn.cookie, O.some(siteSecret))
      assertSome(
        O.map(session, (read) => read.userId),
        signedIn.userId
      )
      assertSome(
        O.map(session, (read) => read.email),
        ana.email
      )
      assertSome(O.flatMap(session, (read) => read.activeOrganizationId).pipe(O.map(String)), ana.organizationId)
      // The end of the session the site opened, as the site's construction reads it: the model's reads the same row.
      expect(O.isSome(signedIn.sessionEnds)).toBe(true)
      expect(O.map(session, (read) => read.expiresAt)).toEqual(signedIn.sessionEnds)
    })
  )

  it.effect(
    "reads nobody from a cookie the Worker's secret did not sign",
    Effect.fnUntraced(function* () {
      const store = authStore()
      const signedIn = yield* signedInMember(store, ana)
      const session = yield* readOn(store, signedIn.cookie, O.some("another-secret-of-thirty-two-characters-or-more"))
      expect(session).toEqual(O.none())
    })
  )

  it.effect(
    "reads nobody from a request with no cookie",
    Effect.fnUntraced(function* () {
      const store = authStore()
      const session = yield* readOn(store, "", O.some(siteSecret))
      expect(session).toEqual(O.none())
    })
  )

  it.effect(
    "ends a call as a fault of the Worker when the stack gave it no secret, or a short one",
    Effect.fnUntraced(function* () {
      const store = authStore()
      const signedIn = yield* signedInMember(store, ana)
      const none = yield* readOn(store, signedIn.cookie, O.none()).pipe(Effect.exit)
      expect(none.pipe(Exit.hasDies)).toBe(true)
      const short = yield* readOn(store, signedIn.cookie, O.some("short")).pipe(Effect.exit)
      expect(short.pipe(Exit.hasDies)).toBe(true)
    })
  )

  it.effect(
    "leaves a day-old session for the site to renew: the model's read moves no end, so the site still sends the cookie",
    Effect.fnUntraced(function* () {
      const store = authStore()
      const signedIn = yield* signedInMember(store, ana)
      // Two days on, past Better Auth's day (`updateAge`) after which a read renews the session.
      yield* twoDaysOn
      const session = yield* readOn(store, signedIn.cookie, O.some(siteSecret))
      // The model's read sees the end the site set at sign-in, and leaves it there.
      expect(O.map(session, (read) => read.expiresAt)).toEqual(signedIn.sessionEnds)
      const onSite = yield* Effect.promise(() =>
        siteAuth(store).api.getSession({ headers: new Headers({ cookie: signedIn.cookie }), returnHeaders: true })
      )
      // The site's own read renews it, and hands the browser the renewed cookie.
      expect(onSite.headers.get("set-cookie")).toContain("inventory.session_token=")
      const renewed = O.map(O.fromNullOr(onSite.response), ({ session }) => DateTime.fromDateUnsafe(session.expiresAt))
      expect(renewed).not.toEqual(signedIn.sessionEnds)
    }, Effect.scoped)
  )

  it.effect(
    "answers every request of its own 404: sign-in is the site's",
    Effect.fnUntraced(function* () {
      const auth = yield* modelAuth(authStore()).pipe(Layer.build, Effect.map(Context.get(BetterAuth)))
      const response = yield* auth.handle(new Request("http://model/api/auth/sign-in/email", { method: "POST" }))
      expect(response.status).toBe(404)
    }, Effect.scoped)
  )
})
