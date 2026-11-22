/**
 * `infra setup`: the steps the repository's owner used to do by hand before anything is deployed
 * (`goals/infra/PLAN.md`, "What Benjamin does by hand"), as one command he runs on his workstation.
 *
 * It comes in three sizes, smallest first: a test stage (one Cloudflare account, an address on workers.dev), the
 * repository's stack (what GitHub must hold so the workflow can deploy previews, staging and production), and
 * production itself. The steps of a size are data (`stepsFor`), so `--dry-run` prints exactly the commands a run
 * would start, and a run does them in that order. Each step says what it found and what it will do before it does
 * it, and a step whose work is already done says so and does nothing, so the command can be run again.
 *
 * Must not break:
 * - No secret is read, printed, logged or put in an argument list. The preview password is made by 1Password with
 *   its output thrown away, and only its `op://` reference is written to `packages/infra/env/op.env`. A line of
 *   that file is never printed. The model key's line is the owner's to fill; this command only looks whether it is
 *   a reference.
 * - Every deploy is `plan`, shown on his terminal, then his yes, then `deploy`. A no deploys nothing.
 * - Nothing here is run by an agent or by CI: with no terminal, or with `CI` set, the command stops before its
 *   first step. Only `--dry-run` runs without one, and it starts no tool at all.
 * - Decision I4 holds until the owner says otherwise: production and the previews are two Cloudflare accounts, and
 *   a run that would give both roles to one account stops.
 *
 * @packageDocumentation
 */
import { $RepoCliId } from "@beep/identity/packages"
import { LiteralKit } from "@beep/schema/LiteralKit"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as S from "effect/Schema"
import * as Str from "effect/String"
import { RepoError } from "../../Cli.errors.ts"
import { Repo } from "../../Repo.service.ts"
import { type Given, Workstation } from "./Workstation.service.ts"

const $I = $RepoCliId.create("commands/Infra/InfraSetup.rules")

/** The file of `op://` references, from the repository's root. */
export const opEnvFile = "packages/infra/env/op.env"

/**
 * The owner's own references, from the repository's root: a file git ignores, so the names of his vault and items
 * stay out of the repository. It may name the second account's token and id.
 */
export const localEnvFile = "packages/infra/env/op.env.local"

/** The variable, in `op.env.local`, of an account-owned API token for the previews' account. */
export const previewTokenName = "PREVIEW_CLOUDFLARE_API_TOKEN"

/** The variable, in `op.env.local`, of the previews' account id. */
export const previewAccountIdName = "PREVIEW_CLOUDFLARE_ACCOUNT_ID"

/**
 * What a token must be allowed in the previews' account for a deploy there: the same list the repository's stack
 * gives the token it makes (`account` in `packages/infra/src/GitHub.stack.ts`, itself unverified until a first
 * apply). Kept in step by hand: nothing in the tooling may import the stack.
 */
export const previewTokenNeeds: ReadonlyArray<string> = [
  "Account Settings Read",
  "Workers Scripts Write",
  "D1 Write",
  "Secrets Store Write",
  "Workers Tail Read"
]

/** The repository's stack, from the repository's root. */
export const repositoryStack = "packages/infra/src/GitHub.stack.ts"

/** The variable every preview's test accounts take their password from. */
export const previewPasswordName = "PREVIEW_TEST_ACCOUNT_PASSWORD"

/** The variable production's model key comes from. */
export const modelKeyName = "OPENROUTER_API_KEY"

/** The zone production's address is on: the account that holds it is production's (decision I9). */
export const productionZone = "beep-effect.com"

/** The title of the 1Password item this command makes for the previews' password. */
export const previewPasswordItem = "inventory-import PREVIEW_TEST_ACCOUNT_PASSWORD"

/**
 * How much to set up, smallest first.
 *
 * @category schemas
 */
export const SetupSize = LiteralKit(["test-stage", "staging", "production"]).pipe(
  $I.annoteSchema("SetupSize", {
    description:
      "How much infra setup does: a test stage in one account, the repository's stack that lets the workflow deploy, or production itself"
  })
)
export type SetupSize = typeof SetupSize.Type

/**
 * Which of the two Cloudflare accounts a step is about (decision I4).
 *
 * @category schemas
 */
export const Role = LiteralKit(["preview", "production"]).pipe(
  $I.annoteSchema("Role", {
    description: "The account that holds previews, test stages and staging, or the one that holds production"
  })
)
export type Role = typeof Role.Type

/**
 * What one deploy step deploys.
 *
 * @category schemas
 */
export const Target = LiteralKit(["test-stage", "repository", "production"]).pipe(
  $I.annoteSchema("Target", {
    description: "The owner's test stage, the repository's settings on GitHub, or the production stage"
  })
)
export type Target = typeof Target.Type

/**
 * One step of the setup, in the order `stepsFor` gives them.
 *
 * @category schemas
 */
export const Step = S.TaggedUnion({
  PreviewPassword: {},
  Cloudflare: {
    roles: S.Array(Role).pipe(S.annotateKey({ description: "The accounts this run needs an id for" }))
  },
  Profile: {
    role: Role.pipe(S.annotateKey({ description: "The account the Alchemy profile is for" })),
    github: S.Boolean.pipe(
      S.annotateKey({ description: "Whether the profile must also reach GitHub: the repository's stack does" })
    )
  },
  StateStore: { role: Role.pipe(S.annotateKey({ description: "The account whose state store is made sure of" })) },
  GitHubLogin: {},
  Deploy: { target: Target.pipe(S.annotateKey({ description: "What is planned, shown, asked about and deployed" })) }
}).pipe($I.annoteSchema("Step", { description: "One step of infra setup: what it looks for and what it may start" }))
export type Step = typeof Step.Type

/** What the owner asked for on the command line. */
export interface SetupOptions {
  readonly sizes: ReadonlyArray<SetupSize>
  readonly dryRun: boolean
  /** The name in his test stage, `test_<user>`. */
  readonly user: string
  /** The 1Password vault for a new item, by name or id; asked when there are several and none is given. */
  readonly vault: O.Option<string>
  /** The Cloudflare account for each role, by name or id; asked when none is given. */
  readonly previewAccount: O.Option<string>
  readonly productionAccount: O.Option<string>
  /** The Alchemy profile for each role. */
  readonly previewProfile: string
  readonly productionProfile: string
  /** The GitHub login that approves a production deploy; his own when none is given. */
  readonly approver: O.Option<string>
  /** Who may open an account in production: `closed`, or emails separated by commas. */
  readonly signUp: O.Option<string>
}

/**
 * A setup that stopped, with the sentence that says why and what to do.
 *
 * @category errors
 */
export class SetupStopped extends S.TaggedError<SetupStopped, { readonly brand: unique symbol }>($I`SetupStopped`)(
  "SetupStopped",
  { message: S.String.pipe(S.annotateKey({ description: "Why the setup stopped and what the owner does next" })) },
  $I.annoteError<SetupStopped>("SetupStopped", { description: "An infra setup that stopped before finishing" })
) {}

const stop = (message: string) => Effect.fail(SetupStopped.make({ message }))

const has = (sizes: ReadonlyArray<SetupSize>, size: SetupSize) => A.contains(sizes, size)

/**
 * The steps of a run, in order. 1Password comes first where it is needed at all, then Cloudflare, then each size
 * from the smallest: a test stage is deployed before anything is asked about production.
 *
 * @example
 * stepsFor(["test-stage"]) // Cloudflare (preview), Profile (preview), StateStore (preview), Deploy (test-stage)
 */
export const stepsFor = (sizes: ReadonlyArray<SetupSize>): ReadonlyArray<Step> => {
  const test = has(sizes, "test-stage")
  const staging = has(sizes, "staging")
  const production = has(sizes, "production")
  const preview = test || staging
  const prod = staging || production
  const roles: ReadonlyArray<Role> = [
    ...(preview ? ["preview" as const] : []),
    ...(prod ? ["production" as const] : [])
  ]
  return [
    ...(staging ? [Step.cases.PreviewPassword.make({})] : []),
    ...(A.isReadonlyArrayNonEmpty(roles) ? [Step.cases.Cloudflare.make({ roles })] : []),
    ...(preview
      ? [Step.cases.Profile.make({ role: "preview", github: false }), Step.cases.StateStore.make({ role: "preview" })]
      : []),
    ...(test ? [Step.cases.Deploy.make({ target: "test-stage" })] : []),
    ...(prod
      ? [
          Step.cases.Profile.make({ role: "production", github: staging }),
          Step.cases.StateStore.make({ role: "production" })
        ]
      : []),
    ...(staging ? [Step.cases.GitHubLogin.make({}), Step.cases.Deploy.make({ target: "repository" })] : []),
    ...(production ? [Step.cases.Deploy.make({ target: "production" })] : [])
  ]
}

/** A tool and its arguments, as it is started. */
export interface Call {
  readonly command: string
  readonly args: ReadonlyArray<string>
}

const alchemy = (...args: ReadonlyArray<string>): Call => ({ command: "bunx", args: ["alchemy", ...args] })

/** A call run under 1Password, which fills the references of `op.env` for that one process. */
const underOp = (call: Call): Call => ({
  command: "op-human",
  args: ["run", "--env-file", opEnvFile, "--", call.command, ...call.args]
})

const profileOf = (options: SetupOptions, role: Role) =>
  Role.match(role, { preview: () => options.previewProfile, production: () => options.productionProfile })

/** The stage a deploy step names. */
const stageOf = (options: SetupOptions, target: Target) =>
  Target.match(target, {
    "test-stage": () => `test_${options.user}`,
    repository: () => "prod",
    production: () => "prod"
  })

/**
 * The call that plans or deploys one target. A deploy carries `--yes` because the owner has just read this plan
 * and said yes to this command. Alchemy asks only when its input and output are both a terminal, and `op run` puts
 * its masking between a tool's output and the terminal (read in both tools' sources and help, not tried).
 */
const deployCall = (options: SetupOptions, target: Target, verb: "plan" | "deploy"): Call => {
  const yes = verb === "deploy" ? ["--yes"] : []
  return Target.match(target, {
    "test-stage": () => alchemy(verb, "--stage", stageOf(options, target), "--profile", options.previewProfile, ...yes),
    repository: () =>
      underOp(alchemy(verb, repositoryStack, "--stage", "prod", "--profile", options.productionProfile, ...yes)),
    production: () => underOp(alchemy(verb, "--stage", "prod", "--profile", options.productionProfile, ...yes))
  })
}

const shown = (call: Call) => A.join([call.command, ...call.args], " ")

/**
 * Whether a variable of `op.env` is given, without ever handing back what its line holds.
 *
 * @category schemas
 */
export const ReferenceState = LiteralKit(["missing", "reference", "not-a-reference"]).pipe(
  $I.annoteSchema("ReferenceState", {
    description:
      "A variable of op.env: no line that is not a comment, a line that is an op:// reference, or a line that is something else"
  })
)
export type ReferenceState = typeof ReferenceState.Type

const linesOf = (text: string) => A.map(Str.split("\n")(text), Str.trim)

// A vault's or an item's name may hold spaces; the line is then quoted.
const isReference = (value: string) =>
  /^op:\/\/[^\s<>"/]+\/[^\s<>"/]+\/[^\s<>"]+$/.test(value) || /^"op:\/\/[^<>"/]+\/[^<>"/]+\/[^<>"]+"$/.test(value)

/**
 * What `op.env` holds for one variable. A line still holding the template's `<vault>` is not a reference.
 *
 * @example
 * referenceState({ text: "# OPENROUTER_API_KEY=op://<vault>/<item>/<field>", name: "OPENROUTER_API_KEY" }) // "missing"
 */
export const referenceState = (input: { readonly text: string; readonly name: string }): ReferenceState => {
  const given = A.filter(linesOf(input.text), Str.startsWith(`${input.name}=`))
  if (!A.isReadonlyArrayNonEmpty(given)) return "missing"
  return A.every(given, (line) => isReference(Str.slice(input.name.length + 1)(line))) ? "reference" : "not-a-reference"
}

/**
 * `op.env` with one variable's reference written: in place of its commented line when there is one, else at the end.
 *
 * @example
 * withReference({ text: "# A=op://<vault>/<item>/<field>\n", name: "A", reference: "op://v/i/password" }) // "A=op://v/i/password\n"
 */
export const withReference = (input: {
  readonly text: string
  readonly name: string
  readonly reference: string
}): string => {
  const { text, name } = input
  const line = `${name}=${input.reference}`
  const lines = Str.split("\n")(text)
  const at = A.findFirstIndex(lines, (one) => new RegExp(`^#\\s*${name}=`).test(Str.trim(one)))
  return O.match(at, {
    onNone: () => `${Str.endsWith("\n")(text) || text === "" ? text : `${text}\n`}${line}\n`,
    onSome: (index) =>
      A.join(
        A.map(lines, (one, i) => (i === index ? line : one)),
        "\n"
      )
  })
}

/**
 * A Cloudflare account as `cf auth whoami` names it.
 *
 * @category schemas
 */
export class Account extends S.Class<Account, { readonly brand: unique symbol }>($I`Account`)(
  {
    id: S.String.pipe(S.annotateKey({ description: "The account's id, which a stack and a token name it by" })),
    name: S.String.pipe(S.annotateKey({ description: "The account's name, as its owner reads it" }))
  },
  $I.annote("Account", { description: "One Cloudflare account the logged-in person can use" })
) {}

const WhoAmI = S.Struct({
  authenticated: S.Boolean,
  tokenValid: S.optionalKey(S.Boolean),
  accounts: S.Array(Account)
}).pipe($I.annoteSchema("WhoAmI", { description: "What `cf auth whoami` answers, as far as the setup reads it" }))

const Zone = S.Struct({ account: S.Struct({ id: S.String }) }).pipe(
  $I.annoteSchema("Zone", {
    description: "A zone as `cf zones list` names it: the account that holds it, nothing else"
  })
)

const Named = S.Struct({ id: S.String, name: S.String }).pipe(
  $I.annoteSchema("Named", { description: "A 1Password vault: its id and name, nothing it holds" })
)

const Titled = S.Struct({ id: S.String, title: S.String }).pipe(
  $I.annoteSchema("Titled", { description: "A 1Password item: its id and title, none of its fields" })
)

/** A tool's JSON answer through a schema; none when it did not answer or answered something else. */
const read = Effect.fn("InfraSetup.read")(function* <Sch extends S.ConstraintDecoder<unknown>>(
  schema: Sch,
  call: Call
) {
  const workstation = yield* Workstation
  const answer = yield* workstation.ask(call.command, call.args)
  if (answer.code !== 0) return O.none<Sch["Type"]>()
  return S.decodeOption(S.fromJsonString(schema))(answer.stdout)
})

/** What the steps before one found, for the steps after it. */
export interface Found {
  readonly preview: O.Option<Account>
  readonly production: O.Option<Account>
  readonly approver: O.Option<string>
  /** Whether `op.env.local` names a token and an id for the previews' account: no login to it is then needed. */
  readonly previewByToken: boolean
}

const nothingFound: Found = { preview: O.none(), production: O.none(), approver: O.none(), previewByToken: false }

const accountOf = (found: Found, role: Role) =>
  Role.match(role, { preview: () => found.preview, production: () => found.production })

/** Variables a deploy is given beside the references 1Password fills: names, ids and a flag, none of them secret. */
export const givenFor = (input: {
  readonly target: Target
  readonly found: Found
  readonly options: SetupOptions
  readonly modelKey: ReferenceState
}): Given => {
  const signUp = O.getOrElse(input.options.signUp, () => "closed")
  const withoutKey: Given = input.modelKey === "reference" ? {} : { DEPLOY_WITHOUT_MODEL_KEY: "true" }
  return Target.match(input.target, {
    "test-stage": (): Given => ({}),
    repository: (): Given => ({
      ...O.match(input.found.production, {
        onNone: () => ({}),
        onSome: (account) => ({ PRODUCTION_CLOUDFLARE_ACCOUNT_ID: account.id })
      }),
      ...O.match(input.found.preview, {
        onNone: () => ({}),
        onSome: (account) => ({ PREVIEW_CLOUDFLARE_ACCOUNT_ID: account.id })
      }),
      ...O.match(input.found.approver, { onNone: () => ({}), onSome: (login) => ({ PRODUCTION_APPROVER: login }) }),
      SIGN_UP: signUp,
      ...withoutKey
    }),
    production: (): Given => ({ SIGN_UP: signUp, ...withoutKey })
  })
}

const givenNames: Readonly<Record<Target, ReadonlyArray<string>>> = {
  "test-stage": [],
  repository: ["PRODUCTION_CLOUDFLARE_ACCOUNT_ID", "PREVIEW_CLOUDFLARE_ACCOUNT_ID", "PRODUCTION_APPROVER", "SIGN_UP"],
  production: ["SIGN_UP"]
}

/**
 * What `--dry-run` prints for one step: what it looks for, and each command a run may start, word for word. A
 * value only a run can find is named in angle brackets.
 */
export const described = (options: SetupOptions): ((step: Step) => ReadonlyArray<string>) =>
  Step.match({
    PreviewPassword: () => [
      `1Password: the previews' password. Looks in ${opEnvFile} for ${previewPasswordName}; a reference already there is left alone.`,
      "  op-human vault list --format json",
      "  op-human item list --vault <vault id> --format json",
      `  op-human item create --category password --title "${previewPasswordItem}" --vault <vault id> --generate-password   (only when no item has that title; its output is thrown away)`,
      `  then writes ${previewPasswordName}=op://<vault id>/<item id>/password to ${opEnvFile}: a reference, never a value`
    ],
    Cloudflare: (step) => [
      `Cloudflare: which account is for ${A.join(step.roles, " and for ")}. Logs in only when cf is not logged in; the login is yours, in the browser.`,
      `  when ${localEnvFile} names ${previewTokenName} and ${previewAccountIdName}: the previews' account is that one, with no login; its profile is connected under \`op-human run --env-file ${localEnvFile}\` after \`cf accounts tokens verify\` and \`get\` say what the token allows`,
      "  cf auth whoami",
      "  cf auth login   (only when not logged in)",
      `  cf zones list --name ${productionZone}   (the account that holds it is production's; you are shown both roles and asked)`
    ],
    Profile: (step) => {
      const name = profileOf(options, step.role)
      return [
        `Alchemy profile "${name}" (${step.role} account), connected to Cloudflare${step.github ? " and GitHub" : ""}. One that is there and connected is left alone.`,
        "  bunx alchemy profile list",
        `  bunx alchemy profile create ${name}   (only when there is none)`,
        `  bunx alchemy profile edit --profile ${name} --add Cloudflare${step.github ? " --add GitHub" : ""}   (only what is not connected; the browser login and the account are yours to pick)`
      ]
    },
    StateStore: (step) => [
      `The state store in the ${step.role} account: asks first, then makes it or adopts the one that is there.`,
      `  bunx alchemy state bootstrap --profile ${profileOf(options, step.role)}`
    ],
    GitHubLogin: () => [
      "GitHub: who approves a production deploy. Logs in only when gh is not logged in.",
      "  gh api user --jq .login",
      "  gh auth login   (only when not logged in)"
    ],
    Deploy: (step) => {
      const names = givenNames[step.target]
      const given = A.isReadonlyArrayNonEmpty(names)
        ? [
            `  given: ${A.join(names, ", ")}${step.target === "test-stage" ? "" : ", and DEPLOY_WITHOUT_MODEL_KEY=true when op.env names no model key"}`
          ]
        : []
      return [
        `Deploy ${Target.match(step.target, {
          "test-stage": () => `your test stage, ${stageOf(options, step.target)}`,
          repository: () => "the repository's stack (GitHub's environments, their secrets, the rules)",
          production: () => "production"
        })}: the plan is shown, you are asked, and only a yes deploys.`,
        `  ${shown(deployCall(options, step.target, "plan"))}`,
        `  ${shown(deployCall(options, step.target, "deploy"))}   (only after your yes)`,
        ...given
      ]
    }
  })

/** What `--dry-run` prints: every step in order, and that nothing was started. */
export const dryRun = (options: SetupOptions): ReadonlyArray<string> => [
  "Dry run: nothing is started and nothing is written. A run would do these steps, in this order:",
  ...A.flatMap(stepsFor(options.sizes), (step, index) => {
    const [first, ...rest] = described(options)(step)
    return [`${index + 1}. ${first ?? ""}`, ...rest]
  })
]

/** Stops unless a person is at a terminal: no agent and no CI job runs the setup. */
const ownerOnly = Effect.gen(function* () {
  const workstation = yield* Workstation
  const terminal = yield* workstation.hand("sh", ["-c", 'test -t 0 && test -t 1 && test -z "${CI:-}"'])
  if (terminal !== 0) {
    return yield* stop(
      "infra setup is run by the repository's owner at a terminal: this is not one, or CI is set. Nothing was started. `--dry-run` prints the steps."
    )
  }
})

const loggedIn = (who: O.Option<typeof WhoAmI.Type>) =>
  O.filter(who, (answer) => answer.authenticated && answer.tokenValid !== false)

const named = (accounts: ReadonlyArray<Account>) =>
  A.join(
    A.map(accounts, (account) => `"${account.name}"`),
    ", "
  )

/** The account for one role: the one the flag names, the only one after a yes, or the one he picks. */
const pick = Effect.fn("InfraSetup.pick")(function* (input: {
  readonly role: Role
  readonly wanted: O.Option<string>
  readonly accounts: A.NonEmptyReadonlyArray<Account>
  /** The account that holds production's zone, when cf could tell. */
  readonly holder: O.Option<Account>
}) {
  const workstation = yield* Workstation
  const { role, wanted, accounts } = input
  if (O.isSome(wanted)) {
    const match = A.findFirst(accounts, (account) => account.id === wanted.value || account.name === wanted.value)
    if (O.isNone(match)) {
      return yield* stop(
        `No Cloudflare account named "${wanted.value}" for ${role}: cf sees ${named(accounts)}. Nothing was changed.`
      )
    }
    return match.value
  }
  const holds = (account: Account) => O.exists(input.holder, (holder) => holder.id === account.id)
  const [only, ...others] = accounts
  if (!A.isReadonlyArrayNonEmpty(others)) {
    const note =
      role === "preview" && holds(only)
        ? ` It holds the zone ${productionZone}, so it is production's account: a test stage here shares it.`
        : ""
    const yes = yield* workstation.confirm(`Use the Cloudflare account "${only.name}" for ${role}?${note}`)
    if (!yes) return yield* stop(`Stopped: no Cloudflare account for ${role}. Nothing was changed.`)
    return only
  }
  const id = yield* workstation.choose(
    `Which Cloudflare account is for ${role}?`,
    A.map(accounts, (account) => ({
      title: holds(account) ? `${account.name} (holds ${productionZone})` : account.name,
      value: account.id
    }))
  )
  return O.getOrElse(
    A.findFirst(accounts, (account) => account.id === id),
    () => only
  )
})

const cloudflare = Effect.fn("InfraSetup.cloudflare")(function* (
  wantedRoles: ReadonlyArray<Role>,
  options: SetupOptions,
  found: Found
) {
  const workstation = yield* Workstation
  if (found.previewByToken) {
    yield* workstation.say(
      `Cloudflare: the previews' account is the one ${localEnvFile} names a token and an id for. No login to it is needed, and cf is not asked about it.`
    )
  }
  const roles = found.previewByToken ? A.filter(wantedRoles, (role) => role !== "preview") : wantedRoles
  if (!A.isReadonlyArrayNonEmpty(roles)) return found
  const whoAmI = read(WhoAmI, { command: "cf", args: ["auth", "whoami"] })
  const asked = yield* whoAmI
  const first = loggedIn(asked)
  if (O.isNone(first)) {
    yield* workstation.say("Cloudflare: cf is not logged in. Starting `cf auth login`: approve it in the browser.")
    const code = yield* workstation.hand("cf", ["auth", "login"])
    if (code !== 0) return yield* stop("`cf auth login` did not finish. Nothing was changed; run this again.")
  }
  const again = O.isSome(first) ? first : yield* whoAmI
  const who = loggedIn(again)
  if (O.isNone(who)) {
    return yield* stop("cf is still not logged in (`cf auth whoami`). Nothing was changed; run this again.")
  }
  const accounts = who.value.accounts
  if (!A.isReadonlyArrayNonEmpty(accounts)) {
    return yield* stop("cf is logged in and sees no Cloudflare account. Nothing was changed.")
  }
  yield* workstation.say(
    `Cloudflare: cf is logged in and sees ${accounts.length === 1 ? "one account" : `${accounts.length} accounts`}: ${named(accounts)}.`
  )
  const zones = yield* read(S.Array(Zone), { command: "cf", args: ["zones", "list", "--name", productionZone] })
  const holder = O.flatMap(zones, (found) =>
    found.length === 1
      ? A.findFirst(accounts, (account) => A.some(found, (zone) => zone.account.id === account.id))
      : O.none()
  )
  yield* workstation.say(
    O.match(holder, {
      onSome: (account) =>
        `Cloudflare: "${account.name}" holds the zone ${productionZone}, so it is production's account.`,
      onNone: () => `Cloudflare: cf could not tell which account holds the zone ${productionZone}.`
    })
  )
  const both = A.contains(roles, "preview") && A.contains(roles, "production")
  const sameAccount =
    "Production and the previews are two Cloudflare accounts (decision I4): a preview's deploy token covers its whole account, so in one account every pull request's run could change or remove production. Nothing was changed."
  if (both && accounts.length === 1) {
    return yield* stop(
      `cf sees one account. ${sameAccount} The repository's stack makes both deploy tokens with the one login it is deployed with, so that login must reach both accounts: add it as a member of the second account, then run this again.`
    )
  }
  const unnamed = O.isNone(options.previewAccount) && O.isNone(options.productionAccount)
  const rest = O.match(holder, {
    onNone: () => A.empty<Account>(),
    onSome: (held) => A.filter(accounts, (account) => account.id !== held.id)
  })
  // The zone settles production's account; the previews' is the other one, or his pick among the others.
  if (both && unnamed && O.isSome(holder) && A.isReadonlyArrayNonEmpty(rest)) {
    const previews = yield* pick({ role: "preview", wanted: O.none(), accounts: rest, holder })
    yield* workstation.say(
      `Cloudflare: production is "${holder.value.name}"; previews, test stages and staging are "${previews.name}".`
    )
    const yes = yield* workstation.confirm(
      `Use "${holder.value.name}" for production and "${previews.name}" for previews, test stages and staging?`
    )
    if (!yes) {
      return yield* stop(
        "Stopped: the accounts were not confirmed. Name them with `--production-account` and `--preview-account`. Nothing was changed."
      )
    }
    return { ...found, preview: O.some(previews), production: holder }
  }
  const preview = A.contains(roles, "preview")
    ? yield* pick({ role: "preview", wanted: options.previewAccount, accounts, holder }).pipe(Effect.asSome)
    : found.preview
  const production = A.contains(roles, "production")
    ? yield* pick({ role: "production", wanted: options.productionAccount, accounts, holder }).pipe(Effect.asSome)
    : found.production
  if (both && O.isSome(preview) && O.isSome(production) && preview.value.id === production.value.id) {
    return yield* stop(`Both roles were given the account "${preview.value.name}". ${sameAccount}`)
  }
  return { ...found, preview, production }
})

/** Each profile `alchemy profile list` names, with the providers it is connected to. */
export const profilesOf = (listing: string): ReadonlyArray<{ readonly name: string; readonly providers: string }> =>
  A.flatMap(linesOf(listing), (line) =>
    O.match(Str.match(/^[*-] ([^\s:]+)(?:: (.*))?$/)(line), {
      onNone: () => [],
      onSome: (match) => [{ name: `${match[1]}`, providers: match[2] ?? "" }]
    })
  )

const connected = (providers: string, provider: string) => new RegExp(`(^|, )${provider} \\(`).test(providers)

/** A call under 1Password with the owner's own references filled, the two of the previews' account under cf's names. */
const asPreviews = (script: string): Call => ({
  command: "op-human",
  args: [
    "run",
    "--env-file",
    localEnvFile,
    "--",
    "sh",
    "-c",
    `CLOUDFLARE_API_TOKEN="$${previewTokenName}" CLOUDFLARE_ACCOUNT_ID="$${previewAccountIdName}" ${script}`
  ]
})

const Verified = S.Struct({ id: S.String, status: S.String }).pipe(
  $I.annoteSchema("Verified", { description: "What `cf accounts tokens verify` answers: the token's id and status" })
)

const Permitted = S.Struct({
  policies: S.Array(S.Struct({ effect: S.String, permission_groups: S.Array(S.Struct({ name: S.String })) }))
}).pipe($I.annoteSchema("Permitted", { description: "A token's policies: what each allows, by permission group" }))

/**
 * Whether the previews' token works and is allowed what a deploy needs, said before anything is made with it. A
 * token that cannot show its own permissions, or lacks one, is his to go on with or not.
 */
const tokenChecked = Effect.gen(function* () {
  const workstation = yield* Workstation
  const verified = yield* read(Verified, asPreviews("cf accounts tokens verify"))
  if (O.isNone(verified) || verified.value.status !== "active" || !/^[0-9a-f]{32}$/.test(verified.value.id)) {
    return yield* stop(
      `The token ${localEnvFile} names for the previews' account did not verify as active (\`cf accounts tokens verify\`). Check ${previewTokenName} and ${previewAccountIdName} there. Nothing was changed.`
    )
  }
  const needs = A.join(previewTokenNeeds, ", ")
  const permitted = yield* read(Permitted, asPreviews(`cf accounts tokens get ${verified.value.id}`))
  const lacking = O.map(permitted, (token) => {
    const allowed = A.flatMap(token.policies, (policy) =>
      policy.effect === "allow" ? A.map(policy.permission_groups, (group) => group.name) : []
    )
    return A.filter(previewTokenNeeds, (need) => !A.contains(allowed, need))
  })
  if (O.isSome(lacking) && !A.isReadonlyArrayNonEmpty(lacking.value)) {
    return yield* workstation.say(
      `Cloudflare: the previews' token is active and allows what a deploy needs (${needs}).`
    )
  }
  yield* workstation.say(
    O.match(lacking, {
      onNone: () =>
        `Cloudflare: the previews' token is active, but it may not read its own permissions, so they were not checked. A deploy needs: ${needs}.`,
      onSome: (missing) =>
        `Cloudflare: the previews' token is active and lacks: ${A.join(missing, ", ")}. A deploy needs: ${needs}. Add them to the token in the dashboard, or go on if the names differ there.`
    })
  )
  const yes = yield* workstation.confirm("Go on with this token?")
  if (!yes) return yield* stop("Stopped at the previews' token. Nothing was changed.")
})

const profile = Effect.fn("InfraSetup.profile")(function* (
  role: Role,
  github: boolean,
  options: SetupOptions,
  found: Found
) {
  const workstation = yield* Workstation
  const name = profileOf(options, role)
  const wanted = ["Cloudflare", ...(github ? ["GitHub"] : [])]
  const listed = Effect.gen(function* () {
    const answer = yield* workstation.ask("bunx", ["alchemy", "profile", "list"])
    if (answer.code !== 0) {
      return yield* stop(`\`bunx alchemy profile list\` failed: ${Str.trim(answer.stderr)}. Nothing was changed.`)
    }
    return A.findFirst(profilesOf(answer.stdout), (one) => one.name === name)
  })
  const missing = (providers: string) => A.filter(wanted, (provider) => !connected(providers, provider))
  const before = yield* listed
  if (O.isNone(before)) {
    yield* workstation.say(`Alchemy: no profile "${name}". Creating it (a name on this machine, nothing in the cloud).`)
    const made = yield* workstation.ask("bunx", ["alchemy", "profile", "create", name])
    if (made.code !== 0) {
      return yield* stop(`\`bunx alchemy profile create ${name}\` failed: ${Str.trim(made.stderr)}.`)
    }
  }
  const toConnect = missing(O.match(before, { onNone: () => "", onSome: (one) => one.providers }))
  if (!A.isReadonlyArrayNonEmpty(toConnect)) {
    yield* workstation.say(
      `Alchemy: profile "${name}" is there and connected to ${A.join(wanted, " and ")}. Left as it is.`
    )
    return found
  }
  if (role === "preview" && found.previewByToken) {
    yield* tokenChecked
    yield* workstation.say(
      `Alchemy: connecting profile "${name}" to the previews' account with the token and id ${localEnvFile} names. 1Password fills them for that one command; Alchemy then keeps the token in its profile store on this machine.`
    )
    const stored = yield* workstation.hand("op-human", [
      "run",
      "--env-file",
      localEnvFile,
      "--",
      "bunx",
      "alchemy",
      "profile",
      "edit",
      "--profile",
      name,
      "--add",
      "Cloudflare",
      "--method",
      "stored",
      "--set",
      `apiToken=env:${previewTokenName}`,
      "--set",
      `accountId=env:${previewAccountIdName}`
    ])
    if (stored !== 0) return yield* stop(`Connecting profile "${name}" did not finish; what it said is above.`)
    const now = yield* listed
    if (!O.exists(now, (one) => connected(one.providers, "Cloudflare"))) {
      return yield* stop(`Profile "${name}" is still not connected to Cloudflare. Run this again.`)
    }
    return found
  }
  const account = O.match(accountOf(found, role), { onNone: () => "", onSome: (one) => ` "${one.name}"` })
  yield* workstation.say(
    `Alchemy: connecting profile "${name}" to ${A.join(toConnect, " and ")}. Yours to do: approve the login in the browser${
      A.contains(toConnect, "Cloudflare")
        ? `, and if Alchemy asks which account, pick${account} (the ${role} account)`
        : ""
    }${A.contains(toConnect, "GitHub") ? "; for GitHub pick gh-cli" : ""}.`
  )
  const code = yield* workstation.hand("bunx", [
    "alchemy",
    "profile",
    "edit",
    "--profile",
    name,
    ...A.flatMap(toConnect, (provider) => ["--add", provider])
  ])
  if (code !== 0) return yield* stop(`Connecting profile "${name}" did not finish. Run this again.`)
  const after = yield* listed
  const still = missing(O.match(after, { onNone: () => "", onSome: (one) => one.providers }))
  if (A.isReadonlyArrayNonEmpty(still)) {
    return yield* stop(`Profile "${name}" is still not connected to ${A.join(still, " and ")}. Run this again.`)
  }
  return found
})

const stateStore = Effect.fn("InfraSetup.stateStore")(function* (role: Role, options: SetupOptions, found: Found) {
  const workstation = yield* Workstation
  const name = profileOf(options, role)
  const account = O.match(accountOf(found, role), {
    onNone: () => `the ${role} account`,
    onSome: (one) => `the account "${one.name}"`
  })
  yield* workstation.say(
    `State store: Alchemy keeps what it deployed in a small Worker in ${account}. \`state bootstrap\` makes it, or adopts the one that is there (one an older build of Alchemy made is upgraded, one way).`
  )
  const yes = yield* workstation.confirm(`Make sure the state store exists in ${account}?`)
  if (!yes) return yield* stop(`Stopped before the state store in ${account}. Nothing was made there by this step.`)
  const code = yield* workstation.hand("bunx", ["alchemy", "state", "bootstrap", "--profile", name])
  if (code !== 0)
    return yield* stop(`\`bunx alchemy state bootstrap --profile ${name}\` failed; what it said is above.`)
  return found
})

const opFailed = (what: string, said: string) =>
  stop(`1Password: ${what} failed: ${Str.trim(said)}. Nothing was written to ${opEnvFile}.`)

const previewPassword = Effect.fn("InfraSetup.previewPassword")(function* (options: SetupOptions, found: Found) {
  const workstation = yield* Workstation
  const repo = yield* Repo
  const file = repo.join(repo.root, opEnvFile)
  const text = yield* repo.text(file)
  const state = referenceState({ text, name: previewPasswordName })
  if (state === "reference") {
    yield* workstation.say(
      `1Password: ${opEnvFile} already names a reference for ${previewPasswordName}. Left as it is.`
    )
    return found
  }
  if (state === "not-a-reference") {
    return yield* stop(
      `${opEnvFile} has a line for ${previewPasswordName} that is not an op:// reference. That file holds references only: put the line right, or remove it, and run this again. The line was not printed.`
    )
  }
  yield* workstation.say(
    `1Password: ${opEnvFile} names no ${previewPasswordName}. Looking for the item "${previewPasswordItem}"; 1Password may ask you to unlock.`
  )
  const vaults = yield* read(S.Array(Named), { command: "op-human", args: ["vault", "list", "--format", "json"] })
  if (O.isNone(vaults)) return yield* opFailed("`op-human vault list`", "it gave no list of vaults")
  const all = vaults.value
  if (!A.isReadonlyArrayNonEmpty(all)) return yield* opFailed("`op-human vault list`", "no vault is visible")
  const vault = yield* O.match(options.vault, {
    onSome: (wanted) =>
      O.match(
        A.findFirst(all, (one) => one.id === wanted || one.name === wanted),
        {
          onNone: () => stop(`1Password has no vault "${wanted}". Nothing was written.`),
          onSome: (one) => Effect.succeed(one)
        }
      ),
    onNone: () => {
      const [only, ...others] = all
      if (!A.isReadonlyArrayNonEmpty(others)) return Effect.succeed(only)
      return workstation
        .choose(
          "Which 1Password vault holds the previews' password?",
          A.map(all, (one) => ({ title: one.name, value: one.id }))
        )
        .pipe(
          Effect.map((id) =>
            O.getOrElse(
              A.findFirst(all, (one) => one.id === id),
              () => only
            )
          )
        )
    }
  })
  const items = read(S.Array(Titled), {
    command: "op-human",
    args: ["item", "list", "--vault", vault.id, "--format", "json"]
  }).pipe(Effect.map(O.map(A.filter((item) => item.title === previewPasswordItem))))
  const before = yield* items
  if (O.isNone(before)) return yield* opFailed("`op-human item list`", "it gave no list of items")
  if (before.value.length > 1) {
    return yield* stop(
      `1Password: the vault "${vault.name}" holds ${before.value.length} items titled "${previewPasswordItem}". Keep one, and run this again. Nothing was written.`
    )
  }
  if (before.value.length === 0) {
    yield* workstation.say(
      `1Password: no such item in the vault "${vault.name}". Making it with a password 1Password generates; this command never sees it.`
    )
    const made = yield* workstation.quiet("op-human", [
      "item",
      "create",
      "--category",
      "password",
      "--title",
      previewPasswordItem,
      "--vault",
      vault.id,
      "--generate-password"
    ])
    if (made.code !== 0) return yield* opFailed("`op-human item create`", made.stderr)
  } else {
    yield* workstation.say(`1Password: the item is in the vault "${vault.name}". Using it; its password is not read.`)
  }
  const after = before.value.length === 1 ? before : yield* items
  const item = O.flatMap(after, A.head)
  if (O.isNone(item) || O.exists(after, (list) => list.length !== 1)) {
    return yield* opFailed("`op-human item create`", "the item is not there afterwards")
  }
  yield* repo.write(
    file,
    withReference({ text, name: previewPasswordName, reference: `op://${vault.id}/${item.value.id}/password` })
  )
  yield* workstation.say(
    `1Password: wrote the reference for ${previewPasswordName} to ${opEnvFile} (ids of the vault and the item, no value). Commit that file when you like. You sign in to a preview with the password shown in 1Password.`
  )
  return found
})

const gitHubLogin = Effect.fn("InfraSetup.gitHubLogin")(function* (options: SetupOptions, found: Found) {
  const workstation = yield* Workstation
  const login = Effect.gen(function* () {
    const answer = yield* workstation.ask("gh", ["api", "user", "--jq", ".login"])
    return answer.code === 0 && Str.isNonEmpty(Str.trim(answer.stdout)) ? O.some(Str.trim(answer.stdout)) : O.none()
  })
  const first = yield* login
  if (O.isNone(first)) {
    yield* workstation.say(
      "GitHub: gh is not logged in. Starting `gh auth login`: it needs rights over the repository's settings."
    )
    const code = yield* workstation.hand("gh", ["auth", "login"])
    if (code !== 0) return yield* stop("`gh auth login` did not finish. Nothing was changed; run this again.")
  }
  const who = O.isSome(first) ? first : yield* login
  if (O.isNone(who)) return yield* stop("gh is still not logged in (`gh api user`). Run this again.")
  const approver = O.getOrElse(options.approver, () => who.value)
  yield* workstation.say(
    `GitHub: gh is logged in as ${who.value}. A production deploy will wait for ${approver} to approve it.`
  )
  return { ...found, approver: O.some(approver) }
})

const deploy = Effect.fn("InfraSetup.deploy")(function* (target: Target, options: SetupOptions, found: Found) {
  const workstation = yield* Workstation
  const repo = yield* Repo
  const stage = stageOf(options, target)
  const text = target === "test-stage" ? "" : yield* repo.text(repo.join(repo.root, opEnvFile))
  const modelKey = referenceState({ text, name: modelKeyName })
  if (target !== "test-stage") {
    if (modelKey === "not-a-reference") {
      return yield* stop(
        `${opEnvFile} has a line for ${modelKeyName} that is not an op:// reference. Fill in its vault path, or put the "# " back, and run this again. The line was not printed.`
      )
    }
    yield* workstation.say(
      modelKey === "reference"
        ? `Model key: ${opEnvFile} names a reference for ${modelKeyName}. 1Password fills it for the deploy; this command never reads it.`
        : `Model key: ${opEnvFile} names none, so this deploys with DEPLOY_WITHOUT_MODEL_KEY=true: production runs without a model and its rules answer. To use a model, fill in that line and run this again.`
    )
    if (target === "repository" && referenceState({ text, name: previewPasswordName }) !== "reference") {
      return yield* stop(`${opEnvFile} names no reference for ${previewPasswordName}. Nothing was deployed.`)
    }
    yield* workstation.say(
      O.match(options.signUp, {
        onSome: (signUp) => `Sign-up in production: ${signUp}.`,
        onNone: () =>
          "Sign-up in production: closed (no `--sign-up`), so nobody can open an account there, you included, until this runs with `--sign-up <your email>`."
      })
    )
  }
  if (target === "production" && O.isNone(options.signUp)) {
    return yield* stop(
      "Production needs `--sign-up`: the emails that may open an account (yours first), or `closed`. Nothing was deployed."
    )
  }
  const given = givenFor({ target, found, options, modelKey })
  const what = Target.match(target, {
    "test-stage": () => `your test stage ${stage}`,
    repository: () => "the repository's stack (GitHub's environments, their secrets and rules; two Cloudflare tokens)",
    production: () => "production"
  })
  const plan = deployCall(options, target, "plan")
  yield* workstation.say(`Plan for ${what}: \`${shown(plan)}\`. It changes nothing. Read it.`)
  const planned = yield* workstation.hand(plan.command, plan.args, given)
  if (planned !== 0) return yield* stop(`The plan for ${what} failed; what it said is above. Nothing was deployed.`)
  const yes = yield* workstation.confirm(`Deploy ${what} as that plan says?`)
  if (!yes) return yield* stop(`Stopped: ${what} was not deployed.`)
  const call = deployCall(options, target, "deploy")
  yield* workstation.say(`Deploying ${what}: \`${shown(call)}\`.`)
  const deployed = yield* workstation.hand(call.command, call.args, given)
  if (deployed !== 0) return yield* stop(`The deploy of ${what} failed; what it said is above.`)
  yield* workstation.say(
    Target.match(target, {
      "test-stage": () =>
        `Deployed ${stage}. Its address and testAccountPassword are in Alchemy's output above, shown to you only. Sign in as dana@example-works.test with that password. To remove the stage: \`bunx alchemy destroy --stage ${stage} --profile ${options.previewProfile}\`, yours to run.`,
      repository: () =>
        "Deployed the repository's stack. The next push to main that passes CI deploys staging; a pull request gets a preview.",
      production: () => "Deployed production. Open its address and sign up with your email."
    })
  )
  return found
})

const perform = (
  options: SetupOptions,
  found: Found
): ((step: Step) => Effect.Effect<Found, SetupStopped | RepoError, Workstation | Repo>) =>
  Step.match({
    PreviewPassword: () => previewPassword(options, found),
    Cloudflare: (step) => cloudflare(step.roles, options, found),
    Profile: (step) => profile(step.role, step.github, options, found),
    StateStore: (step) => stateStore(step.role, options, found),
    GitHubLogin: () => gitHubLogin(options, found),
    Deploy: (step) => deploy(step.target, options, found)
  })

/**
 * Runs the setup: a dry run prints its steps and starts nothing; a real run refuses anything but a person at a
 * terminal, then does each step in order and stops at the first one that cannot go on.
 */
export const setup = Effect.fn("InfraSetup.setup")(function* (options: SetupOptions) {
  const workstation = yield* Workstation
  if (!A.isReadonlyArrayNonEmpty(options.sizes)) {
    return yield* stop(
      "Say how much to set up: `--test-stage` (a test stage and its address), `--staging` (the repository's stack) or `--production`. `--dry-run` prints the steps and starts nothing."
    )
  }
  if (!/^[a-z0-9][-_a-z0-9]*$/.test(options.user)) {
    return yield* stop(
      `"test_${options.user}" is not a stage name (lower-case letters, digits, - and _). Pass \`--user <name>\`.`
    )
  }
  if (options.dryRun) {
    return yield* Effect.forEach(dryRun(options), workstation.say, { concurrency: 1, discard: true })
  }
  yield* ownerOnly
  const repo = yield* Repo
  const local = repo.join(repo.root, localEnvFile)
  const own = (yield* repo.exists(local)) ? yield* repo.text(local) : ""
  const token = referenceState({ text: own, name: previewTokenName })
  const accountId = referenceState({ text: own, name: previewAccountIdName })
  if (
    (token === "missing") !== (accountId === "missing") ||
    token === "not-a-reference" ||
    accountId === "not-a-reference"
  ) {
    return yield* stop(
      `${localEnvFile} must name both ${previewTokenName} and ${previewAccountIdName} as op:// references (a name with a space in quotes), or neither. Nothing was started; no line was printed.`
    )
  }
  const previewByToken = token === "reference"
  if (previewByToken && has(options.sizes, "staging")) {
    return yield* stop(
      `${localEnvFile} names a token for the previews' account, which serves a test stage there. The repository's stack does not use it: it makes both accounts' deploy tokens itself, with the one login it is deployed with, and that login does not reach the second account. Two ways on, both Benjamin's to choose: add production's login as a member of the second account, or change the stack to write a token he made as the previews' secret. Nothing was started.`
    )
  }
  const steps = stepsFor(options.sizes)
  yield* Effect.reduce(
    steps,
    (): Found => ({ ...nothingFound, previewByToken }),
    (found, step, index) =>
      workstation.say(`\nStep ${index + 1} of ${steps.length}.`).pipe(Effect.andThen(perform(options, found)(step)))
  )
  yield* workstation.say("\nDone. Nothing else was started.")
})
