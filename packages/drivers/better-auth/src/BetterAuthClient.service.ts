/**
 * Better Auth's browser client as Effects: sign in, make an account, sign out, make an organization, choose the
 * organization to work in. Each ends when Better Auth has answered and fails with `BetterAuthRefused`; a screen writes
 * no Promise. This file is the one place the client's Promises come in.
 *
 * The one thing not to break: Better Auth's client is fetched only when one of these is first run (or `preload` is),
 * never when this module loads, so the first page of an app does not carry it.
 *
 * @packageDocumentation
 */
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as S from "effect/Schema"
import {
  BetterAuthRefused,
  ClientAnswer,
  type Credentials,
  type NewAccount,
  type NewOrganization
} from "./BetterAuthClient.schema.ts"
import type { BrowserClient } from "./internal/browserClient.ts"

/** No answer came, or one that could not be read: nothing to say but that it failed. */
const unanswered = () => BetterAuthRefused.make({ status: O.none(), sentence: O.none() })

const decodeAnswer = S.decodeUnknownEffect(ClientAnswer)

/** A call of Better Auth's client, as `Effect.promise` takes one: the type is the library's, so none is named here. */
type ClientCall = Parameters<typeof Effect.promise>[0]

/** One call of the client: its Promise taken in here, its answer decoded, an error in it a `BetterAuthRefused`. */
const asked = (call: ClientCall): Effect.Effect<void, BetterAuthRefused> =>
  Effect.tryPromise({ try: call, catch: unanswered }).pipe(
    Effect.flatMap((answer) => decodeAnswer(answer).pipe(Effect.mapError(unanswered))),
    Effect.flatMap(({ error }) =>
      O.match(error, {
        onNone: () => Effect.void,
        onSome: ({ status, message }) =>
          Effect.fail(BetterAuthRefused.make({ status: O.some(status), sentence: message }))
      })
    )
  )

/**
 * What a screen can ask of Better Auth. None of them says who is signed in afterwards: the app asks its own session
 * endpoint for that.
 *
 * @category models
 */
export interface BetterAuthClient {
  /** Fetches Better Auth's client now, so the first press does not wait for it. Never fails. */
  readonly preload: Effect.Effect<void>
  /** Signs in with an email and a password: Better Auth sets the session cookie. */
  readonly signIn: (credentials: Credentials) => Effect.Effect<void, BetterAuthRefused>
  /** Makes an account and signs it in. */
  readonly signUp: (account: NewAccount) => Effect.Effect<void, BetterAuthRefused>
  /** Ends the session of this browser. */
  readonly signOut: Effect.Effect<void, BetterAuthRefused>
  /** Makes an organization the signed-in person is the admin of. */
  readonly createOrganization: (organization: NewOrganization) => Effect.Effect<void, BetterAuthRefused>
  /** Moves the session to another organization the person belongs to; the server checks the membership. */
  readonly setActiveOrganization: (organizationId: string) => Effect.Effect<void, BetterAuthRefused>
}

/**
 * The client's five calls as Effects, on a Better Auth client that `load` fetches when first needed.
 *
 * @example
 * const auth = makeBetterAuthClient(Effect.sync(() => makeBrowserClient({ baseURL: "http://localhost" })))
 * yield* auth.signIn(Credentials.make({ email: "dana@example-works.test", password: typed }))
 *
 * @category constructors
 */
export const makeBetterAuthClient = (load: Effect.Effect<BrowserClient>): BetterAuthClient => ({
  preload: Effect.asVoid(load),
  signIn: Effect.fn("BetterAuthClient.signIn")(function* ({ email, password }) {
    const client = yield* load
    return yield* asked(() => client.signIn.email({ email, password }))
  }),
  signUp: Effect.fn("BetterAuthClient.signUp")(function* ({ name, email, password }) {
    const client = yield* load
    return yield* asked(() => client.signUp.email({ name, email, password }))
  }),
  signOut: Effect.flatMap(load, (client) => asked(() => client.signOut())).pipe(
    Effect.withSpan("BetterAuthClient.signOut")
  ),
  createOrganization: Effect.fn("BetterAuthClient.createOrganization")(function* ({ name, slug }) {
    const client = yield* load
    return yield* asked(() => client.organization.create({ name, slug }))
  }),
  setActiveOrganization: Effect.fn("BetterAuthClient.setActiveOrganization")(function* (organizationId) {
    const client = yield* load
    return yield* asked(() => client.organization.setActive({ organizationId }))
  })
})

/**
 * Better Auth for the page: at /api/auth on its own origin, its client fetched the first time it is needed. The
 * module system keeps the one copy, so asking again costs nothing.
 *
 * @category instances
 */
export const betterAuthClient: BetterAuthClient = makeBetterAuthClient(
  Effect.promise(() => import("./internal/browserClient.ts")).pipe(Effect.map((module) => module.browserClient))
)
