/**
 * The root command, `beep`: one group per kind of rule.
 *
 * @packageDocumentation
 */
import * as Command from "effect/cli/Command"
import { docsCommand } from "./commands/Docs/Docs.command.ts"
import { lawsCommand } from "./commands/Laws/Laws.command.ts"
import { qualityCommand } from "./commands/Quality/Quality.command.ts"
import { vendorCommand } from "./commands/Vendor/Vendor.command.ts"

/**
 * `beep <group> <command>`.
 *
 * @category commands
 */
export const rootCommand = Command.make("beep").pipe(
  Command.withDescription("The repository's own rules, as commands"),
  Command.withSubcommands([docsCommand, lawsCommand, qualityCommand, vendorCommand])
)
