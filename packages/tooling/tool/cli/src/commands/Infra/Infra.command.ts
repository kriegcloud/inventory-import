/**
 * `infra plan-check <file>`: the deploy workflow's guard between a stage's plan and its deploy; reads a file and
 * reaches no account, so anyone may run it.
 *
 * `infra setup`: what the repository's owner does before the first deploy, as one command he runs on his
 * workstation (`goals/infra/PLAN.md`, "What Benjamin does by hand"). No CI job runs it, and an agent runs it only
 * with `--dry-run`, which prints its steps (every size's when none is given) and starts nothing.
 *
 * @packageDocumentation
 */
import * as Config from "effect/Config"
import * as Console from "effect/Console"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as Argument from "effect/cli/Argument"
import * as Command from "effect/cli/Command"
import * as Flag from "effect/cli/Flag"
import { CheckFailed } from "../../Cli.errors.ts"
import { emit } from "../../Report.schema.ts"
import { type SetupSize, setup } from "./InfraSetup.rules.ts"
import { planCheck, planSentence } from "./PlanCheck.rules.ts"

const size = (name: SetupSize, description: string) =>
  Flag.Boolean(name).pipe(Flag.withDescription(description), Flag.withDefault(false))

const flags = {
  testStage: size("test-stage", "Deploy your own test stage, test_<user>, to one Cloudflare account: a live address"),
  staging: size(
    "staging",
    "Deploy the repository's stack: what GitHub must hold so the workflow deploys previews, staging and production"
  ),
  production: size("production", "Deploy production from this workstation"),
  dryRun: Flag.Boolean("dry-run").pipe(
    Flag.withDescription(
      "Print the steps and the commands a run would start, and start nothing; with no size, every size's steps"
    ),
    Flag.withDefault(false)
  ),
  user: Flag.String("user").pipe(
    Flag.withDescription("The name in your test stage, test_<user>; yours on this machine when left out"),
    Flag.optional
  ),
  vault: Flag.String("vault").pipe(
    Flag.withDescription("The 1Password vault for the previews' password, by name or id; asked when there are several"),
    Flag.optional
  ),
  previewAccount: Flag.String("preview-account").pipe(
    Flag.withDescription(
      "The Cloudflare account for previews, test stages and staging, by name or id; asked when left out"
    ),
    Flag.optional
  ),
  productionAccount: Flag.String("production-account").pipe(
    Flag.withDescription("The Cloudflare account for production, by name or id; asked when left out"),
    Flag.optional
  ),
  previewProfile: Flag.String("preview-profile").pipe(
    Flag.withDescription("The Alchemy profile for the previews' account"),
    Flag.withDefault("inventory-preview")
  ),
  productionProfile: Flag.String("production-profile").pipe(
    Flag.withDescription("The Alchemy profile for production's account"),
    Flag.withDefault("inventory-production")
  ),
  approver: Flag.String("approver").pipe(
    Flag.withDescription(
      "The GitHub login that approves a production deploy; the one gh is logged in as when left out"
    ),
    Flag.optional
  ),
  signUp: Flag.String("sign-up").pipe(
    Flag.withDescription("Who may open an account in production: emails separated by commas, or closed"),
    Flag.optional
  )
}

/** `infra setup`. */
export const infraSetupCommand = Command.make("setup", flags, (args) =>
  Effect.gen(function* () {
    const user = yield* Config.String("USER").pipe(Config.withDefault(""))
    const sizes: ReadonlyArray<SetupSize> = [
      ...(args.testStage ? ["test-stage" as const] : []),
      ...(args.staging ? ["staging" as const] : []),
      ...(args.production ? ["production" as const] : [])
    ]
    return yield* setup({
      sizes,
      dryRun: args.dryRun,
      user: O.getOrElse(args.user, () => user),
      vault: args.vault,
      previewAccount: args.previewAccount,
      productionAccount: args.productionAccount,
      previewProfile: args.previewProfile,
      productionProfile: args.productionProfile,
      approver: args.approver,
      signUp: args.signUp
    })
  }).pipe(
    Effect.catchTags({
      SetupStopped: (stopped) => Console.error(stopped.message).pipe(Effect.andThen(Effect.fail(CheckFailed.make({})))),
      ConfigError: Effect.die
    })
  )
).pipe(
  Command.withDescription(
    "Set up what a deploy needs, on the owner's workstation: 1Password reference, Cloudflare accounts, Alchemy profiles and state store, then a plan he reads and a deploy he approves. Never run by CI, and by an agent only with --dry-run"
  )
)

const planFile = Argument.String("file").pipe(
  Argument.withDescription("The file `alchemy deploy --dry-run` printed the stage's plan to")
)

/** `infra plan-check <file>`: refuses a printed plan that would leave the app on an empty database. */
export const infraPlanCheckCommand = Command.make("plan-check", { file: planFile }, (args) =>
  Effect.flatMap(planCheck(args.file), emit(planSentence))
).pipe(
  Command.withDescription(
    "Whether a printed plan keeps the database's rows: a plan that deletes or replaces the database, or that cannot be read, is refused"
  )
)

/** The `infra` group. */
export const infraCommand = Command.make("infra").pipe(
  Command.withDescription("What is deployed: the owner's setup before a first deploy, and the guard on a plan"),
  Command.withSubcommands([infraSetupCommand, infraPlanCheckCommand])
)
