import * as S from "effect/Schema"
import { HttpApiMiddleware } from "effect/http-api"

/**
 * A write that a page on another site asked the browser to send. Refused before identity is read, so it never acts
 * as anyone. The reason says what to do instead.
 */
export class CrossSiteRequest extends S.TaggedError<CrossSiteRequest, { readonly brand: unique symbol }>()(
  "CrossSiteRequest",
  {
    reason: S.String.annotate({ description: "What happened and what to do, in words for the person." })
  },
  { httpApiStatus: 403, description: "A write that did not come from this app's own pages." }
) {}

/**
 * Takes a write only when the browser says it came from this app's own pages (`Sec-Fetch-Site`, or `Origin` from a
 * browser too old to send it). Applied to the whole API, so every write is covered whichever identity is in place:
 * the header switcher here, a session cookie once sign-in is added.
 */
export class SameOrigin extends HttpApiMiddleware.Service<SameOrigin>()("@inventory/app/api/v1/Security/SameOrigin", {
  error: CrossSiteRequest
}) {}
