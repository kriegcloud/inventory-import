/**
 * The four refusals every part of the API shares: nobody is signed in, the role is too low, a write came from
 * another site, or one address asked too often.
 *
 * @packageDocumentation
 */
import * as S from "effect/Schema"
import { $KernelId } from "./internal/identity.ts"
import { Role } from "./Role.schema.ts"
import { Sentence } from "./Text.schema.ts"

const $I = $KernelId.create("AccessError")

/**
 * No member could be resolved for this request. The reason says what to do, without echoing what was sent.
 *
 * @category errors
 */
export class NotSignedIn extends S.TaggedError<NotSignedIn, { readonly brand: unique symbol }>($I`NotSignedIn`)(
  "NotSignedIn",
  { reason: Sentence.pipe(S.annotateKey({ description: "What to do next, in words for the person." })) },
  $I.annoteError<NotSignedIn>("NotSignedIn", {
    description: "The request has no session, or its person is in no organization yet.",
    httpApiStatus: 401
  })
) {}

/**
 * The member is known but their role is too low for this action. `required` is the role that would be allowed.
 *
 * @category errors
 */
export class Forbidden extends S.TaggedError<Forbidden, { readonly brand: unique symbol }>($I`Forbidden`)(
  "Forbidden",
  {
    reason: Sentence.pipe(
      S.annotateKey({ description: "Which role the person has and which one this needs. It never names the person." })
    ),
    required: Role.pipe(S.annotateKey({ description: "The lowest role that may do this." }))
  },
  $I.annoteError<Forbidden>("Forbidden", {
    description: "The member's role is too low for this action.",
    httpApiStatus: 403
  })
) {}

/**
 * A write that a page on another site asked the browser to send. Refused before identity is read, so it never acts
 * as anyone. The reason says what to do instead.
 *
 * @category errors
 */
export class CrossSiteRequest extends S.TaggedError<CrossSiteRequest, { readonly brand: unique symbol }>(
  $I`CrossSiteRequest`
)(
  "CrossSiteRequest",
  { reason: Sentence.pipe(S.annotateKey({ description: "What happened and what to do, in words for the person." })) },
  $I.annoteError<CrossSiteRequest>("CrossSiteRequest", {
    description: "A write that did not come from this app's own pages.",
    httpApiStatus: 403
  })
) {}

/**
 * One address sent more sign-ins, sign-ups and model requests in a minute than the coarse limit lets through.
 * Refused before sign-in or the model is reached; the exact limits behind it (Better Auth's, the day's model calls)
 * were not touched. The reason says how long to wait.
 *
 * @category errors
 */
export class TooManyRequests extends S.TaggedError<TooManyRequests, { readonly brand: unique symbol }>(
  $I`TooManyRequests`
)(
  "TooManyRequests",
  {
    reason: Sentence.pipe(
      S.annotateKey({ description: "What happened and how long to wait, in words for the person." })
    )
  },
  $I.annoteError<TooManyRequests>("TooManyRequests", {
    description: "One address asked too often within a minute.",
    httpApiStatus: 429
  })
) {}
