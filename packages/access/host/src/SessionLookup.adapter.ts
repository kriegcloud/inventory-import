/**
 * THE ONE SESSION LOOKUP. The kernel's `SessionLookup` on Better Auth and the member directory: the session cookie
 * names a user and their active organization, their membership there is the member, and the header a page names its
 * member in (`pageMemberHeader`) can only refuse, when the session's member is somebody else by then. The `/api/v1`
 * `Identity` middleware (`SessionIdentityLive`) rests on it now, and every model's `Session` middleware is to, so who
 * acts is decided by one rule (Benjamin, 2026-11-26, "A port in the kernel"); no model's `Session` Layer reads it yet.
 * The one thing not to break: nothing in a header or a payload names who acts.
 *
 * @packageDocumentation
 */
import { BetterAuth } from "@beep/better-auth/BetterAuth"
import { pageMemberHeader } from "@inventory/access-contract/Access"
import { accessHandlers } from "@inventory/access-model/Handlers"
import { MemberDirectory } from "@inventory/access-model/MemberDirectory"
import { NotSignedIn } from "@inventory/kernel/AccessError"
import type { Member } from "@inventory/kernel/Member"
import { SessionLookup, SessionVerdict } from "@inventory/kernel/SessionLookup"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as O from "effect/Option"
import * as Headers from "effect/http/Headers"
import { signedIn, webHeadersOf } from "./internal/signedIn.ts"

/** What a page names its member as in `pageMemberHeader`: the member's id and their organization's. */
const pageKeyOf = (member: Member): string => `${member.id}/${member.organizationId}`

/**
 * `SessionLookup` over Better Auth's session and the member directory. A verdict is trusted for a minute: Better
 * Auth's answer is not yet read for the session's own end (the driver decodes no `expiresAt`), so a session that
 * ends sooner is noticed at the next judgement, within that minute.
 *
 * @category layers
 */
export const SessionLookupLive: Layer.Layer<SessionLookup, never, BetterAuth | MemberDirectory> = Layer.effect(
  SessionLookup,
  Effect.gen(function* () {
    const auth = yield* BetterAuth
    const directory = yield* MemberDirectory
    return SessionLookup.of({
      verdictOf: Effect.fn("SessionLookup.verdictOf")(function* (headers: Headers.Headers) {
        // A Better Auth failure is no fault of the request: it ends as a 500, as before the driver typed it.
        const session = yield* auth.session(webHeadersOf(headers)).pipe(Effect.orDie)
        const member = yield* accessHandlers
          .actorOf(O.map(session, signedIn))
          .pipe(Effect.provideService(MemberDirectory, directory))
        // The page that sent it is another member's (somebody signed in, out or switched in another tab of the same
        // browser): refused before anything runs, so nothing is done as, or read for, whoever the cookie is now.
        if (O.exists(Headers.get(headers, pageMemberHeader), (page) => page !== pageKeyOf(member))) {
          return yield* NotSignedIn.make({
            reason: "This page was opened for somebody else than is signed in now. Load the page again."
          })
        }
        const now = yield* DateTime.now
        const verdict = SessionVerdict.judged({ member, at: now, sessionEnds: O.none() })
        yield* Effect.annotateCurrentSpan(SessionVerdict.annotations(verdict))
        return verdict
      }),
      memberNow: Effect.fn("SessionLookup.memberNow")(function* (member: Pick<Member, "id" | "organizationId">) {
        return yield* directory.stillIn(member)
      })
    })
  })
)
