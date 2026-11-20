import { createAuthClient } from "better-auth/client"
import { organizationClient } from "better-auth/client/plugins"

// Loaded only when a person acts (signs in, signs up, switches organization, signs out): every import of this file
// is a dynamic import, so the first page does not carry Better Auth's client. Who is signed in comes from
// the API's own session answer (`useSession` in ../Session.atoms.ts), fetched once, not from this client.

/**
 * Better Auth's browser client: sign-up, sign-in, sign-out and organizations, at /api/auth on this origin. The session
 * is an HttpOnly cookie the browser sends with every request, so the API client needs nothing extra.
 */
export const authClient = createAuthClient({ plugins: [organizationClient()] })

/** A sentence for the person from a Better Auth error. Its messages are already written for people. */
export const authErrorMessage = (error: { message?: string | undefined; status: number }): string => {
  if (error.status === 429) return "Too many attempts. Wait a minute, then try again."
  return error.message ?? "Something went wrong. Try again."
}

/** Better Auth's answer as a value, or its error as a thrown `Error` with that sentence, for an atom's promise. */
export const orThrow = <A>(
  result: { data: A; error: null } | { data: null; error: { message?: string | undefined; status: number } }
): A => {
  if (result.error !== null) throw new Error(authErrorMessage(result.error))
  return result.data
}
