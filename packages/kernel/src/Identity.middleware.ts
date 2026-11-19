/**
 * The single seam for identity: the middleware that resolves the acting member and provides `CurrentActor` to every
 * endpoint it is attached to. The app chooses its implementation (the session cookie in the Worker, a header in
 * tests); handlers do not know which one is in place.
 *
 * @packageDocumentation
 */
import { HttpApiMiddleware } from "effect/http-api"
import { NotSignedIn } from "./AccessError.errors.ts"
import { CurrentActor } from "./Actor.context.ts"
import { $KernelId } from "./internal/identity.ts"

const $I = $KernelId.create("Identity")

/**
 * Resolves the acting member and provides `CurrentActor`, or fails with `NotSignedIn` (401).
 *
 * @category middleware
 */
export class Identity extends HttpApiMiddleware.Service<Identity, { provides: CurrentActor; requires: never }>()(
  $I`Identity`,
  { error: NotSignedIn }
) {}
