// What is left of the day's calls, as the server and a screen will read it from `AllowanceToday`: forty less what the
// state's day took when that day is today, and all forty on any other day, so after midnight UTC the count reads full
// before anyone takes a call. And the day number `dayOf` gives is the one the allowance counts against.
import { Story } from "@alchemy.run/domain/Story"
import { describe, expect, it } from "@effect/vitest"
import * as A from "effect/Array"
import * as DateTime from "effect/DateTime"
import { CurrentActor } from "../src/Actor/Actor.context.ts"
import { dailyModelCalls } from "@inventory/usage-contract/ModelCall"
import { Allowance, CallTaken, TakeCall } from "../src/Allowance/Allowance.aggregate.ts"
import { dayOf, leftOn } from "../src/Allowance/AllowanceLeft.rules.ts"
import { AllowanceTodayLive } from "../src/Allowance/AllowanceToday.view.ts"
import { Usage } from "../src/Usage.model.ts"

const lastMinute = DateTime.makeUnsafe("2026-11-26T23:59:59.999Z")
const midnight = DateTime.makeUnsafe("2026-11-27T00:00:00.000Z")
const thursday = dayOf(lastMinute)

describe("leftOn", () => {
  it("is forty less what today took, for every count from none to one past the limit", () => {
    const left = A.map(A.range(0, dailyModelCalls + 1), (taken) => leftOn({ day: thursday, taken }, thursday))
    expect(left).toEqual([...A.reverse(A.range(0, dailyModelCalls)), 0])
  })

  it("reads all forty on the day after, though the state still holds the day before's forty", () => {
    expect(dayOf(midnight)).toBe(thursday + 1)
    expect(leftOn({ day: thursday, taken: dailyModelCalls }, dayOf(lastMinute))).toBe(0)
    expect(leftOn({ day: thursday, taken: dailyModelCalls }, dayOf(midnight))).toBe(dailyModelCalls)
  })

  it("reads all forty for an allowance that has taken no call", () => {
    expect(leftOn({ day: 0, taken: 0 }, thursday)).toBe(dailyModelCalls)
  })

  // The view's day comes from the host that took the call and `today` from the reader's clock, so right at midnight
  // the state can hold a day later than the reader's. `decide` counts a clock behind against the stored day, and so
  // does this: what the later day took, never a full day.
  it("counts a state one day ahead of the reader's clock against that day, as decide does", () => {
    expect(leftOn({ day: thursday + 1, taken: dailyModelCalls }, thursday)).toBe(0)
    expect(leftOn({ day: thursday + 1, taken: 1 }, thursday)).toBe(dailyModelCalls - 1)
  })

  it("is the same data-first and in a pipe", () => {
    expect(leftOn(thursday)({ day: thursday, taken: 3 })).toBe(leftOn({ day: thursday, taken: 3 }, thursday))
  })
})

describe("dayOf", () => {
  // The aggregate works the day out itself (the prover reads its own code); this holds the two to one number.
  it.effect("names the day the allowance counts a call against, on either side of midnight UTC", () =>
    Story.make(Usage, { layer: AllowanceTodayLive })(
      Story.provide(CurrentActor, { organizationId: "org_prairie", memberId: "ana", role: "editor" }),
      Story.clock(DateTime.toEpochMillis(lastMinute)),
      Story.when(TakeCall.make({ organizationId: "org_prairie", purpose: "view" })),
      Story.then(
        Allowance.ref("org_prairie"),
        CallTaken.make({ organizationId: "org_prairie", day: dayOf(lastMinute), by: "ana", purpose: "view" })
      ),
      Story.clock(DateTime.toEpochMillis(midnight)),
      Story.when(TakeCall.make({ organizationId: "org_prairie", purpose: "view" })),
      Story.then(
        Allowance.ref("org_prairie"),
        CallTaken.make({ organizationId: "org_prairie", day: dayOf(midnight), by: "ana", purpose: "view" })
      )
    )
  )
})
