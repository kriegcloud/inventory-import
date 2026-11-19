import { LiteralKit } from "@beep/schema/LiteralKit"
import { Option, Tuple } from "effect"
import * as S from "effect/Schema"
import { HttpApiEndpoint, HttpApiGroup, OpenApi } from "effect/http-api"
import { Identity } from "@inventory/kernel/Identity"
import { OrganizationId } from "@inventory/kernel/Ids"
import { Member } from "@inventory/kernel/Member"
import { Role } from "@inventory/kernel/Role"
import { DisplayName } from "@inventory/kernel/Text"

/** The request header the test identity reads (src/server/Identity.ts). The Worker ignores it: see SessionIdentity.ts. */
export const actingAsHeader = "x-acting-as"

/** The email an account signs in with: at most 254 characters, one `@`, no spaces. Compared whatever its case. */
export const AccountEmail = S.String.check(S.isMaxLength(254), S.isPattern(/^[^\s@]+@[^\s@]+$/)).pipe(
  S.brand("AccountEmail"),
  S.annotate({ identifier: "AccountEmail", description: "The email an account signs in with" })
)
/** The decoded value of `AccountEmail`. */
export type AccountEmail = typeof AccountEmail.Type

/** An organization a test account belongs to, and its role there. */
export class Membership extends S.Opaque<Membership, { readonly brand: unique symbol }>()(
  S.Struct({
    organizationName: DisplayName.pipe(S.annotateKey({ description: "The organization's name" })),
    role: Role
  }).annotate({
    identifier: "Membership",
    description: "An organization the account belongs to, earliest first, and its role there."
  })
) {}

/** A seeded test account the sign-in page offers in one click: who it is, and where it belongs as what. */
export class TestAccount extends S.Opaque<TestAccount, { readonly brand: unique symbol }>()(
  S.Struct({
    email: AccountEmail.pipe(S.annotateKey({ description: "The email the account signs in with" })),
    name: DisplayName.pipe(S.annotateKey({ description: "The account's name, as the sign-in page shows it" })),
    memberships: S.Array(Membership)
      .check(S.isMaxLength(20))
      .pipe(S.annotateKey({ description: "Where the account belongs, earliest first" }))
  }).annotate({
    identifier: "TestAccount",
    description: "A local test account: written by `bun run dev`, never in a deployed database."
  })
) {}

/** The test accounts a local copy offers, and the one password they share. */
export class TestAccountsOffer extends S.Opaque<TestAccountsOffer, { readonly brand: unique symbol }>()(
  S.Struct({
    password: S.String.check(S.isMinLength(1), S.isMaxLength(128)).pipe(
      S.annotateKey({ description: "The one password every test account shares; it is in the README" })
    ),
    accounts: S.Array(TestAccount)
      .check(S.isMaxLength(50))
      .pipe(S.annotateKey({ description: "The test accounts this copy's database holds" }))
  }).annotate({ identifier: "TestAccountsOffer", description: "The test accounts to offer and their password." })
) {}

/**
 * What the settings turned on that the sign-in page must know before anyone signs in. Everything here is public: the
 * test accounts' one password is in the README, and they exist only in a local database.
 */
export class SignInFeatures extends S.Opaque<SignInFeatures, { readonly brand: unique symbol }>()(
  S.Struct({
    // TEST_ACCOUNTS: the accounts to offer and their password, or null when it is off.
    testAccounts: S.OptionFromNullOr(TestAccountsOffer),
    pwnedPasswordCheck: S.Boolean.pipe(
      S.annotateKey({ description: "PWNED_PASSWORD_CHECK: a new password is checked against known data breaches." })
    )
  }).annotate({
    identifier: "SignInFeatures",
    description: "Sign-in features the settings turned on or off, as the browser needs to know them."
  })
) {}

/** An organization the signed-in person belongs to, for the switch in the account menu. */
export class OrganizationChoice extends S.Opaque<OrganizationChoice, { readonly brand: unique symbol }>()(
  S.Struct({
    id: OrganizationId,
    name: DisplayName.pipe(
      S.annotateKey({ description: "The organization's name, for the switch", examples: ["Example Works (test)"] })
    )
  }).annotate({ identifier: "OrganizationChoice", description: "One of the person's organizations." })
) {}

/** The three states a session can be in, as the browser sees it. */
export const SessionStatus = LiteralKit(["signed-out", "no-organization", "ready"]).annotate({
  identifier: "SessionStatus",
  description: "signed-out: nobody. no-organization: signed in, in no organization yet (or not the chosen one). ready."
})
/** The decoded value of `SessionStatus`. */
export type SessionStatus = typeof SessionStatus.Type

const organizations = S.Array(OrganizationChoice).pipe(
  S.annotateKey({ description: "The organizations the person can switch between" })
)
const email = AccountEmail.pipe(S.annotateKey({ description: "The email of the signed-in account" }))

/** Nobody is signed in: all the page needs is what the sign-in page offers. */
export class SignedOut extends S.Opaque<SignedOut, { readonly brand: unique symbol }>()(
  S.Struct({ status: S.tag("signed-out"), features: SignInFeatures }).annotate({
    identifier: "SignedOut",
    description: "Nobody is signed in."
  })
) {}

/** Someone is signed in and acts as nobody: in no organization yet, or no longer in the one they chose. */
export class NoOrganization extends S.Opaque<NoOrganization, { readonly brand: unique symbol }>()(
  S.Struct({ status: S.tag("no-organization"), email, organizations, features: SignInFeatures }).annotate({
    identifier: "NoOrganization",
    description: "Signed in, in no organization yet (or not in the chosen one)."
  })
) {}

/** A member is ready to act. */
export class Ready extends S.Opaque<Ready, { readonly brand: unique symbol }>()(
  S.Struct({
    status: S.tag("ready"),
    email,
    // Who this session acts as: the same member `me` answers. No key annotation: it would unwrap the class.
    actor: Member,
    organizations,
    features: SignInFeatures
  }).annotate({ identifier: "Ready", description: "A member is signed in and ready to act." })
) {}

/**
 * Everything the browser needs to know about who is signed in, in one answer: nobody, someone in no organization yet,
 * or a member with the organizations they can switch between, and the sign-in features this copy has on. Always a
 * 200, so a signed-out visit logs no failed request; fetched once per page load and cached (src/web/lib/actor.ts).
 * Each state carries only what it has: nobody signed in has no email, and only a ready session has an actor.
 */
export const SessionState = SessionStatus.mapMembers(() => Tuple.make(SignedOut, NoOrganization, Ready)).pipe(
  S.toTaggedUnion("status"),
  S.annotate({
    identifier: "SessionState",
    description: "Who is signed in and as whom they act, and what the sign-in page offers."
  })
)
/** The decoded value of `SessionState`. */
export type SessionState = typeof SessionState.Type

/**
 * The member a session acts as: only a ready session has one.
 *
 * @example actorOfSession(SignedOut.make({ status: "signed-out", features })) // Option.none()
 */
export const actorOfSession = (state: SessionState): Option.Option<Member> =>
  state.status === "ready" ? Option.some(state.actor) : Option.none()

/** Who the caller is, and the people in their organization. */
export class IdentityApi extends HttpApiGroup.make("identity")
  .add(
    HttpApiEndpoint.get("session", "/session", { success: SessionState })
      .annotate(OpenApi.Summary, "Who is signed in, as which member, and what the sign-in page offers")
      .annotate(
        OpenApi.Description,
        "Open: it answers for nobody too, so the page can show sign-in without a failed request. Always 200; `status` says whether nobody is signed in, someone is signed in but in no organization, or a member is ready to act."
      ),
    HttpApiEndpoint.get("members", "/members", {
      success: S.Array(Member).annotate({ description: "Every member of the caller's organization" })
    })
      .middleware(Identity)
      .annotate(OpenApi.Summary, "The people in the actor's organization")
      .annotate(OpenApi.Description, "Every member of the caller's organization. Any member may read it."),
    HttpApiEndpoint.get("me", "/me", { success: Member })
      .middleware(Identity)
      .annotate(OpenApi.Summary, "The member this request acts as")
      .annotate(
        OpenApi.Description,
        "The member the session acts as in its active organization: the same value `session` answers as `actor`."
      )
  )
  .prefix("/identity")
  .annotate(OpenApi.Title, "Identity")
  .annotate(OpenApi.Description, "Who the caller is. Identity comes only from here, never from a payload.") {}
