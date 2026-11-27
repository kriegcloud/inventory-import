// The allowance's days as stories on the model in memory, every call sent as a command with the story's clock set:
// forty calls in a UTC day, the forty-first refused and nothing recorded, the count back at 1 on the first call after
// midnight UTC (decision 25), a second organization's own count, a viewer taking only the table assistant's call, and
// a member of another organization refused, the role asked before the organization. Each story reads `AllowanceToday` too, the count a member's screen would
// follow. The one thing not to break: a story fails on a rejection no `rejected` names and on an event no `then`
// names, so a refused take is shown to record nothing.
import { Story } from "@alchemy.run/domain/Story"
import { it } from "@effect/vitest"
import * as A from "effect/Array"
import * as DateTime from "effect/DateTime"
import { type Actor, CurrentActor } from "../src/Actor/Actor.context.ts"
import type { ModelCallPurpose } from "@inventory/usage-contract/ModelCall"
import {
  Allowance,
  CallTaken,
  DayUsedUp,
  NotPermitted,
  AllowanceNotFound,
  TakeCall
} from "../src/Allowance/Allowance.aggregate.ts"
import { dayOf } from "../src/Allowance/AllowanceLeft.rules.ts"
import { AllowanceToday } from "../src/Allowance/AllowanceToday.view.ts"
import { AllowanceTodayAnyone } from "./session.ts"
import { Usage } from "../src/Usage.model.ts"

const story = Story.make(Usage, { layer: AllowanceTodayAnyone })

const prairie = Allowance.ref("org_prairie")
const harbor = Allowance.ref("org_harbor")
const ana: Actor = { organizationId: "org_prairie", memberId: "ana", role: "editor" }
const vic: Actor = { organizationId: "org_prairie", memberId: "vic", role: "viewer" }
const hal: Actor = { organizationId: "org_harbor", memberId: "hal", role: "admin" }

// Thursday morning, and the same day's last minute: one UTC day.
const morning = "2026-11-26T09:00:00.000Z"
const thursday = dayOf(DateTime.makeUnsafe(morning))
const friday = thursday + 1

/** `n` calls by `by` for `purpose`, each accepted and counted against `day`. */
const calls = (n: number, by: Actor, day: number, purpose: ModelCallPurpose) =>
  A.flatten(
    A.makeBy(n, () => [
      Story.when(TakeCall.make({ organizationId: by.organizationId, purpose })),
      Story.then(
        Allowance.ref(by.organizationId),
        CallTaken.make({ organizationId: by.organizationId, day, by: by.memberId, purpose })
      )
    ])
  )

it.effect("a call is taken: it counts one against today and keeps who asked and for what", () =>
  story(
    Story.provide(CurrentActor, ana),
    Story.clock(morning),
    Story.when(TakeCall.make({ organizationId: "org_prairie", purpose: "check" })),
    Story.then(prairie, CallTaken.make({ organizationId: "org_prairie", day: thursday, by: "ana", purpose: "check" })),
    Story.state(prairie, { status: "Counting", organizationId: "org_prairie", day: thursday, taken: 1 }),
    Story.view(AllowanceToday, prairie, { day: thursday, taken: 1 })
  )
)

it.effect("forty calls are taken in a day, and the forty-first is refused DayUsedUp and records nothing", () =>
  story(
    Story.provide(CurrentActor, ana),
    Story.clock(morning),
    ...calls(40, ana, thursday, "suggest"),
    Story.state(prairie, { day: thursday, taken: 40 }),
    // The day's last minute is still the same day.
    Story.clock("2026-11-26T23:59:00.000Z"),
    Story.when(TakeCall.make({ organizationId: "org_prairie", purpose: "suggest" })),
    Story.rejected(DayUsedUp.make({ day: thursday })),
    Story.then(prairie),
    Story.state(prairie, { day: thursday, taken: 40 }),
    Story.view(AllowanceToday, prairie, { day: thursday, taken: 40 })
  )
)

it.effect("past midnight UTC the next call names the new day and counts 1, with no command to start the day", () =>
  story(
    Story.provide(CurrentActor, ana),
    Story.clock(morning),
    ...calls(40, ana, thursday, "suggest"),
    // 09:00 plus fifteen hours is 00:00 on Friday.
    Story.advance("15 hours"),
    ...calls(1, ana, friday, "view"),
    Story.state(prairie, { day: friday, taken: 1 }),
    Story.view(AllowanceToday, prairie, { day: friday, taken: 1 })
  )
)

it.effect(
  "a second organization takes its own first call while the first's day is used, and the first's is untouched",
  () =>
    story(
      Story.provide(CurrentActor, ana),
      Story.clock(morning),
      ...calls(40, ana, thursday, "suggest"),
      Story.provide(CurrentActor, hal),
      ...calls(1, hal, thursday, "view"),
      Story.state(harbor, { organizationId: "org_harbor", day: thursday, taken: 1 }),
      Story.state(prairie, { organizationId: "org_prairie", day: thursday, taken: 40 }),
      Story.view(AllowanceToday, harbor, { day: thursday, taken: 1 }),
      Story.view(AllowanceToday, prairie, { day: thursday, taken: 40 })
    )
)

it.effect("a viewer is refused the check's and the suggestions' call, and takes the table assistant's", () =>
  story(
    Story.provide(CurrentActor, vic),
    Story.clock(morning),
    Story.when(TakeCall.make({ organizationId: "org_prairie", purpose: "check" })),
    Story.rejected(NotPermitted.make({ required: "editor" })),
    Story.when(TakeCall.make({ organizationId: "org_prairie", purpose: "suggest" })),
    Story.rejected(NotPermitted.make({ required: "editor" })),
    Story.then(prairie),
    ...calls(1, vic, thursday, "view"),
    Story.view(AllowanceToday, prairie, { day: thursday, taken: 1 })
  )
)

it.effect("a member of another organization is refused a call from this one, and nothing is counted", () =>
  story(
    Story.provide(CurrentActor, hal),
    Story.clock(morning),
    Story.when(TakeCall.make({ organizationId: "org_prairie", purpose: "view" })),
    Story.rejected(AllowanceNotFound.make({})),
    Story.then(prairie),
    Story.state(prairie, { status: "Fresh" }),
    Story.view(AllowanceToday, prairie, Story.none)
  )
)

it.effect(
  "a viewer of another organization asking for the check's call is told the role first, as the catalog asks",
  () =>
    story(
      Story.provide(CurrentActor, { organizationId: "org_harbor", memberId: "wes", role: "viewer" }),
      Story.clock(morning),
      Story.when(TakeCall.make({ organizationId: "org_prairie", purpose: "check" })),
      Story.rejected(NotPermitted.make({ required: "editor" })),
      Story.then(prairie),
      Story.state(prairie, { status: "Fresh" }),
      Story.view(AllowanceToday, prairie, Story.none)
    )
)
