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
import { vendorSync } from "./VendorSync.rules.ts"

const source = Flag.Directory("source").pipe(
  Flag.withDescription("A beep-effect checkout: every recorded source hash is also compared with it"),
  Flag.optional
)

/** `vendor check`: every vendored file still matches its recorded hash. */
export const vendorCheckCommand = Command.make("check", { source }, (flags) =>
  Effect.flatMap(vendorCheck(flags.source), emit)
).pipe(Command.withDescription("Every vendored kit file still matches the hash recorded when it was copied"))

const from = Flag.Directory("from").pipe(Flag.withDescription("The beep-effect checkout to copy from"))
const commit = Flag.String("commit").pipe(
  Flag.withDescription("The commit to copy at; the checkout's HEAD when not given"),
  Flag.optional
)

/** `vendor sync --from <checkout> [--commit <sha>]`: copies the used subset of the kit and records its hashes. */
export const vendorSyncCommand = Command.make("sync", { from, commit }, (flags) =>
  Effect.flatMap(vendorSync(flags.from, flags.commit), emit)
).pipe(Command.withDescription("Copy the used subset of beep-effect's kit packages from one commit, and record it"))

/** The `vendor` group. */
export const vendorCommand = Command.make("vendor").pipe(
  Command.withDescription("The kit packages vendored from beep-effect"),
  Command.withSubcommands([vendorCheckCommand, vendorSyncCommand])
)
