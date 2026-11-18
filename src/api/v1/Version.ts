// Where version 1 of the API lives, in a module with no imports: the first page (the sign-in screen and what decides
// whether to draw it) needs the addresses before it needs the contract, and importing Api.ts there would bring the
// whole contract and Effect's HTTP code into the first download. Sign-in stays at /api/auth (Better Auth's own
// contract) and the browser's telemetry at /api/otlp: neither is this API's to version.

/** The path every endpoint of this version of the API starts with. */
export const apiPrefix = "/api/v1"

/** Where the browser asks who is signed in (`IdentityApi`'s `session` endpoint, `SessionState`). */
export const sessionPath = `${apiPrefix}/identity/session`
