/**
 * `version-sync`: every version and date written in more than one place, held equal to its one source.
 *
 * @packageDocumentation
 */
import * as Effect from "effect/Effect"
import * as Command from "effect/cli/Command"
import * as Flag from "effect/cli/Flag"
import { emit } from "../../Report.schema.ts"
import { modeOf, syncSentence } from "../../Sync.schema.ts"
import { versionSync } from "./VersionSync.rules.ts"

const write = Flag.Boolean("write").pipe(
  Flag.withDescription("Rewrite every place that differs from its source"),
  Flag.withDefault(false)
)
const dryRun = Flag.Boolean("dry-run").pipe(
  Flag.withDescription("Say what --write would rewrite, and write nothing"),
  Flag.withDefault(false)
)

/** `version-sync [--write | --dry-run]`: names every place that differs from its source, or rewrites it. */
export const versionSyncCommand = Command.make("version-sync", { write, dryRun }, (flags) =>
  Effect.flatMap(versionSync(modeOf(flags)), emit(syncSentence))
).pipe(
  Command.withDescription(
    "Every version and date written in more than one place equals its one source: bun, Node, Effect, the tools, Alchemy, the compatibility date"
  )
)
