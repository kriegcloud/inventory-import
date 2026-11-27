// The usage model: each organization's model calls, forty a UTC day, back together at midnight UTC (decisions 25, 26,
// 27). One aggregate, the allowance, and the view a member's screen would follow. Nothing is hosted and nothing is
// stored: the old gateway keeps counting the `modelCall` table until the hosted half of move 2, and this model runs in
// memory under its stories and under Verify. The one thing not to break: a `sometimes` rule says only that one
// sequence gets there, so nothing here may be said to be proved of it.
import * as Domain from "@alchemy.run/domain"
import * as A from "effect/Array"
import { Allowance } from "./Allowance/Allowance.aggregate.ts"
import { AllowanceToday } from "./Allowance/AllowanceToday.view.ts"

/** The usage model: one allowance of model calls per organization, and its count for the day. */
export class Usage extends Domain.Model(
  "Usage",
  {
    aggregates: [Allowance],
    views: [AllowanceToday],
    sometimes: {
      ACallCanBeTaken: (all) => A.some(all.Allowance, (allowance) => A.isReadonlyArrayNonEmpty(allowance.events))
    }
  },
  { description: "Each organization's model calls: forty a UTC day, back together at midnight UTC" }
) {}
