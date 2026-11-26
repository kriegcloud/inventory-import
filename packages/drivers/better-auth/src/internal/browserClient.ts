// Better Auth's own browser client. Imported only dynamically (BetterAuthClient.service.ts), so a page that never
// signs in, switches or signs out does not download it.
import { createAuthClient } from "better-auth/client"
import { organizationClient } from "better-auth/client/plugins"

/** What the client is made with: nothing in the browser; a test names an address and a fetch of its own. */
type ClientOptions = Pick<NonNullable<Parameters<typeof createAuthClient>[0]>, "baseURL" | "fetchOptions">

/** Better Auth's client with the organization plugin, at /api/auth on the page's own origin unless told otherwise. */
export const makeBrowserClient = (options: ClientOptions) =>
  createAuthClient({ ...options, plugins: [organizationClient()] })

/** Better Auth's client as this driver uses it. */
export type BrowserClient = ReturnType<typeof makeBrowserClient>

/** The one client of a page. The session is an HttpOnly cookie the browser sends, so it holds no secret. */
export const browserClient: BrowserClient = makeBrowserClient({})
