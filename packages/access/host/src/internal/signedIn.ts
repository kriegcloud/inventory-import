// What Better Auth's session says, in the access context's own ids: the two share their text and their rules. Read by
// the session lookup and by the session answer the browser asks for, so both start from the same user. And the
// request's headers as Better Auth reads them, the Fetch API's `Headers`.
import type { AuthSession } from "@beep/better-auth/BetterAuthSession"
import { AccountEmail } from "@inventory/access-contract/SessionState"
import { SignedInUser } from "@inventory/access-model/MemberDirectory"
import { OrganizationId, UserId } from "@inventory/kernel/Ids"
import * as O from "effect/Option"

/** The signed-in user a Better Auth session names. */
export const signedIn = (session: AuthSession): SignedInUser =>
  SignedInUser.make({
    userId: UserId.make(session.userId),
    email: AccountEmail.make(session.email),
    active: O.map(session.activeOrganizationId, (id) => OrganizationId.make(id))
  })

/** A request's headers, as Effect holds them, in the form Better Auth's `getSession` takes. */
export const webHeadersOf = (headers: Readonly<Record<string, string>>): Headers => new Headers(headers)
