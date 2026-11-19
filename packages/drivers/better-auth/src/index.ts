/**
 * Better Auth as an Effect service: built once from the host's options, its HTTP handler mounted on the router, and a
 * typed session lookup. The test stand-ins are their own subpath, `@beep/better-auth/BetterAuthTest`.
 *
 * @packageDocumentation
 */
export { BetterAuthSettings } from "./BetterAuth.config.ts"
export {
  BetterAuthConfigError,
  BetterAuthConfigProblem,
  BetterAuthError,
  BetterAuthOperation
} from "./BetterAuth.errors.ts"
export {
  AuthEmail,
  AuthEndpoint,
  authEndpointOf,
  AuthOrganizationId,
  AuthSecret,
  AuthSession,
  AuthSessionAnswer,
  AuthUserId,
  resolveAuthSecret
} from "./BetterAuth.schema.ts"
export { BetterAuth, type ResolvedAuth } from "./BetterAuth.service.ts"
