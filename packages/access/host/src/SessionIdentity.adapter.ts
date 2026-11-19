/**
 * SIGNED-IN IDENTITY. The Worker's `Identity` middleware: the session cookie names a user and their active
 * organization, and their membership there is the actor. Nothing in a request header or payload can choose who the
 * actor is. Handlers read `CurrentActor` and call `requireRole`. Writes from another site have already been refused
 * (`SameOrigin` on the whole API, and the same rule on /api/auth/* in `SignIn.route.ts`).
 *
 * @packageDocumentation
 */
import { BetterAuth } from "@beep/better-auth/BetterAuth"
import type { AuthSession } from "@beep/better-auth/BetterAuthSession"
import {
  AccountEmail,
  type SessionState,
  SignInFeatures,
  TestAccountsOffer
} from "@inventory/access-contract/SessionState"
import { accessHandlers } from "@inventory/access-model/Handlers"
import { MemberDirectory, SignedInUser } from "@inventory/access-model/MemberDirectory"
import { CurrentActor } from "@inventory/kernel/Actor"
import { Identity } from "@inventory/kernel/Identity"
import { OrganizationId, UserId } from "@inventory/kernel/Ids"
import * as A from "effect/Array"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as O from "effect/Option"
import * as HttpServerRequest from "effect/http/HttpServerRequest"
import { signUpOfferOf } from "@inventory/access-model/SignUp"
import { authSettings } from "./Config.ts"
import { $AccessHostId } from "./internal/identity.ts"
import { seededAccounts, testAccountPassword } from "./internal/TestAccounts.ts"

const $I = $AccessHostId.create("SessionIdentity")

/** What Better Auth's session says, in the access context's own ids: the two share their text and their rules. */
const signedIn = (session: AuthSession): SignedInUser =>
  SignedInUser.make({
    userId: UserId.make(session.userId),
    email: AccountEmail.make(session.email),
    active: O.map(session.activeOrganizationId, (id) => OrganizationId.make(id))
  })

/**
 * Resolves `CurrentActor` from the Better Auth session on the request, or fails with `NotSignedIn` (401).
 *
 * @category layers
 */
export const SessionIdentityLive: Layer.Layer<Identity, never, BetterAuth | MemberDirectory> = Layer.effect(
  Identity,
  Effect.gen(function* () {
    const auth = yield* BetterAuth
    const directory = yield* MemberDirectory
    return Identity.of(
      Effect.fn("Identity")(function* (httpEffect) {
        const request = yield* HttpServerRequest.HttpServerRequest
        // A Better Auth failure is no fault of the request: it ends as a 500, as before the driver typed it.
        const session = yield* auth.session(new Headers(request.headers)).pipe(Effect.orDie)
        const member = yield* accessHandlers
          .actorOf(O.map(session, signedIn))
          .pipe(Effect.provideService(MemberDirectory, directory))
        // Ids only, never a name or an email: every span and log line inside the request carries who acted.
        const who = {
          "actor.id": member.id,
          "actor.role": member.role,
          "organization.id": member.organizationId
        }
        yield* Effect.annotateCurrentSpan(who)
        return yield* httpEffect.pipe(
          Effect.provideService(CurrentActor, member),
          Effect.annotateSpans(who),
          Effect.annotateLogs(who)
        )
      })
    )
  })
)

/**
 * The session as the browser needs it, in one answer (`GET /api/v1/identity/session`): the Better Auth session, the
 * same membership rule as `SessionIdentityLive`, and the sign-in features the settings turned on. The test accounts
 * are read from the database, so an unseeded one offers none.
 *
 * @category services
 */
export class Sessions extends Context.Service<
  Sessions,
  { readonly state: (headers: Headers) => Effect.Effect<SessionState> }
>()($I`Sessions`) {
  /** `Sessions` for a build: `production` picks the sign-in defaults. */
  static readonly layer = (build: { readonly production: boolean }) =>
    Layer.effect(
      Sessions,
      Effect.gen(function* () {
        const auth = yield* BetterAuth
        const directory = yield* MemberDirectory
        const settings = yield* authSettings(build)
        const userIds = A.map(seededAccounts, (account) => UserId.make(account.userId))
        return Sessions.of({
          state: Effect.fn("Sessions.state")(function* (headers: Headers) {
            const found = settings.testAccounts ? yield* directory.testAccounts(userIds) : []
            const accounts = settings.testAccounts ? O.some(found) : O.none()
            const features = SignInFeatures.make({
              testAccounts: O.map(accounts, (offered) =>
                TestAccountsOffer.make({ password: testAccountPassword, accounts: offered })
              ),
              pwnedPasswordCheck: settings.pwnedPasswordCheck,
              signUp: signUpOfferOf(settings.signUp)
            })
            const session = yield* auth.session(headers).pipe(Effect.orDie)
            return yield* accessHandlers
              .sessionState({ user: O.map(session, signedIn), features })
              .pipe(Effect.provideService(MemberDirectory, directory))
          })
        })
      })
    )
}
