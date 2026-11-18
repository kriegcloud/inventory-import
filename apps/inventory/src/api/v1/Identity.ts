import { Context, Schema } from "effect"
import { HttpApiEndpoint, HttpApiGroup, HttpApiMiddleware, OpenApi } from "effect/http-api"
import { Member, OrganizationId, Role } from "../../domain/Identity.ts"

/** The member making this request. Handlers read it; they never trust an id from the payload. */
export class CurrentActor extends Context.Service<CurrentActor, Member>()("inventory/api/v1/Identity/CurrentActor") {}

/** No member could be resolved for this request. The reason says what to do, without echoing what was sent. */
export class NotSignedIn extends Schema.TaggedError<NotSignedIn, { readonly brand: unique symbol }>()(
  "NotSignedIn",
  { reason: Schema.String.annotate({ description: "What to do next, in words for the person." }) },
  { httpApiStatus: 401, description: "The request has no session, or its person is in no organization yet." }
) {}

/** The member is known but their role is too low for this action. `required` is the role that would be allowed. */
export class Forbidden extends Schema.TaggedError<Forbidden, { readonly brand: unique symbol }>()(
  "Forbidden",
  {
    reason: Schema.String.annotate({
      description: "Which role the person has and which one this needs. It never names the person."
    }),
    required: Role.annotate({ description: "The lowest role that may do this." })
  },
  { httpApiStatus: 403, description: "The member's role is too low for this action." }
) {}

/** The request header the test identity reads (src/server/Identity.ts). The Worker ignores it: see SessionIdentity.ts. */
export const actingAsHeader = "x-acting-as"

/**
 * Resolves the acting member and provides `CurrentActor` to every endpoint it is attached to.
 * This is the single seam for identity: the Worker's implementation reads the session cookie
 * (src/server/SessionIdentity.ts), and handlers do not know which one is in place.
 */
export class Identity extends HttpApiMiddleware.Service<
  Identity,
  {
    provides: CurrentActor
    requires: never
  }
>()("inventory/api/v1/Identity", {
  error: NotSignedIn
}) {}

/** A seeded test account the sign-in page offers in one click: who it is, and where it belongs as what. */
export class TestAccount extends Schema.Class<TestAccount, { readonly brand: unique symbol }>("TestAccount")(
  {
    email: Schema.String.annotate({
      description: "The email the account signs in with",
      examples: ["marcus@example-works.test"]
    }),
    name: Schema.String.annotate({
      description: "The account's name, as the sign-in page shows it",
      examples: ["Marcus Oyelaran"]
    }),
    memberships: Schema.Array(
      Schema.Struct({
        organizationName: Schema.String.annotate({ description: "The organization's name" }),
        role: Role
      }).annotate({
        description: "An organization the account belongs to, earliest first, and its role there."
      })
    ).annotate({ description: "Where the account belongs, earliest first" })
  },
  { description: "A local test account: written by `bun run dev`, never in a deployed database." }
) {}

/**
 * What the settings turned on that the sign-in page must know before anyone signs in. Everything here is public: the
 * test accounts' one password is in the README, and they exist only in a local database.
 */
export class SignInFeatures extends Schema.Class<SignInFeatures, { readonly brand: unique symbol }>("SignInFeatures")(
  {
    testAccounts: Schema.NullOr(
      Schema.Struct({
        password: Schema.String.annotate({
          description: "The one password every test account shares; it is in the README"
        }),
        accounts: Schema.Array(TestAccount).annotate({ description: "The test accounts this copy's database holds" })
      })
    ).annotate({ description: "TEST_ACCOUNTS: the accounts to offer and their password, or null when it is off." }),
    pwnedPasswordCheck: Schema.Boolean.annotate({
      description: "PWNED_PASSWORD_CHECK: a new password is checked against known data breaches."
    })
  },
  { description: "Sign-in features the settings turned on or off, as the browser needs to know them." }
) {}

/** An organization the signed-in person belongs to, for the switch in the account menu. */
export class OrganizationChoice extends Schema.Class<OrganizationChoice, { readonly brand: unique symbol }>(
  "OrganizationChoice"
)(
  {
    id: OrganizationId,
    name: Schema.String.annotate({
      description: "The organization's name, for the switch",
      examples: ["Example Works (test)"]
    })
  },
  { description: "One of the person's organizations." }
) {}

/**
 * Everything the browser needs to know about who is signed in, in one answer: nobody, someone in no organization yet,
 * or a member with the organizations they can switch between, and the sign-in features this copy has on. Always a
 * 200, so a signed-out visit logs no failed request; fetched once per page load and cached (src/web/lib/actor.ts).
 */
export class SessionState extends Schema.Class<SessionState, { readonly brand: unique symbol }>("SessionState")(
  {
    status: Schema.Literals(["signed-out", "no-organization", "ready"]).annotate({
      description: "ready: `actor` is set. no-organization: signed in, in no organization yet (or not the chosen one)."
    }),
    email: Schema.NullOr(Schema.String).annotate({
      description: "The email of the signed-in account; null when nobody is signed in"
    }),
    actor: Schema.NullOr(Member).annotate({ description: "Who this session acts as: the same member `me` answers." }),
    organizations: Schema.Array(OrganizationChoice).annotate({
      description: "The organizations the person can switch between; empty when nobody is signed in"
    }),
    features: SignInFeatures
  },
  { description: "Who is signed in and as whom they act, and what the sign-in page offers." }
) {}

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
      success: Schema.Array(Member).annotate({ description: "Every member of the caller's organization" })
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
