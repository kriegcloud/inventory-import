import { Effect, Layer, Option } from "effect"
import * as S from "effect/Schema"
import { HttpServerRequest } from "effect/http"
import { actingAsHeader } from "@inventory/access-contract/Access"
import { NotSignedIn } from "@inventory/kernel/AccessError"
import { CurrentActor } from "@inventory/kernel/Actor"
import { Identity } from "@inventory/kernel/Identity"
import { MemberId } from "@inventory/kernel/Ids"
import { Members } from "./Members.ts"

// TEST IDENTITY. There are no credentials: the `x-acting-as` header names a member, and a request without it acts
// as `defaultMemberId`. Handler and database tests use it to run as a fixed actor. The Worker does not: `worker.ts`
// passes `SessionIdentityLive` (SessionIdentity.ts), which reads the session cookie, `bun run build` checks this
// layer is not in the Worker bundle (scripts/check-production-identity.mjs), and test/server/Auth.slow.test.ts
// checks the header changes nothing there.
//
// `requireRole` (@inventory/kernel/Actor) is shared by both: role checks run on the server whichever identity is in place.

/** Who a request without the header acts as in a test. */
const defaultMemberId = "mem_dana"

/**
 * The test implementation of the `Identity` middleware: resolves the member named by the header. Marked pure, so a
 * production bundle, which never provides it, leaves it out. Every span and log line inside the request carries the
 * actor's and organization's ids (never a name), as with the session identity.
 */
export const IdentityLive = /* @__PURE__ */ Layer.effect(
  Identity,
  /* @__PURE__ */ Effect.gen(function* () {
    const members = yield* Members
    return Identity.of(
      Effect.fn("Identity")(function* (httpEffect) {
        const request = yield* HttpServerRequest.HttpServerRequest
        const header = request.headers[actingAsHeader]
        const id = yield* S.decodeEffect(MemberId)(header ?? defaultMemberId).pipe(Effect.option)
        const member = Option.isSome(id) ? yield* members.findById(id.value) : Option.none()
        if (Option.isNone(member)) {
          // The header's value is not echoed: what a request sent is not repeated to the screen or the log.
          return yield* NotSignedIn.make({ reason: "The test identity names no member of this app." })
        }
        const who = {
          "actor.id": member.value.id,
          "actor.role": member.value.role,
          "organization.id": member.value.organizationId
        }
        yield* Effect.annotateCurrentSpan(who)
        return yield* httpEffect.pipe(
          Effect.provideService(CurrentActor, member.value),
          Effect.annotateSpans(who),
          Effect.annotateLogs(who)
        )
      })
    )
  })
)
