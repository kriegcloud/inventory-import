// The middleware in front of every command and read of the usage model: it finds who is signed in and provides them
// as `CurrentActor` (`Actor.context.ts`), or refuses with the kernel's `NotSignedIn`. Its server half is the host's
// (the one session lookup of the kernel's port, at the hosted half of move 2); a test gives its own. The one thing not
// to break: no command and no read of the model is served without it, so a decide or a `validate` never runs for
// nobody.
import { NotSignedIn } from "@inventory/kernel/AccessError"
import * as RpcMiddleware from "effect/rpc/RpcMiddleware"
import { CurrentActor } from "./Actor.context.ts"

/**
 * The middleware every command and guarded read of the model names: it provides `CurrentActor`, or fails with the
 * kernel's `NotSignedIn` when nobody is signed in, so nothing is taken or read.
 */
export class Session extends RpcMiddleware.Service<Session, { readonly provides: CurrentActor }>()(
  "@inventory/usage-model/Actor/Session",
  { error: NotSignedIn }
) {}
