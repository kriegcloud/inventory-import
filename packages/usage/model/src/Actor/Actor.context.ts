// Who is asking, as the usage model reads it: the organization, the member and the role, carried with every command
// to wherever its aggregate runs. The model declares its own, as the catalog's does (the prover reads a request
// context only through a relative path); the kernel's `CurrentActor` stays for `/api/v1`, and one session lookup will
// fill both (decision of 2026-11-26, "A port in the kernel"). The middleware that provides it is `Session`
// (`Session.middleware.ts`). The one thing not to break: a decide and a view's `validate` read who acts from here and
// never from a command or a key, so no sender can say who they are.
import * as Domain from "@alchemy.run/domain"
import { Role } from "@inventory/kernel/Role"
import * as S from "effect/Schema"
import { IdText } from "./Id.schema.ts"

/**
 * The person a command or a read acts as. The ids are the texts of the kernel's `OrganizationId` and `MemberId`: the
 * model compares them and never reads inside them.
 */
export const Actor = S.Struct({
  organizationId: IdText.pipe(S.annotateKey({ description: "The organization the person acts in" })),
  memberId: IdText.pipe(S.annotateKey({ description: "Who this is: people are told apart by this id" })),
  role: Role.pipe(S.annotateKey({ description: "What they may do there: a viewer takes only the assistant's call" }))
}).annotate({ description: "The person a command or a read of the usage model acts as" })
/** The decoded value of `Actor`. */
export type Actor = typeof Actor.Type

/** The person asking, provided around every command and read by the session, and in a story by `Story.provide`. */
export class CurrentActor extends Domain.RequestContext<CurrentActor>()(
  "@inventory/usage-model/Actor/CurrentActor",
  Actor
) {}
