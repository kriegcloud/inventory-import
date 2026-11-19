/**
 * How Better Auth can fail through this driver: a call into it failed, or the settings cannot sign sessions safely.
 *
 * @packageDocumentation
 */
import * as S from "effect/Schema"
import { $BetterAuthId } from "./internal/identity.ts"

const $I = $BetterAuthId.create("BetterAuthError")

/**
 * A call into Better Auth threw or rejected. `operation` names which; `cause` keeps what it threw, for the log. A host
 * ends it as a server error: nothing a person sent can cause it.
 *
 * @category errors
 */
export class BetterAuthError extends S.TaggedError<BetterAuthError, { readonly brand: unique symbol }>(
  $I`BetterAuthError`
)(
  "BetterAuthError",
  {
    operation: S.Literals(["handle", "session"]).pipe(
      S.annotateKey({ description: "Answering an /api/auth request, or looking a session up" })
    ),
    cause: S.Defect().pipe(S.annotateKey({ description: "What Better Auth threw or rejected with" }))
  },
  $I.annoteError<BetterAuthError>("BetterAuthError", { description: "A call into Better Auth failed" })
) {}

/**
 * The settings cannot sign sessions safely: in production the secret is missing or shorter than 32 characters.
 * Sessions signed with a guessable key could be forged, so the service does not start.
 *
 * @category errors
 */
export class BetterAuthConfigError extends S.TaggedError<BetterAuthConfigError, { readonly brand: unique symbol }>(
  $I`BetterAuthConfigError`
)(
  "BetterAuthConfigError",
  {
    problem: S.Literals(["missingSecret", "shortSecret"]).pipe(
      S.annotateKey({ description: "The secret is not set, or is shorter than 32 characters" })
    )
  },
  $I.annoteError<BetterAuthConfigError>("BetterAuthConfigError", {
    description: "The sign-in secret is missing or too short in production"
  })
) {
  /** What is wrong and how to fix it, in one sentence for whoever deploys. */
  override get message(): string {
    return (
      `BETTER_AUTH_SECRET is ${this.problem === "missingSecret" ? "not set" : "shorter than 32 characters"}. ` +
      "Set it with `wrangler secret put BETTER_AUTH_SECRET` (a value from `openssl rand -base64 32`)."
    )
  }
}
