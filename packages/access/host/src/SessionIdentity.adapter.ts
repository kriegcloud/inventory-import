/**
 * SIGNED-IN IDENTITY. The Worker's `Identity` middleware for what stays on `/api/v1`: the one session lookup
 * (`SessionLookupLive`, the kernel's `SessionLookup`) names the member, and this provides them as the kernel's
 * `CurrentActor`. Nothing in a request header or payload can choose who the actor is; the header a page names its
 * member in (`pageMemberHeader`) can only refuse the request, when the session's member is somebody else. Handlers
 * read `CurrentActor` and call `requireRole`. Writes from another site have already been refused (`SameOrigin` on the
 * whole API, and the same rule on /api/auth/* in `SignIn.route.ts`).
 *
 * @packageDocumentation
 */
import { BetterAuth } from "@beep/better-auth/BetterAuth"
import { type SessionState, SignInFeatures, TestAccountsOffer } from "@inventory/access-contract/SessionState"
import { accessHandlers } from "@inventory/access-model/Handlers"
import { MemberDirectory } from "@inventory/access-model/MemberDirectory"
import { CurrentActor } from "@inventory/kernel/Actor"
import { Identity } from "@inventory/kernel/Identity"
import { UserId } from "@inventory/kernel/Ids"
import { SessionLookup, SessionVerdict } from "@inventory/kernel/SessionLookup"
import * as A from "effect/Array"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as O from "effect/Option"
import * as HttpServerRequest from "effect/http/HttpServerRequest"
import { signUpOfferOf } from "@inventory/access-model/SignUp"
import { authSettings } from "./Auth.config.ts"
import { $AccessHostId } from "./internal/identity.ts"
import { signedIn } from "./internal/signedIn.ts"
import { seededAccounts, testAccountPassword } from "./internal/TestAccounts.ts"
import { SessionLookupLive } from "./SessionLookup.adapter.ts"

const $I = $AccessHostId.create("SessionIdentity")

/**
 * Resolves `CurrentActor` from the Better Auth session on the request, or fails with `NotSignedIn` (401).
 *
 * @category layers
 */
export const SessionIdentityLive: Layer.Layer<Identity, never, BetterAuth | MemberDirectory> = Layer.effect(
  Identity,
  Effect.gen(function* () {
    const sessions = yield* SessionLookup
    return Identity.of(
      Effect.fn("Identity")(function* (httpEffect) {
        const request = yield* HttpServerRequest.HttpServerRequest
        // A request is judged on every call, so the verdict's expiry, which is to end a live read, is not read here.
        const verdict = yield* sessions.verdictOf(request.headers)
        // Ids only, never a name or an email: every span and log line inside the request carries who acted.
        const who = SessionVerdict.annotations(verdict)
        yield* Effect.annotateCurrentSpan(who)
        return yield* httpEffect.pipe(
          Effect.provideService(CurrentActor, verdict.member),
          Effect.annotateSpans(who),
          Effect.annotateLogs(who)
        )
      })
    )
  })
).pipe(Layer.provide(SessionLookupLive))

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
            // A stage with its own password for the test accounts never offers them in one click: the page would
            // have to hand that password to whoever opens it.
            const offered = settings.testAccounts && O.isNone(settings.testAccountPassword)
            const found = offered ? yield* directory.testAccounts(userIds) : []
            const accounts = offered ? O.some(found) : O.none()
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
