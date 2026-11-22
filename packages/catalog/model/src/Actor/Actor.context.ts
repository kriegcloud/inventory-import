// Who is asking, as the catalog's model reads it: the organization, the member and the role, carried with every
// command to wherever its aggregate runs. The model declares its own (the prover reads a request context only through
// a relative path); the kernel's `CurrentActor` stays for `/api/v1`, and one session lookup will fill both. The one
// thing not to break: a decide reads who acts from here and never from a command, so no sender can say who they are.
import * as Domain from "@alchemy.run/domain"
import { NotSignedIn } from "@inventory/kernel/AccessError"
import { Role } from "@inventory/kernel/Role"
import * as RpcMiddleware from "effect/rpc/RpcMiddleware"
import * as S from "effect/Schema"

/** The text of a kernel id: at most 64 characters, as the kernel bounds it. */
const IdText = S.String.check(S.isMaxLength(64))

/**
 * The person a command acts as. The ids are the texts of the kernel's `OrganizationId` and `MemberId`: the model
 * compares them and never reads inside them.
 */
export const Actor = S.Struct({
  organizationId: IdText.pipe(S.annotateKey({ description: "The organization the person acts in" })),
  memberId: IdText.pipe(S.annotateKey({ description: "Who this is: people are told apart by this id" })),
  role: Role.pipe(S.annotateKey({ description: "What they may do there: a viewer changes nothing" }))
}).annotate({ description: "The person a command of the catalog's model acts as" })
/** The decoded value of `Actor`. */
export type Actor = typeof Actor.Type

/** The person asking, provided around every command by the session, and in a story by `Story.provide`. */
export class CurrentActor extends Domain.RequestContext<CurrentActor>()(
  "@inventory/catalog-model/Actor/CurrentActor",
  Actor
) {}

/**
 * The middleware every command of the model names: it provides `CurrentActor`, or fails with the kernel's
 * `NotSignedIn` when nobody is signed in, so no command of the model is taken.
 */
export class Session extends RpcMiddleware.Service<Session, { provides: CurrentActor }>()(
  "@inventory/catalog-model/Actor/Session",
  { error: NotSignedIn }
) {}
