/**
 * Who is signed in, as the browser needs to know it in one answer: nobody, someone in no organization yet, or a
 * member ready to act, each state carrying only what it has.
 *
 * @packageDocumentation
 */
import { LiteralKit } from "@beep/schema/LiteralKit"
import { OrganizationId } from "@inventory/kernel/Ids"
import { Member } from "@inventory/kernel/Member"
import { Role } from "@inventory/kernel/Role"
import { DisplayName } from "@inventory/kernel/Text"
import { Option, Tuple } from "effect"
import * as S from "effect/Schema"
import { $AccessContractId } from "../internal/identity.ts"

const $I = $AccessContractId.create("Session/SessionState")

/**
 * The email an account signs in with: at most 254 characters, one `@`, no spaces. Compared whatever its case.
 *
 * @category schemas
 */
export const AccountEmail = S.String.check(S.isMaxLength(254), S.isPattern(/^[^\s@]+@[^\s@]+$/)).pipe(
  S.brand("AccountEmail"),
  $I.annoteSchema("AccountEmail", { description: "The email an account signs in with" })
)

/**
 * The decoded value of `AccountEmail`.
 *
 * @category models
 */
export type AccountEmail = typeof AccountEmail.Type

/**
 * An organization a test account belongs to, and its role there.
 *
 * @category schemas
 */
export class Membership extends S.Opaque<Membership, { readonly brand: unique symbol }>()(
  S.Struct({
    organizationName: DisplayName.pipe(S.annotateKey({ description: "The organization's name" })),
    role: Role
  }).pipe(
    $I.annoteSchema("Membership", {
      description: "An organization the account belongs to, earliest first, and its role there."
    })
  )
) {}

/**
 * A seeded test account the sign-in page offers in one click: who it is, and where it belongs as what.
 *
 * @category schemas
 */
export class TestAccount extends S.Opaque<TestAccount, { readonly brand: unique symbol }>()(
  S.Struct({
    email: AccountEmail.pipe(S.annotateKey({ description: "The email the account signs in with" })),
    name: DisplayName.pipe(S.annotateKey({ description: "The account's name, as the sign-in page shows it" })),
    memberships: S.Array(Membership)
      .check(S.isMaxLength(20))
      .pipe(S.annotateKey({ description: "Where the account belongs, earliest first" }))
  }).pipe(
    $I.annoteSchema("TestAccount", {
      description: "A local test account: written by `bun run dev`, never in a deployed database."
    })
  )
) {}

/**
 * The test accounts a local copy offers, and the one password they share.
 *
 * @category schemas
 */
export class TestAccountsOffer extends S.Opaque<TestAccountsOffer, { readonly brand: unique symbol }>()(
  S.Struct({
    password: S.String.check(S.isMinLength(1), S.isMaxLength(128)).pipe(
      S.annotateKey({ description: "The one password every test account shares; it is in the README" })
    ),
    accounts: S.Array(TestAccount)
      .check(S.isMaxLength(50))
      .pipe(S.annotateKey({ description: "The test accounts this copy's database holds" }))
  }).pipe($I.annoteSchema("TestAccountsOffer", { description: "The test accounts to offer and their password." }))
) {}

/**
 * What the settings turned on that the sign-in page must know before anyone signs in. Everything here is public: the
 * test accounts' one password is in the README, and they exist only in a local database.
 *
 * @category schemas
 */
export class SignInFeatures extends S.Opaque<SignInFeatures, { readonly brand: unique symbol }>()(
  S.Struct({
    // TEST_ACCOUNTS: the accounts to offer and their password, or null when it is off.
    testAccounts: S.OptionFromNullOr(TestAccountsOffer),
    pwnedPasswordCheck: S.Boolean.pipe(
      S.annotateKey({ description: "PWNED_PASSWORD_CHECK: a new password is checked against known data breaches." })
    )
  }).pipe(
    $I.annoteSchema("SignInFeatures", {
      description: "Sign-in features the settings turned on or off, as the browser needs to know them."
    })
  )
) {}

/**
 * An organization the signed-in person belongs to, for the switch in the account menu.
 *
 * @category schemas
 */
export class OrganizationChoice extends S.Opaque<OrganizationChoice, { readonly brand: unique symbol }>()(
  S.Struct({
    id: OrganizationId,
    name: DisplayName.pipe(
      S.annotateKey({ description: "The organization's name, for the switch", examples: ["Example Works (test)"] })
    )
  }).pipe($I.annoteSchema("OrganizationChoice", { description: "One of the person's organizations." }))
) {}

/**
 * The three states a session can be in, as the browser sees it.
 *
 * @category schemas
 */
export const SessionStatus = LiteralKit(["signed-out", "no-organization", "ready"]).pipe(
  $I.annoteSchema("SessionStatus", {
    description:
      "signed-out: nobody. no-organization: signed in, in no organization yet (or not the chosen one). ready."
  })
)

/**
 * The decoded value of `SessionStatus`.
 *
 * @category models
 */
export type SessionStatus = typeof SessionStatus.Type

const organizations = S.Array(OrganizationChoice).pipe(
  S.annotateKey({ description: "The organizations the person can switch between" })
)
const email = AccountEmail.pipe(S.annotateKey({ description: "The email of the signed-in account" }))

/**
 * Nobody is signed in: all the page needs is what the sign-in page offers.
 *
 * @category schemas
 */
export class SignedOut extends S.Opaque<SignedOut, { readonly brand: unique symbol }>()(
  S.Struct({ status: S.tag("signed-out"), features: SignInFeatures }).pipe(
    $I.annoteSchema("SignedOut", { description: "Nobody is signed in." })
  )
) {}

/**
 * Someone is signed in and acts as nobody: in no organization yet, or no longer in the one they chose.
 *
 * @category schemas
 */
export class NoOrganization extends S.Opaque<NoOrganization, { readonly brand: unique symbol }>()(
  S.Struct({ status: S.tag("no-organization"), email, organizations, features: SignInFeatures }).pipe(
    $I.annoteSchema("NoOrganization", {
      description: "Signed in, in no organization yet (or not in the chosen one)."
    })
  )
) {}

/**
 * A member is ready to act.
 *
 * @category schemas
 */
export class Ready extends S.Opaque<Ready, { readonly brand: unique symbol }>()(
  S.Struct({
    status: S.tag("ready"),
    email,
    // Who this session acts as: the same member `me` answers. No key annotation: it would unwrap the class.
    actor: Member,
    organizations,
    features: SignInFeatures
  }).pipe($I.annoteSchema("Ready", { description: "A member is signed in and ready to act." }))
) {}

/**
 * Everything the browser needs to know about who is signed in, in one answer: nobody, someone in no organization yet,
 * or a member with the organizations they can switch between, and the sign-in features this copy has on. Always a
 * 200, so a signed-out visit logs no failed request. Each state carries only what it has: nobody signed in has no
 * email, and only a ready session has an actor. Branch with `SessionState.match`.
 *
 * @category schemas
 */
export const SessionState = SessionStatus.mapMembers(() => Tuple.make(SignedOut, NoOrganization, Ready)).pipe(
  S.toTaggedUnion("status"),
  $I.annoteSchema("SessionState", {
    description: "Who is signed in and as whom they act, and what the sign-in page offers."
  })
)

/**
 * The decoded value of `SessionState`.
 *
 * @category models
 */
export type SessionState = typeof SessionState.Type

/**
 * The member a session acts as: only a ready session has one.
 *
 * **Example** (Nobody is signed in)
 *
 * ```ts
 * import { actorOfSession, SignedOut } from "@inventory/access-contract/SessionState"
 * actorOfSession(SignedOut.make({ features })) // Option.none()
 * ```
 *
 * @category getters
 */
export const actorOfSession = (state: SessionState): Option.Option<Member> =>
  state.status === "ready" ? Option.some(state.actor) : Option.none()
