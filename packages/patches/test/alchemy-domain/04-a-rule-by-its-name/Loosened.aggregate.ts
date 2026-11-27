// The same tally with its invariant saying less where it is declared, under the lock the first was kept in.
import * as Domain from "@alchemy.run/domain"
import * as S from "effect/Schema"
import * as TallyRules from "./Tally.rules.ts"
import { ACountNeverFalls } from "./Tally.rules.ts"

/** One more was counted. */
export class Loosed extends Domain.Event("Loosed", { count: S.Int }) {}

/** Count one more. */
export class LooseOne extends Domain.Command("LooseOne", { input: { tallyId: S.String }, events: [Loosed] }) {}

/** One tally. */
export class Loosened extends Domain.Aggregate("Loosened", {
  id: S.String,
  state: S.Struct({ count: S.Int }),
  initial: { count: 0 },
  invariants: { ACountIsNeverNegative: TallyRules.ACountIsNeverBelowMinusOne },
  transitions: { ACountNeverFalls: ACountNeverFalls },
  commands: [LooseOne],
  keyOf: (cmd) => cmd.tallyId,
  decide: { LooseOne: (tally) => [Loosed.make({ count: tally.count + 1 })] },
  evolve: { Loosed: (_tally, event) => ({ count: event.count }) }
}) {}
