// The session the Api tests run behind: the server half of `Session`, which in a test reads who is signed in from one
// header naming a person below, and refuses a call with none or with a name it does not know. The hosted half is the
// kernel's session port, implemented once in the access context's host (Benjamin, 2026-11-26, "A port in the kernel").
// And the usage model in memory, with its view's `validate`.
import * as Domain from "@alchemy.run/domain"
import { NotSignedIn } from "@inventory/kernel/AccessError"
import * as Effect from "effect/Effect"
import * as HashMap from "effect/HashMap"
import * as Headers from "effect/http/Headers"
import * as Layer from "effect/Layer"
import * as O from "effect/Option"
import { type Actor, CurrentActor } from "../src/Actor/Actor.context.ts"
import { Session } from "../src/Actor/Session.middleware.ts"
import { AllowanceTodayLive } from "../src/Allowance/AllowanceToday.view.ts"
import { Usage } from "../src/Usage.model.ts"

/** Three people: an editor and a viewer of one organization, and an admin of another. */
export const ana: Actor = { organizationId: "org_prairie", memberId: "ana", role: "editor" }
export const vic: Actor = { organizationId: "org_prairie", memberId: "vic", role: "viewer" }
export const hal: Actor = { organizationId: "org_harbor", memberId: "hal", role: "admin" }

const people = HashMap.make(["ana", ana], ["vic", vic], ["hal", hal])

/** The header a test call names its person in. */
const header = "x-test-person"

/** The headers of a call made as `actor`. */
export const as = (actor: Actor) => ({ headers: { [header]: actor.memberId } })

/** `Session` as the tests run it: the person the header names, or `NotSignedIn`. */
export const SessionTest = Layer.succeed(Session, (effect, { headers }) =>
  O.match(
    O.flatMap(Headers.get(headers, header), (name) => HashMap.get(people, name)),
    {
      onNone: () => Effect.fail(NotSignedIn.make({ reason: "The test names no person of this model." })),
      onSome: (actor) => Effect.provideService(effect, CurrentActor, actor)
    }
  )
)

/** The usage model in memory, its view's `validate` given, and the test session in front of it. */
export const UsageTest = SessionTest.pipe(
  Layer.provideMerge(Usage.layer(AllowanceTodayLive).pipe(Layer.provide(Domain.InMemory)))
)
