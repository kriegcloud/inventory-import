// The middleware in front of every command of the catalog's model: it finds who is signed in and provides them as
// `CurrentActor` (`Actor.context.ts`), or refuses with the kernel's `NotSignedIn`. The one thing not to break: no
// command of the model is taken without it, so a decide never runs for nobody.
import { NotSignedIn } from "@inventory/kernel/AccessError"
import * as RpcMiddleware from "effect/rpc/RpcMiddleware"
import { CurrentActor } from "./Actor.context.ts"

/**
 * The middleware every command of the model names: it provides `CurrentActor`, or fails with the kernel's
 * `NotSignedIn` when nobody is signed in, so no command of the model is taken.
 *
 * @category middleware
 * @since 0.0.0
 */
export class Session extends RpcMiddleware.Service<Session, { readonly provides: CurrentActor }>()(
  "@inventory/catalog-model/Actor/Session",
  { error: NotSignedIn }
) {}
