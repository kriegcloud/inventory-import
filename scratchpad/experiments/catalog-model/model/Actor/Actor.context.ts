// Who is asking, as the catalog's model reads it: the organization, the member and the role, carried with every
// command to wherever its aggregate runs. The model declares its own (the prover reads a request context only through
// a relative path); the kernel's `CurrentActor` stays for `/api/v1`, and one session lookup will fill both. The
// middleware that provides it is `Session` (`Session.middleware.ts`). The one thing not to break: a decide reads who
// acts from here and never from a command, so no sender can say who they are.
import * as Domain from "@alchemy.run/domain"
import { Role } from "@inventory/kernel/Role"
import * as S from "effect/Schema"

/** The text of a kernel id: at most 64 characters, as the kernel bounds it. */
const IdText = S.String.check(S.isMaxLength(64))

/**
 * **Details**
 *
 * The ids are the texts of the kernel's `OrganizationId` and `MemberId`, at most 64 characters each: the model compares
 * them and never reads inside them.
 *
 * @category context
 * @since 0.0.0
 */
export class Actor extends S.Opaque<Actor, { readonly brand: unique symbol }>()(
  S.Struct({
    organizationId: IdText.pipe(S.annotateKey({ description: "The organization the person acts in" })),
    memberId: IdText.pipe(S.annotateKey({ description: "Who this is: people are told apart by this id" })),
    role: Role.pipe(S.annotateKey({ description: "What they may do there: a viewer changes nothing" }))
  }).annotate({ description: "The person a command of the catalog's model acts as" })
) {}

/**
 * The person asking, provided around every command by the session, and in a story by `Story.provide`. A decide and a
 * rule that asks who acts read it here, never from the command.
 *
 * @category context
 * @since 0.0.0
 */
export class CurrentActor extends Domain.RequestContext<CurrentActor>()(
  "@inventory/catalog-model/Actor/CurrentActor",
  Actor
) {}
