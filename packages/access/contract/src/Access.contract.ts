/**
 * The three groups of the API that say who may do what: who the caller is, the people of their organization, and
 * the audit trail. The app adds them to its `Api`; the handlers are built by `@inventory/access-host`.
 *
 * @packageDocumentation
 */
import { Forbidden } from "@inventory/kernel/AccessError"
import { Identity } from "@inventory/kernel/Identity"
import { MemberId } from "@inventory/kernel/Ids"
import { Member } from "@inventory/kernel/Member"
import * as S from "effect/Schema"
import * as HttpApiEndpoint from "effect/http-api/HttpApiEndpoint"
import * as HttpApiGroup from "effect/http-api/HttpApiGroup"
import * as HttpApiSchema from "effect/http-api/HttpApiSchema"
import * as OpenApi from "effect/http-api/OpenApi"
import { AuditTrail } from "./Activity/AuditTrail.read.ts"
import { AddPerson, AddPersonOutcome, ChangeRole } from "./People/People.payload.ts"
import { LastAdmin, PersonNotFound } from "./People/People.rejection.ts"
import { Person } from "./People/Person.read.ts"
import { SessionState } from "./Session/SessionState.read.ts"

/** The request header the test identity reads. The Worker ignores it: the session cookie alone names the actor. */
export const actingAsHeader = "x-acting-as"

/**
 * The request header a page of the app sends with every request of its API client: the member the page is for, as
 * "memberId/organizationId". One browser has one session cookie for all its tabs, so somebody signing in, signing out
 * or switching organization in another tab changes who every tab's requests act as. When the session's member is not
 * the one named here, the request is refused with `NotSignedIn` before anything is read or written: nothing a page
 * pressed is done as somebody else, and no page is answered with somebody else's data. A request without it is served
 * as the session's member, as before.
 */
export const pageMemberHeader = "x-page-member"

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

const memberId = {
  memberId: MemberId.pipe(
    S.annotateKey({
      description: "The member's id, as `people.list` gives it (`memberId`)",
      examples: [MemberId.make("mem_marcus")]
    })
  )
}

/**
 * Who is in the organization. Every member can read the list; adding a person, changing a role and removing a
 * member need the admin role. A person is added by the email they signed up with: no email is sent.
 */
export class PeopleApi extends HttpApiGroup.make("people")
  .add(
    HttpApiEndpoint.get("list", "/", {
      success: S.Array(Person).annotate({ description: "Every member of the caller's organization" })
    })
      .annotate(OpenApi.Summary, "List the people of the caller's organization")
      .annotate(
        OpenApi.Description,
        "Who is in the caller's organization, with each person's role. Any member may read it."
      ),
    HttpApiEndpoint.post("add", "/", {
      payload: AddPerson,
      success: AddPersonOutcome,
      error: Forbidden
    })
      .annotate(OpenApi.Summary, "Add a person who has signed up, with a role")
      .annotate(
        OpenApi.Description,
        "Adds a person by the email they signed up with; no email is sent. Answers 200 either way: the person added (or already there with that role), or why not (`AddPersonProblem`: nobody signed up with that email, or they are already a member with another role). Needs the admin role."
      ),
    HttpApiEndpoint.post("setRole", "/:memberId/role", {
      params: memberId,
      payload: ChangeRole,
      success: Person,
      error: [Forbidden, PersonNotFound, LastAdmin]
    })
      .annotate(OpenApi.Summary, "Change a person's role")
      .annotate(
        OpenApi.Description,
        "Changes a member's role. Refused with 409 `LastAdmin` when it would leave the organization with no admin. Needs the admin role."
      ),
    HttpApiEndpoint.delete("remove", "/:memberId", {
      params: memberId,
      success: HttpApiSchema.NoContent,
      error: [Forbidden, PersonNotFound, LastAdmin]
    })
      .annotate(OpenApi.Summary, "Remove a person from the organization")
      .annotate(
        OpenApi.Description,
        "Removes a member from the organization and answers 204 with no body. Refused with 409 `LastAdmin` when it would leave the organization with no admin. Needs the admin role."
      )
  )
  .middleware(Identity)
  .prefix("/people")
  .annotate(OpenApi.Title, "People")
  .annotate(
    OpenApi.Description,
    "Who is in the organization. Every member can read the list; adding a person, changing a role and removing a member need the admin role. A person is added by the email they signed up with: no email is sent."
  ) {}

/**
 * The audit trail of the current member's organization: who did what, newest first. It is written only by the
 * things it records (an upload, an import, a take-back, a change of role), in the same batch, never by a request of
 * its own.
 */
export class ActivityApi extends HttpApiGroup.make("activity")
  .add(
    HttpApiEndpoint.get("recent", "/", {
      success: AuditTrail
    })
      .annotate(OpenApi.Summary, "The organization's audit trail, newest first")
      .annotate(
        OpenApi.Description,
        "Who did what in the caller's organization, newest first. A line is written only by the thing it records (an upload, an import, a take-back, an edit, a change of role), in the same batch; no request writes one of its own. Any member may read it."
      )
  )
  .middleware(Identity)
  .prefix("/activity")
  .annotate(OpenApi.Title, "Activity")
  .annotate(
    OpenApi.Description,
    "The audit trail of the caller's organization: who did what, newest first. It is written only by the things it records, in the same batch, never by a request of its own."
  ) {}
