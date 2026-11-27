/**
 * The one session lookup and the one member check every model's `Session` middleware is to rest on (Benjamin,
 * 2026-11-26: "A port in the kernel", implemented once in the access context's host). A model's middleware is to ask
 * who a request's session acts as and get a verdict it may trust for at most one minute (his answer of the same day,
 * "One minute at most"); a guarded read is to ask whether a member is still in their organization. Today only the
 * `/api/v1` `Identity` middleware asks: no model's `Session` Layer and no guarded read calls this port yet. The one
 * thing not to break: nothing a request sends chooses who acts. The headers can only refuse, never name the member.
 *
 * @packageDocumentation
 */
import * as Context from "effect/Context"
import * as DateTime from "effect/DateTime"
import * as Duration from "effect/Duration"
import type * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as S from "effect/Schema"
import type * as Headers from "effect/http/Headers"
import type { NotSignedIn } from "./AccessError.errors.ts"
import { $KernelId } from "./internal/identity.ts"
import { Member } from "./Member.schema.ts"

const $I = $KernelId.create("SessionLookup")

/** How long a verdict about a member may be trusted before the session is read again (Benjamin, 2026-11-26). */
const trustedFor = Duration.minutes(1)

/**
 * Who a request's session acts as, and until when that answer may be trusted. A live read is to be judged again at
 * `until`, once a model's `Session` Layer sets that expiry (none does yet); a command or a query is judged on every
 * call, so it reads `member` only.
 *
 * **Example** (A verdict made now, for a session that lasts for days)
 *
 * ```ts
 * import { SessionVerdict } from "@inventory/kernel/SessionLookup"
 * import * as O from "effect/Option"
 *
 * SessionVerdict.judged({ member, at: now, sessionEnds: O.none() }).until // one minute after now
 * ```
 *
 * @category schemas
 */
export class SessionVerdict extends S.Opaque<SessionVerdict, { readonly brand: unique symbol }>()(
  S.Struct({
    member: Member.pipe(S.annotateKey({ description: "The member the request acts as" })),
    until: S.DateTimeUtc.pipe(
      S.annotateKey({
        description:
          "When the verdict stops being trusted: at most a minute after it was made, never after the session ends"
      })
    )
  }).pipe(
    $I.annoteSchema("SessionVerdict", {
      description: "Who a request's session acts as, and until when that answer may be trusted"
    })
  )
) {
  /**
   * The verdict made `at` a moment about `member`: trusted until the earlier of one minute later and the session's
   * end, when the session's end is known. Once a live read ends at `until`, a session that is revoked or ends is to
   * be noticed within a minute; until a model's `Session` Layer sets that expiry, only a command or a query, judged
   * on every call, notices it.
   */
  static readonly judged = (made: {
    readonly member: Member
    readonly at: DateTime.Utc
    readonly sessionEnds: O.Option<DateTime.Utc>
  }): SessionVerdict => {
    const atMost = DateTime.addDuration(made.at, trustedFor)
    return SessionVerdict.make({
      member: made.member,
      until: O.match(made.sessionEnds, { onNone: () => atMost, onSome: (end) => DateTime.min(end, atMost) })
    })
  }

  /**
   * What every span and log line inside the request carries about who acts: ids and the role, never a name or an
   * email.
   */
  static readonly annotations = (verdict: SessionVerdict) => ({
    "actor.id": verdict.member.id,
    "actor.role": verdict.member.role,
    "organization.id": verdict.member.organizationId
  })
}

/**
 * The session lookup and the member check, for every model's `Session` middleware and every guarded read. The access
 * context's host implements it; a model's host is to turn its verdict into the model's own `CurrentActor` and, for a
 * live read, the verdict's expiry.
 *
 * @category ports
 */
export class SessionLookup extends Context.Service<
  SessionLookup,
  {
    /**
     * Who the session on these headers acts as, or `NotSignedIn` with what to do: sign in, join an organization, or
     * load a page opened for somebody else than is signed in now.
     */
    readonly verdictOf: (headers: Headers.Headers) => Effect.Effect<SessionVerdict, NotSignedIn>
    /**
     * The member as their organization's record holds them now: none once they were removed, or when they were never
     * in that organization. A guarded read is to ask it on every push, so that a removed member receives nothing
     * more (access-04); no read asks it yet.
     */
    readonly memberNow: (member: Pick<Member, "id" | "organizationId">) => Effect.Effect<O.Option<Member>>
  }
>()($I`SessionLookup`) {}
