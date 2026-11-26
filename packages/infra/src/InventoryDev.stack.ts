/**
 * The trial of `alchemy dev` (`bun run dev:alchemy`, goals/alchemy-uptake step 5): the app's own stack on this
 * machine's local providers, for the personal stage `dev_<user>`. Beside `bun run dev`, never in place of it until
 * Benjamin decides from the trial.
 *
 * Must not break: this entry reaches no account and writes no secret to a file. Its state is in memory, because
 * Alchemy's local state file holds the sign-in secret in plain text, and still does in the Worker's binding record
 * when the file is encrypted with a passphrase (seen 2026-11-26, written up in the goal's PLAN). The price is that
 * every start makes a new, empty database and a new secret. No secrets provider is named: a personal stage's plan
 * names no secret.
 *
 * @packageDocumentation
 */
import * as Cloudflare from "@alchemy.run/cloudflare"
import * as Alchemy from "alchemy"
import * as Effect from "effect/Effect"
import { InfraStage } from "./InfraStage.context.ts"
import { inventory } from "./Inventory.stack.ts"

/**
 * The app on this machine: `bun run dev:alchemy` from the repository root.
 *
 * @category stacks
 */
export default Alchemy.Stack(
  "inventory",
  { providers: Cloudflare.providers(), state: Alchemy.inMemoryState() },
  inventory.pipe(Effect.provideServiceEffect(InfraStage, InfraStage.personal))
)
