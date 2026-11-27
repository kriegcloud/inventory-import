// A tally whose rules are in a file of their own: one listed by name, one read through the file as a namespace.
import * as Domain from "@alchemy.run/domain"
import * as S from "effect/Schema"
import * as TallyRules from "./Tally.rules.ts"
import { ACountNeverFalls } from "./Tally.rules.ts"

/** One more was counted. */
export class Counted extends Domain.Event("Counted", { count: S.Int }) {}

/** Count one more. */
export class CountOne extends Domain.Command("CountOne", { input: { tallyId: S.String }, events: [Counted] }) {}

/** One tally. */
export class Tally extends Domain.Aggregate("Tally", {
  id: S.String,
  state: S.Struct({ count: S.Int }),
  initial: { count: 0 },
  invariants: { ACountIsNeverNegative: TallyRules.ACountIsNeverNegative },
  transitions: { ACountNeverFalls: ACountNeverFalls },
  commands: [CountOne],
  keyOf: (cmd) => cmd.tallyId,
  decide: { CountOne: (tally) => [Counted.make({ count: tally.count + 1 })] },
  evolve: { Counted: (_tally, event) => ({ count: event.count }) }
}) {}
