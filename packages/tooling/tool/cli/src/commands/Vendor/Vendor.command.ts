/**
 * `vendor`: the kit packages copied from beep-effect, and the proof that they still are what was copied.
 *
 * @packageDocumentation
 */
import * as Effect from "effect/Effect"
import * as Command from "effect/cli/Command"
import * as Flag from "effect/cli/Flag"
import { emit } from "../../Report.schema.ts"
import { vendorCheck } from "./VendorCheck.rules.ts"

const source = Flag.Directory("source").pipe(
  Flag.withDescription("A beep-effect checkout: every recorded source hash is also compared with it"),
  Flag.optional
)

/** `vendor check`: every vendored file still matches its recorded hash. */
export const vendorCheckCommand = Command.make("check", { source }, (flags) =>
  Effect.flatMap(vendorCheck(flags.source), emit)
).pipe(Command.withDescription("Every vendored kit file still matches the hash recorded when it was copied"))

/** The `vendor` group. */
export const vendorCommand = Command.make("vendor").pipe(
  Command.withDescription("The kit packages vendored from beep-effect"),
  Command.withSubcommands([vendorCheckCommand])
)
