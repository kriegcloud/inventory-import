/**
 * The root command, `beep`: one group per kind of rule, and the three commands that keep what is derived in step.
 *
 * @packageDocumentation
 */
import * as Command from "effect/cli/Command"
import { configSyncCommand } from "./commands/ConfigSync/ConfigSync.command.ts"
import { depsCommand } from "./commands/Deps/Deps.command.ts"
import { docsCommand } from "./commands/Docs/Docs.command.ts"
import { lawsCommand } from "./commands/Laws/Laws.command.ts"
import { qualityCommand } from "./commands/Quality/Quality.command.ts"
import { vendorCommand } from "./commands/Vendor/Vendor.command.ts"
import { versionSyncCommand } from "./commands/VersionSync/VersionSync.command.ts"

/**
 * `beep <group> <command>`.
 *
 * @category commands
 */
export const rootCommand = Command.make("beep").pipe(
  Command.withDescription("The repository's own rules, as commands"),
  Command.withSubcommands([
    configSyncCommand,
    depsCommand,
    docsCommand,
    lawsCommand,
    qualityCommand,
    vendorCommand,
    versionSyncCommand
  ])
)
