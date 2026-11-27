/** Commands for checking the tree and reading turbo's last failure summary. */
import * as Effect from "effect/Effect"
import * as Argument from "effect/cli/Argument"
import * as Command from "effect/cli/Command"
import { emit } from "../../Report.schema.ts"
import { checkSentence, checkSummary } from "./CheckSummary.rules.ts"
import { checkChanged } from "./CheckChanged.command.ts"
import { checkRun } from "./CheckRunner.ts"

export { checkRun } from "./CheckRunner.ts"

/** Shows the latest turbo record without starting another check. */
export const checkSummaryCommand = Command.make("summary", {}, () =>
  checkSummary().pipe(Effect.flatMap(emit(checkSentence)))
)
/** Accepts turbo's task names and flags after `--`. */
export const checkRunCommand = Command.make(
  "run",
  { args: Argument.String("args").pipe(Argument.variadic()) },
  ({ args }) => checkRun(args)
)
/** Checks changed packages and their dependents, with only the changed packages' own tests. */
export const checkChangedCommand = Command.make(
  "changed",
  { args: Argument.String("args").pipe(Argument.variadic()) },
  ({ args }) => checkChanged(args)
)
/** The commands for running a check or reading its last summary. */
export const checkCommand = Command.make("check").pipe(
  Command.withSubcommands([checkSummaryCommand, checkRunCommand, checkChangedCommand])
)
