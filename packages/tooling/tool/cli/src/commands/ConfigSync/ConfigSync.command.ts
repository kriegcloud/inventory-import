/**
 * `config-sync`: the lists and paths that repeat what the workspaces say, written from them.
 *
 * @packageDocumentation
 */
import * as Effect from "effect/Effect"
import * as Command from "effect/cli/Command"
import * as Flag from "effect/cli/Flag"
import { emit } from "../../Report.schema.ts"
import { syncSentence } from "../../Sync.schema.ts"
import { bunInstall } from "../Scratch/Scratch.rules.ts"
import { configSync } from "./ConfigSync.rules.ts"

const check = Flag.Boolean("check").pipe(
  Flag.withDescription("Name what differs and fail, and write nothing"),
  Flag.withDefault(false)
)
const dryRun = Flag.Boolean("dry-run").pipe(
  Flag.withDescription("Say what would be written, and write nothing"),
  Flag.withDefault(false)
)

/** `config-sync [--check | --dry-run]`: writes the derived configuration, or only compares it. */
export const configSyncCommand = Command.make("config-sync", { check, dryRun }, (flags) =>
  Effect.flatMap(configSync(flags.dryRun ? "dry-run" : flags.check ? "check" : "write", bunInstall), emit(syncSentence))
).pipe(
  Command.withDescription(
    "Write the configuration that follows from the workspaces: syncpack's sources, tsconfig references, each package's scripts, the paths that depend on a package's depth"
  )
)
