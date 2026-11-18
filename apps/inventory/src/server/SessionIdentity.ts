import { Array as Arr, Context, Effect, Layer, Option } from "effect"
import { HttpServerRequest } from "effect/http"
import {
  CurrentActor,
  Identity,
  NotSignedIn,
  SessionState,
  SignInFeatures,
  type OrganizationChoice
} from "../api/v1/Identity.ts"
import { type Member, OrganizationId } from "../domain/Identity.ts"
import { Auth, type AuthSession } from "./Auth.ts"
import { Members } from "./Members.ts"
import { authSettings } from "./Settings.ts"
import { seededAccounts, testAccountPassword } from "./TestAccounts.ts"

// SIGNED-IN IDENTITY. The Worker's `Identity` middleware: the session cookie names a user and their active
// organization, and their membership there is the actor. Nothing in a request header or payload can choose who the
// actor is. Handlers are unchanged: they read `CurrentActor` and call `requireRole`, as before. Writes from another
// site have already been refused (`SameOrigin` on the whole API, and the same rule on /api/auth/* in Auth.ts).

/**
 * The member a session acts as: in the active organization, or, with none chosen yet (or Better Auth cleared it after
 * a refused switch), the person's earliest one. Removed from the chosen one: none, so the session stays and the access
 * does not.
 */
const actorOf = (
  members: Context.Service.Shape<typeof Members>,
  session: AuthSession
): Effect.Effect<Option.Option<Member>> =>
  members.findByUser(
    session.userId,
    session.activeOrganizationId === null ? null : OrganizationId.make(session.activeOrganizationId)
  )

/** Resolves `CurrentActor` from the Better Auth session on the request, or fails with `NotSignedIn` (401). */
export const SessionIdentityLive = Layer.effect(
  Identity,
  Effect.gen(function* () {
    const auth = yield* Auth
    const members = yield* Members
    return Identity.of(
      Effect.fn("Identity")(function* (httpEffect) {
        const request = yield* HttpServerRequest.HttpServerRequest
        const session = yield* auth.session(new Headers(request.headers))
        if (Option.isNone(session)) {
          return yield* NotSignedIn.make({ reason: "Sign in to continue." })
        }
        const member = yield* actorOf(members, session.value)
        if (Option.isNone(member)) {
          // No request value in the reason: what a request sent is not repeated to the screen or the log.
          return yield* NotSignedIn.make({
            reason:
              session.value.activeOrganizationId === null
                ? "You are signed in but not part of an organization yet."
                : "You are no longer a member of that organization."
          })
        }
        // Ids only, never a name or an email: every span and log line inside the request carries who acted.
        const who = {
          "actor.id": member.value.id,
          "actor.role": member.value.role,
          "organization.id": member.value.organizationId
        }
        yield* Effect.annotateCurrentSpan(who)
        return yield* httpEffect.pipe(
          Effect.provideService(CurrentActor, member.value),
          Effect.annotateSpans(who),
          Effect.annotateLogs(who)
        )
      })
    )
  })
)

/** The session as the browser needs it, in one answer (`GET /api/v1/identity/session`). */
export class Sessions extends Context.Service<Sessions, { state(headers: Headers): Effect.Effect<SessionState> }>()(
  "@inventory/app/server/SessionIdentity/Sessions"
) {
  /**
   * The answer from the Better Auth session, the same membership rule as `SessionIdentityLive`, and the sign-in
   * features the settings turned on. The test accounts are read from the database, so an unseeded one offers none.
   */
  static readonly layer = (build: { readonly production: boolean }) =>
    Layer.effect(
      Sessions,
      Effect.gen(function* () {
        const auth = yield* Auth
        const members = yield* Members
        const settings = yield* authSettings(build)
        const userIds = Arr.map(seededAccounts, (account) => account.userId)
        return Sessions.of({
          state: Effect.fn("Sessions.state")(function* (headers: Headers) {
            const features = SignInFeatures.make({
              testAccounts: settings.testAccounts
                ? { password: testAccountPassword, accounts: yield* members.testAccounts(userIds) }
                : null,
              pwnedPasswordCheck: settings.pwnedPasswordCheck
            })
            const session = yield* auth.session(headers)
            if (Option.isNone(session)) {
              return SessionState.make({ status: "signed-out", email: null, actor: null, organizations: [], features })
            }
            const organizations: ReadonlyArray<OrganizationChoice> = yield* members.organizationsOf(
              session.value.userId
            )
            const actor = yield* actorOf(members, session.value)
            return SessionState.make({
              status: Option.isSome(actor) ? "ready" : "no-organization",
              email: session.value.email,
              actor: Option.getOrNull(actor),
              organizations,
              features
            })
          })
        })
      })
    )
}
