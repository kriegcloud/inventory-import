/**
 * The single seam for identity: the middleware that resolves the acting member and provides `CurrentActor` to every
 * endpoint it is attached to. The app chooses its implementation (the session cookie in the Worker, a header in
 * tests); handlers do not know which one is in place.
 *
 * @packageDocumentation
 */
import * as HttpApiMiddleware from "effect/http-api/HttpApiMiddleware"
import { NotSignedIn } from "./AccessError.errors.ts"
import { CurrentActor } from "./Actor.context.ts"
import { $KernelId } from "./internal/identity.ts"

const $I = $KernelId.create("Identity")

/**
 * Resolves the acting member and provides `CurrentActor`, or fails with `NotSignedIn` (401).
 *
 * @category middleware
 */
export class Identity extends HttpApiMiddleware.Service<
  Identity,
  { readonly provides: CurrentActor; readonly requires: never }
>()($I`Identity`, { error: NotSignedIn }) {}
