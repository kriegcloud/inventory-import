// What is left of an organization's day of model calls, worked out once from `AllowanceToday`'s state and today's UTC
// day number, so the server and a screen read the same number. Not on the view: the view moves only when a call is
// taken, so a state from an earlier day says nothing of today, and its `computed` sees no clock. The one thing not to
// break: a state of an earlier day is a full day left, never what that day left; a state of a later day (the host's
// clock ahead of the reader's, right at midnight) is what that day left, as `decide` counts it.
import * as DateTime from "effect/DateTime"
import { dual } from "effect/Function"
import { dailyModelCalls } from "@inventory/usage-contract/ModelCall"
import { dayMs } from "./Allowance.aggregate.ts"
import type { AllowanceTodayState } from "./AllowanceToday.view.ts"

/** The UTC day a time falls on, as whole days since 1970-01-01: the number the allowance counts against. */
export const dayOf = (at: DateTime.DateTime): number => Math.floor(DateTime.toEpochMillis(at) / dayMs)

/**
 * How many of the day's calls are left on `today` (a day number from `dayOf`): all of them when the state's day is
 * earlier than today, what the state's day left when it is today or later, and none below zero.
 */
export const leftOn: {
  (today: number): (state: AllowanceTodayState) => number
  (state: AllowanceTodayState, today: number): number
} = dual(2, (state: AllowanceTodayState, today: number): number =>
  state.day >= today ? Math.max(0, dailyModelCalls - state.taken) : dailyModelCalls
)
