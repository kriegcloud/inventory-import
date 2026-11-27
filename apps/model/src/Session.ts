/**
 * The server half of the usage model's `Session` middleware: who a call acts as, from the one session lookup (the
 * kernel's `SessionLookup`, implemented once in the access context's host: Benjamin, 2026-11-26, "A port in the
 * kernel"), whose Better Auth on this Worker is Alchemy's package (`SignIn.ts`, `sessionsOver`; "Model's Worker only", the same
 * day). Nothing here names how the lookup reads a session, so the site's Worker, which runs the models in memory under
 * `bun run dev`, puts this same session in front of them over its own lookup (`apps/inventory/src/server/Models.ts`).
 * A call is judged on its own headers: the session cookie names the member, and the page's member header, which the
 * site's Worker forwards with it, can only refuse. The verdict's end is set as the call's expiry, so a pushed read is
 * judged again within a minute at most, and never past the session's end ("One minute at most", the same day); a
 * command and a one-off read are judged on every call, so the expiry does nothing for them.
 *
 * The one thing not to break: nothing here names who acts from a header or a payload. The member comes from the
 * session, and every span and log line inside the call carries the member's ids and role, never a name or an email.
 *
 * @packageDocumentation
 */
import * as Domain from "@alchemy.run/domain"
import { SessionLookup, SessionVerdict } from "@inventory/kernel/SessionLookup"
import { CurrentActor } from "@inventory/usage-model/Actor"
import { Session } from "@inventory/usage-model/Session"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import type * as Headers from "effect/http/Headers"
import * as Layer from "effect/Layer"

/**
 * The verdict on a call's headers, its end set as the call's expiry: a pushed read is closed at `until` and judged
 * again, so a session that ends, or a member removed from the organization, is noticed within a minute. A command and
 * a one-off read have no expiry, and setting it does nothing for them.
 *
 * @category behaviour
 */
export const verdictOn = Effect.fn("Usage.Session.verdictOn")(function* (headers: Headers.Headers) {
  const sessions = yield* SessionLookup
  const verdict = yield* sessions.verdictOf(headers)
  yield* Domain.setExpiry(verdict.until.pipe(DateTime.toEpochMillis))
  return verdict
})

/**
 * `effect` run as the member the session on `headers` acts as: the verdict, its end as the call's expiry, then the
 * member's ids and role as the usage model's `CurrentActor`, and those ids and the role, never a name or an email, on
 * the call's span and on every span and log line inside it. A call with no session, or from a page opened for
 * somebody else, is refused `NotSignedIn` with the lookup's sentence before `effect` runs.
 *
 * @category behaviour
 */
export const asSessionMember = Effect.fn("Usage.Session")(function* <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  headers: Headers.Headers
) {
  const verdict = yield* verdictOn(headers)
  const who = SessionVerdict.annotations(verdict)
  yield* Effect.annotateCurrentSpan(who)
  return yield* effect.pipe(
    Effect.provideService(CurrentActor, {
      organizationId: verdict.member.organizationId,
      memberId: verdict.member.id,
      role: verdict.member.role
    }),
    Effect.annotateSpans(who),
    Effect.annotateLogs(who)
  )
})

/**
 * `Session` over `SessionLookup`: each call run `asSessionMember` of its own headers, so nothing is taken or read for
 * a call the lookup refuses.
 *
 * @category layers
 */
export const UsageSession = Layer.effect(
  Session,
  Effect.gen(function* () {
    const sessions = yield* SessionLookup
    return Session.of((effect, { headers }) =>
      asSessionMember(effect, headers).pipe(Effect.provideService(SessionLookup, sessions))
    )
  })
)
