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
 * - With no terminal, or with `CI` set, the command stops before its first step; only `--dry-run` runs without
 *   one, and it starts no tool at all. That keeps a workflow and a plain agent shell out. It does not prove a
 *   person: a program given a terminal passes it. So the rule that no agent runs this is a rule for agents, the
 *   command shows nothing secret itself (a test stage's minted password is left out of its deploy), and everything
 *   it makes waits for a yes.
 * - What the command tells its owner and what its children use come from one place. A variable that would outrank
 *   a profile or a 1Password reference, set in the shell or the root `.env`, stops the run before its first tool;
 *   each profile's own account is read and compared with the one named before anything is made with it; and every
 *   question that makes something names the account, by id, that it is about.
 * - A run again changes nothing it was not asked to: production's sign-up list and the emails that may open a
 *   preview are 1Password items the stacks ask for themselves (Benjamin, 2026-11-26), never a default, and a run
 *   without their references stops before step 1.
 * - Decision I4 holds until the owner says otherwise: production and the previews are two Cloudflare accounts, and
 *   a run that would give both roles to one account stops.
 *
 * @packageDocumentation
 */
import { $RepoCliId } from "@beep/identity/packages"
import { LiteralKit } from "@beep/schema/LiteralKit"
import * as A from "effect/Array"
import * as Config from "effect/Config"
import * as ConfigProvider from "effect/ConfigProvider"
import * as Effect from "effect/Effect"
import { pipe } from "effect/Function"
import * as O from "effect/Option"
import * as Result from "effect/Result"
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

/**
 * The variable of the emails that may open a preview, which the repository's stack writes to the `preview`
 * environment (`previewAccessVariable` in `@beep/infra`, kept in step by hand: tooling may not import it).
 */
export const previewAccessName = "PREVIEW_ACCESS"

/**
 * The variable of production's sign-up list, which the repository's stack writes to the `production` environment
 * and production's own stack reads (`signUpVariable` in `@beep/infra`, kept in step by hand).
 */
export const signUpName = "SIGN_UP"

/**
 * The repository on GitHub whose settings the repository's stack writes (`repository` in
 * `packages/infra/src/GitHub.stack.ts`; kept in step by hand, since nothing in the tooling may import the stack).
 * Every question this command puts to GitHub names it, so an answer never comes from a fork or another remote.
 */
export const gitHubRepository = "kriegcloud/inventory-import"

/**
 * Variables that would be used in place of what this command checks and says, were they set outside it. Alchemy
 * takes a provider's credentials from the process's environment and the root `.env` before it looks at any profile
 * (its `resolveProviderConfig`: "CI or not, selected profile or not"), for `plan`, `deploy` and `state bootstrap`
 * alike, and a stack's secret set in the shell wins over the reference 1Password is asked for. A GitHub host set
 * there sends gh's questions and Alchemy's GitHub calls to another server than the one the questions name, with that
 * server's own token. So the command stops before its first tool when one is set: what it tells its owner then is
 * what its children will use, because nothing else is left to use.
 */
export const outranking = (sizes: ReadonlyArray<SetupSize>): ReadonlyArray<string> => [
  "CLOUDFLARE_ACCOUNT_ID",
  "CLOUDFLARE_API_TOKEN",
  "CLOUDFLARE_API_KEY",
  "CLOUDFLARE_EMAIL",
  "CLOUDFLARE_ACCOUNT_EMAIL",
  ...(A.contains(sizes, "staging") || A.contains(sizes, "production")
    ? [
        modelKeyName,
        previewPasswordName,
        previewAccessName,
        signUpName,
        previewTokenName,
        previewAccountIdName,
        "OP_SERVICE_ACCOUNT_TOKEN",
        "GITHUB_ACCESS_TOKEN",
        "GITHUB_TOKEN",
        "GH_TOKEN",
        "GH_HOST",
        "GITHUB_BASE_URL",
        "GITHUB_API_URL",
        "GH_ENTERPRISE_TOKEN",
        "GITHUB_ENTERPRISE_TOKEN"
      ]
    : [])
]

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
    ),
    onePassword: S.Boolean.pipe(
      S.annotateKey({
        description:
          "Whether the profile must also reach 1Password: a stage whose plan reads a secret asks it through the profile"
      })
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
      ? [
          // A preview or staging stage run by hand from this profile asks 1Password for the previews' password.
          Step.cases.Profile.make({ role: "preview", github: false, onePassword: staging }),
          Step.cases.StateStore.make({ role: "preview" })
        ]
      : []),
    ...(test ? [Step.cases.Deploy.make({ target: "test-stage" })] : []),
    ...(prod
      ? [
          Step.cases.Profile.make({ role: "production", github: staging, onePassword: true }),
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
 * and said yes to this command's question about it. The stacks ask 1Password for their secrets themselves
 * (`packages/infra/src/OpReferences.secrets.ts`), so no call is wrapped in `op run`.
 */
const deployCall = (options: SetupOptions, target: Target, verb: "plan" | "deploy"): Call => {
  const yes = verb === "deploy" ? ["--yes"] : []
  return Target.match(target, {
    "test-stage": () => alchemy(verb, "--stage", stageOf(options, target), "--profile", options.previewProfile, ...yes),
    repository: () => alchemy(verb, repositoryStack, "--stage", "prod", "--profile", options.productionProfile, ...yes),
    production: () => alchemy(verb, "--stage", "prod", "--profile", options.productionProfile, ...yes)
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
 * Which file gives a stack a variable's reference, and whether the line it takes is one. The stacks read `op.env`
 * and then the owner's `op.env.local` as one text and take the last line of a name, a reference or not
 * (`referencesIn` in `@beep/infra`, which tooling may not import, so its rule is written again here and held to the
 * same cases by this package's tests): a name his own file has is that file's, and within a file the last line wins
 * over the ones above it. What this command says of a reference, and what it gives a deploy beside it, is read from
 * that same line.
 *
 * @example
 * referenceGiven({ committed: "A=op://v/i/f\n", own: "A=op://<vault>/<item>/<field>\nA=op://w/j/g\n", name: "A" })
 * // { state: "reference", file: localEnvFile }
 */
export const referenceGiven = (input: {
  readonly committed: string
  readonly own: string
  readonly name: string
}): { readonly state: ReferenceState; readonly file: string } => {
  const lastOf = (text: string) => A.findLast(linesOf(text), Str.startsWith(`${input.name}=`))
  const taken = O.match(lastOf(input.own), {
    onSome: (line) => O.some({ line, file: localEnvFile }),
    onNone: () => O.map(lastOf(input.committed), (line) => ({ line, file: opEnvFile }))
  })
  return O.match(taken, {
    onNone: () => ({ state: "missing", file: opEnvFile }),
    onSome: ({ line, file }) => ({
      state: isReference(Str.slice(input.name.length + 1)(line)) ? "reference" : "not-a-reference",
      file
    })
  })
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
 * An id Cloudflare gives an account or a token: 32 lower-case hexadecimal digits. Read from cf's answers and written
 * into `op.env` lines and GitHub variables, so nothing but those digits may pass: a newline, a `/` or a quote in one
 * would add a line or redirect a reference.
 *
 * @category schemas
 */
export const CloudflareId = S.String.check(S.isPattern(/^[0-9a-f]{32}$/)).pipe(
  $I.annoteSchema("CloudflareId", { description: "A Cloudflare account's or token's id: 32 lower-case hex digits" })
)

/**
 * An id 1Password gives a vault or an item: 26 lower-case letters and digits. A reference this command writes is
 * built from two of them (`op://<vault>/<item>/password`), so nothing else may pass.
 *
 * @category schemas
 */
export const OnePasswordId = S.String.check(S.isPattern(/^[a-z0-9]{26}$/)).pipe(
  $I.annoteSchema("OnePasswordId", {
    description: "A 1Password vault's or item's id: 26 lower-case letters and digits"
  })
)

/**
 * A Cloudflare account as `cf auth whoami` names it.
 *
 * @category schemas
 */
export class Account extends S.Class<Account, { readonly brand: unique symbol }>($I`Account`)(
  {
    id: CloudflareId.pipe(S.annotateKey({ description: "The account's id, which a stack and a token name it by" })),
    name: S.String.pipe(S.annotateKey({ description: "The account's name, as its owner reads it" }))
  },
  $I.annote("Account", { description: "One Cloudflare account the logged-in person can use" })
) {}

const WhoAmI = S.Struct({
  authenticated: S.Boolean,
  tokenValid: S.optionalKey(S.Boolean),
  accounts: S.Array(Account)
}).pipe($I.annoteSchema("WhoAmI", { description: "What `cf auth whoami` answers, as far as the setup reads it" }))

// Cloudflare's published schema of a zone gives its account an id and a name, both optional; one with no id names
// no account and is not read, one with no name is called by its id.
const Zone = S.Struct({
  account: S.Struct({ id: CloudflareId, name: S.String.pipe(S.NullOr, S.optionalKey) })
}).pipe(
  $I.annoteSchema("Zone", {
    description: "A zone as `cf zones list` names it: the account that holds it, nothing else"
  })
)

/** The question that names production's account: the one zone of that name that is active, in any account cf sees. */
const zoneCall: Call = { command: "cf", args: ["zones", "list", "--name", productionZone, "--status", "active"] }

const Named = S.Struct({ id: OnePasswordId, name: S.String }).pipe(
  $I.annoteSchema("Named", { description: "A 1Password vault: its id and name, nothing it holds" })
)

const Titled = S.Struct({ id: OnePasswordId, title: S.String }).pipe(
  $I.annoteSchema("Titled", { description: "A 1Password item: its id and title, none of its fields" })
)

/**
 * Whether a failed call's error lines are 1Password's own: `op` writes `[ERROR] <date> <time> <what>`, and a client
 * that never reached the app says "error initializing client". Read from op's error format, not seen in a test here.
 *
 * @example
 * onePasswordSaid("[ERROR] 2026/11/22 10:00:00 error initializing client: connecting to desktop app: read: connection reset") // true
 */
export const onePasswordSaid = (stderr: string): boolean =>
  A.some(linesOf(stderr), (line) => Str.startsWith("[ERROR] ")(line) || Str.includes("error initializing client")(line))

const reasonOf = (answer: { readonly stdout: string; readonly stderr: string }) => {
  const said = Str.trim(answer.stderr) === "" ? Str.trim(answer.stdout) : Str.trim(answer.stderr)
  return said === "" ? "no reason given" : said
}

/**
 * Whether op's lines say its client never reached the 1Password app, as in Benjamin's run ("error initializing
 * client: connecting to desktop app").
 *
 * @example
 * onePasswordUnreachable("[ERROR] 2026/11/22 10:00:00 error initializing client: connecting to desktop app: read: connection reset") // true
 * onePasswordUnreachable('[ERROR] 2026/11/22 10:00:00 could not read secret "op://v/i/f": no item matched') // false
 */
export const onePasswordUnreachable = (stderr: string): boolean =>
  A.some(
    linesOf(stderr),
    (line) => Str.includes("error initializing client")(line) || Str.includes("connecting to desktop app")(line)
  )

/** How a failure of op reads: the app never reached, the app reached and not letting the call through, a reference
 * it refused, or words that settle none of them. */
export const OnePasswordFailure = LiteralKit(["unreachable", "held", "refused", "unclear"]).pipe(
  $I.annoteSchema("OnePasswordFailure", {
    description:
      "How a failure of op reads: the app never reached, the app not letting the call through, a reference refused, or none of these said"
  })
)
export type OnePasswordFailure = typeof OnePasswordFailure.Type

// op's words for an app that is locked, a CLI that is not signed in, and an approval prompt dismissed or left to
// time out ("You are not currently signed in", "authorization prompt dismissed"). None was seen on this machine,
// so a line with none of these words and none of a reference's is said as either, never guessed.
const heldWords = ["not signed in", "not currently signed in", "is locked", "prompt dismissed", "timed out", "timeout"]
// op's words for a reference it read and could not fill: no such vault, item or field.
// Both lists are matched outside the names op quotes ("Cloudflare timeout token", 'op://v/i/f'): a vault, item or
// field may be named with any of these words, and its name says nothing about why op failed.
const refusedWords = [
  "isn't a vault",
  "isn't an item",
  "isn't a field",
  "could not resolve item",
  "no item matched",
  "invalid secret reference"
]

/**
 * Which failure op's lines say: an app never reached, one that did not let the call through (locked, signed out, a
 * prompt dismissed or timed out), a reference refused, or none of these said. The advice follows from it, so a
 * locked app is never sent to look at references that are fine.
 *
 * @example
 * onePasswordFailure("[ERROR] 2026/11/22 10:00:00 authorization prompt dismissed, please try again") // "held"
 * onePasswordFailure('[ERROR] 2026/11/22 10:00:00 "x" isn\'t an item in the "v" vault') // "refused"
 * onePasswordFailure('[ERROR] 2026/11/22 10:00:00 "Cloudflare timeout token" isn\'t an item in the "v" vault') // "refused"
 */
export const onePasswordFailure = (stderr: string): OnePasswordFailure => {
  // A quoted name ends at its own kind of quote followed by what op writes after one. A double-quoted name ends at
  // a quote before a colon, a space, a comma, a full stop or the end of the line, so an apostrophe in it ("James'
  // token") does not end it. A reference ends only at an apostrophe before the colon op writes after it, or the end
  // of the line: its vault, item and field may hold an apostrophe followed by a space ('op://Ops' tokens/i/f').
  const unquoted = A.map(
    linesOf(Str.toLowerCase(stderr)),
    Str.replaceAll(/".*?"(?=[\s:,.]|$)|'op:\/\/.*?'(?=:|$)/g, '""')
  )
  const says = (words: ReadonlyArray<string>) =>
    A.some(unquoted, (line) => A.some(words, (word) => Str.includes(word)(line)))
  if (onePasswordUnreachable(stderr)) return "unreachable"
  if (says(heldWords)) return "held"
  if (says(refusedWords)) return "refused"
  return "unclear"
}

/** Where to look when 1Password answered and refused: the reference a run fills, or the vault it lists or writes. */
const referencesRefused = `the references in ${localEnvFile} it fills (each names a vault, an item and a field that exist, with no template line left)`

/** What to do about an app op did not reach or that did not let a call through. */
const theApp = `open the 1Password app and unlock it, approve its prompt when it asks, check that Settings, Developer, "Integrate with 1Password CLI" is on, and run this again from your own terminal`

/**
 * The stop for a call 1Password failed: what op said (its error lines carry no value) and where to look, as
 * `onePasswordFailure` reads it. Where op's words settle nothing, both places are named. Nothing about the token or
 * the account is said, since nobody asked Cloudflare anything.
 */
const onePasswordFailed = (what: string, stderr: string, refused: string) => {
  const words = reasonOf({ stdout: "", stderr })
  return stop(
    OnePasswordFailure.match(onePasswordFailure(stderr), {
      unreachable: () =>
        `1Password did not answer, so ${what} was never asked: ${words}. To fix it, ${theApp}. Nothing was changed.`,
      held: () => `1Password did not let ${what} through: ${words}. To fix it, ${theApp}. Nothing was changed.`,
      refused: () => `1Password refused ${what}: ${words}. Check ${refused}, then run this again. Nothing was changed.`,
      unclear: () =>
        `1Password stopped ${what}: ${words}. Either the app was locked or its prompt went unanswered (${theApp}), or it refused (check ${refused}). Nothing was changed.`
    })
  )
}

/** Whether a failed call under `op-human` failed in 1Password: any failure of op itself, or op's lines from `op run`. */
const failedInOnePassword = (call: Call, stderr: string) =>
  call.command === "op-human" && (call.args[0] !== "run" || onePasswordSaid(stderr))

/**
 * A tool's JSON answer through a schema. 1Password not answering stops the run with op's words; a tool that answered
 * with an error, or with something the schema does not read, is a failure carrying a sentence that says which.
 */
const heard = Effect.fn("InfraSetup.heard")(function* <Sch extends S.ConstraintDecoder<unknown>>(
  schema: Sch,
  call: Call,
  what: string,
  refused: string = referencesRefused
) {
  const workstation = yield* Workstation
  const answer = yield* workstation.ask(call.command, call.args)
  const failure = (why: string): Result.Result<Sch["Type"], string> => Result.fail(why)
  if (answer.code !== 0) {
    if (failedInOnePassword(call, answer.stderr)) return yield* onePasswordFailed(what, answer.stderr, refused)
    return failure(`${what} failed: ${reasonOf(answer)}`)
  }
  return O.match(S.decodeOption(S.fromJsonString(schema))(answer.stdout), {
    onNone: () => failure(`${what} answered something this command cannot read`),
    onSome: (value): Result.Result<Sch["Type"], string> => Result.succeed(value)
  })
})

/** What the steps before one found, for the steps after it. */
export interface Found {
  readonly preview: O.Option<Account>
  readonly production: O.Option<Account>
  readonly approver: O.Option<string>
  /** Whether `op.env.local` names a token and an id for the previews' account: no login to it is then needed. */
  readonly previewByToken: boolean
  /** The account that holds production's zone, when cf could tell: production's, whoever is asked. */
  readonly zoneHolder: O.Option<Account>
  /** The id of the account each role's profile deploys into, once read from the profile itself. */
  readonly held: { readonly preview: O.Option<string>; readonly production: O.Option<string> }
}

const nothingFound: Found = {
  preview: O.none(),
  production: O.none(),
  approver: O.none(),
  previewByToken: false,
  zoneHolder: O.none(),
  held: { preview: O.none(), production: O.none() }
}

const accountOf = (found: Found, role: Role) =>
  Role.match(role, { preview: () => found.preview, production: () => found.production })

/**
 * The account a question is about, by the id its profile deploys into, with its name when cf gave one. Every
 * question that makes something says this, so a yes is always about an account he can tell from his others.
 */
const accountSaid = (found: Found, role: Role): string => {
  const id = Role.match(role, { preview: () => found.held.preview, production: () => found.held.production })
  const name = O.map(accountOf(found, role), (account) => `"${account.name}"`)
  const which = role === "preview" ? "the previews'" : "production's"
  return O.match(id, {
    onNone: () => O.match(name, { onNone: () => `${which} account`, onSome: (said) => `the account ${said}` }),
    onSome: (held) =>
      O.match(name, {
        onNone: () => `the account ${held} (${which})`,
        onSome: (said) => `the account ${said} (${held})`
      })
  })
}

/** Variables a deploy is given beside the references 1Password fills: names, ids and a flag, none of them secret. */
export const givenFor = (input: {
  readonly target: Target
  readonly found: Found
  readonly options: SetupOptions
  readonly modelKey: ReferenceState
}): Given => {
  const withoutKey: Given = input.modelKey === "reference" ? {} : { DEPLOY_WITHOUT_MODEL_KEY: "true" }
  return Target.match(input.target, {
    // A terminal is not proof of a person, so this command's deploy asks the stack to leave the minted password out.
    "test-stage": (): Given => ({ HIDE_TEST_ACCOUNT_PASSWORD: "true" }),
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
      ...withoutKey
    }),
    production: (): Given => withoutKey
  })
}

const givenNames: Readonly<Record<Target, ReadonlyArray<string>>> = {
  "test-stage": [],
  repository: ["PRODUCTION_CLOUDFLARE_ACCOUNT_ID", "PREVIEW_CLOUDFLARE_ACCOUNT_ID", "PRODUCTION_APPROVER"],
  production: []
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
      `  ${shown(zoneCall)}   (the account that holds it is production's; you are shown both roles and asked. With --staging or --production, a run stops when cf cannot name that account)`
    ],
    Profile: (step) => {
      const name = profileOf(options, step.role)
      return [
        `Alchemy profile "${name}" (${step.role} account), connected to Cloudflare${step.github ? ", GitHub" : ""}${step.onePassword ? " and 1Password" : ""}. One that is there and connected is left alone.`,
        "  bunx alchemy profile list",
        `  bunx alchemy profile show --profile ${name}   (which account it deploys into, compared with the one named before anything is made)`,
        `  bunx alchemy profile create ${name}   (only when there is none)`,
        `  bunx alchemy profile edit --profile ${name} --add Cloudflare${step.github ? " --add GitHub" : ""}${step.onePassword ? " --add 1Password" : ""}   (only what is not connected; the browser login and the account are yours to pick)`
      ]
    },
    StateStore: (step) => [
      `The state store in the ${step.role} account: asks first, then makes it or adopts the one that is there.`,
      `  bunx alchemy state bootstrap --profile ${profileOf(options, step.role)}   (an account with no workers.dev subdomain yet fails here; the stop says so)`
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
        ...given,
        ...(step.target === "repository"
          ? [
              `  the stack asks 1Password itself for the previews' password, the model key, ${previewAccessName} (who may open a preview), ${signUpName} (production's sign-up list), and your own token and account id for the previews' account (${localEnvFile}); it writes the two lists to GitHub as secrets, writes that token for previews and staging, and makes none there`
            ]
          : [])
      ]
    }
  })

/**
 * One argument as a POSIX shell reads it back: in single quotes, each single quote inside written `'\''`.
 *
 * @example
 * shellQuoted("printf 'a' x") // "'printf '\\''a'\\'' x'"
 */
export const shellQuoted = (argument: string): string => `'${Str.replaceAll("'", "'\\''")(argument)}'`

/** Which file a stack takes a variable's line from, and whether that line is a reference (`referenceGiven`). */
type TakenLine = ReturnType<typeof referenceGiven>

/**
 * The stop a run makes before step 1 on what op.env and op.env.local hold, if it makes one: a line of op.env that is
 * not a reference, his token's names taken from op.env, one of the two names without the other or not a reference,
 * and staging without them. The run stops with it and the dry run says it, so the two never differ.
 */
export const filesStop = (input: {
  readonly committed: string
  readonly token: TakenLine
  readonly accountId: TakenLine
  /** The lines the stacks take the emails that may open a preview, and production's sign-up list, from. */
  readonly access: TakenLine
  readonly signUp: TakenLine
  readonly previewByToken: boolean
  readonly sizes: ReadonlyArray<SetupSize>
}): O.Option<string> => {
  const { token, accountId } = input
  // The tracked file holds comments and references and nothing else: a value typed there in any form would be
  // committed with the reference this command writes, so any other line stops the run before it writes or says so.
  const stray = strayLines(input.committed)
  if (A.isReadonlyArrayNonEmpty(stray)) {
    return O.some(
      `${opEnvFile} is tracked by git and holds only comments and lines NAME=op://vault/item/field. Line ${A.join(A.map(stray, String), ", ")} is neither. If a value was typed there, take it out (and change it wherever it came from if the file was ever committed), then run this again. Nothing was started; no line was printed.`
    )
  }
  // His token's references are his own: the commands that use them read op.env.local alone, and op.env is public.
  const misplaced = A.filterMap(
    [
      [previewTokenName, token],
      [previewAccountIdName, accountId]
    ] as const,
    ([name, given]) => (given.file === opEnvFile && given.state !== "missing" ? Result.succeed(name) : Result.failVoid)
  )
  if (A.isReadonlyArrayNonEmpty(misplaced)) {
    const one = misplaced.length === 1
    return O.some(
      `${opEnvFile} names ${A.join(misplaced, " and ")}, and the repository's stack would take ${one ? "it" : "them"} from there. Your own token's references go in ${localEnvFile} (git ignores it): move ${one ? "that line" : "both lines"} there, then run this again. Nothing was started.`
    )
  }
  if (
    (token.state === "missing") !== (accountId.state === "missing") ||
    token.state === "not-a-reference" ||
    accountId.state === "not-a-reference"
  ) {
    return O.some(
      `${localEnvFile} must name both ${previewTokenName} and ${previewAccountIdName} as op:// references (a name with a space in quotes), or neither; the last line of each name is the one taken. Nothing was started; no line was printed.`
    )
  }
  if (!input.previewByToken && has(input.sizes, "staging")) {
    return O.some(
      `The repository's stack gives previews and staging your own token for the previews' account, and makes none there. Write ${previewTokenName}="op://<vault>/<item>/<field>" and ${previewAccountIdName}="op://<vault>/<item>/<field>" into ${localEnvFile} (git ignores it), then run this again. Nothing was started.`
    )
  }
  // The two lists of emails are 1Password items the stacks ask for themselves (Benjamin, 2026-11-26): the repository's
  // stack writes both to GitHub, production's own reads its sign-up list. Without a reference a run stops here, never
  // with a default, so a run again cannot close production or leave the previews open.
  const lists = A.filter(
    [
      [previewAccessName, input.access, has(input.sizes, "staging"), "the emails that may open a preview"],
      [
        signUpName,
        input.signUp,
        has(input.sizes, "staging") || has(input.sizes, "production"),
        "production's sign-up list (emails, or closed)"
      ]
    ] as const,
    ([, line, needed]) => needed && line.state !== "reference"
  )
  if (A.isReadonlyArrayNonEmpty(lists)) {
    const lines = A.join(
      A.map(lists, ([name]) => `${name}="op://<vault>/<item>/<field>"`),
      " and "
    )
    const what = A.join(
      A.map(lists, ([name, , , said]) => `${name}, ${said}`),
      "; "
    )
    return O.some(
      `The stacks ask 1Password for ${what}, on one line separated by commas. Make ${lists.length === 1 ? "a 1Password item whose field holds it" : "a 1Password item for each, whose field holds the list"}, write ${lines} into ${localEnvFile} (git ignores it), then run this again. Nothing was started; no line was printed.`
    )
  }
  return O.none()
}

/** What `--dry-run` prints: every step in order, and that nothing was started. */
export const dryRun = (input: {
  readonly options: SetupOptions
  /** Whether his own file names the previews' token: a run then asks cf nothing about that account. */
  readonly previewByToken: boolean
  /** The stop a run would make before step 1 on the two files as they are (`filesStop`). */
  readonly stopsBefore?: O.Option<string>
}): ReadonlyArray<string> => {
  const { options, previewByToken } = input
  return [
    "Dry run: nothing is started and nothing is written. A run would do these steps, in this order:",
    `A run stops before its first tool when one of these is set in your shell or named in the root .env, since a deploy would use it in place of what the run checks: ${A.join(outranking(options.sizes), ", ")}.`,
    ...O.match(input.stopsBefore ?? O.none(), {
      onNone: () => [],
      onSome: (said) => [`As things are, a run stops before step 1: ${said}`]
    }),
    ...(previewByToken
      ? [
          `Before step 1, the previews' token (${localEnvFile}) is checked, and the previews' account is asked of cf in no step:`,
          `  op-human run --env-file ${localEnvFile} -- sh -c 'CLOUDFLARE_API_TOKEN="$${previewTokenName}" CLOUDFLARE_ACCOUNT_ID="$${previewAccountIdName}" cf accounts tokens verify'`,
          `  op-human run --env-file ${localEnvFile} -- sh -c '… cf accounts tokens get <token id>'`,
          `  ${shown({ command: subdomainCall.command, args: A.take(subdomainCall.args, 6) })} ${shellQuoted(A.last(subdomainCall.args).pipe(O.getOrElse(() => "")))}   (the account's workers.dev subdomain, which Alchemy's state store needs: a run stops when there is none yet)`,
          `  and the previews' profile is connected with: op-human run --env-file ${localEnvFile} -- bunx alchemy profile edit --profile ${options.previewProfile} --add Cloudflare --method stored --set apiToken=env:${previewTokenName} --set accountId=env:${previewAccountIdName}`
        ]
      : []),
    ...A.flatMap(stepsFor(options.sizes), (step, index) => {
      const [first, ...rest] = described(options)(step)
      return [`${index + 1}. ${first ?? ""}`, ...rest]
    })
  ]
}

/**
 * The numbers of the lines of a references file that are neither blank, nor a comment, nor `NAME=op://…`. Such a
 * line is where a value typed by mistake would sit, whatever its form (`export NAME=…`, `NAME = …`, another name).
 *
 * @example
 * strayLines("# a comment\nA=op://v/i/f\nexport B=hunter2\n") // [3]
 */
export const strayLines = (text: string): ReadonlyArray<number> =>
  A.flatMap(linesOf(text), (line, index) => {
    if (line === "" || Str.startsWith("#")(line)) return []
    const reference = O.exists(Str.match(/^[A-Z][A-Z0-9_]*=(.*)$/)(line), (found) => isReference(`${found[1]}`))
    return reference ? [] : [index + 1]
  })

/**
 * The names a `.env` file sets, whatever it sets them to.
 *
 * @example
 * namesIn("# c\nA=1\nexport B = 2\n") // ["A", "B"]
 */
export const namesIn = (dotenv: string): ReadonlyArray<string> =>
  A.flatMap(linesOf(dotenv), (line) =>
    O.match(Str.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/)(line), {
      onNone: () => [],
      onSome: (found) => [`${found[1]}`]
    })
  )

/**
 * The root's env files that `bun run` loads into this command's environment before it starts, as Bun 1.4 does with no
 * `env` setting in `bunfig.toml`: `.env`, the one for `NODE_ENV` (development when it is unset), and `.env.local`
 * except under test. Alchemy reads the root `.env` itself too. A variable set in the shell is kept over a file's.
 *
 * @example
 * envFilesFor(O.none()) // [".env", ".env.development", ".env.local"]
 */
export const envFilesFor = (nodeEnv: O.Option<string>): ReadonlyArray<string> => {
  const mode = O.getOrElse(
    O.filter(nodeEnv, (value) => value !== ""),
    () => "development"
  )
  return [".env", `.env.${mode}`, ...(mode === "test" ? [] : [".env.local"])]
}

/**
 * Stops when a variable that would outrank what this command checks is set in the shell or in a root env file
 * (`outranking`). It names each variable and where it is set, and never reads a value into a line: a variable that
 * is set and empty is named too, since what a tool makes of one differs from tool to tool. A name a file sets is
 * said to be that file's, not the shell's: Bun put it in the environment, and `env -u` cannot take it out, because
 * Bun loads the file again.
 */
const outside = Effect.fn("InfraSetup.outside")(function* (options: SetupOptions) {
  const repo = yield* Repo
  const names = outranking(options.sizes)
  const shell = ConfigProvider.fromEnv({ preserveEmptyStrings: true })
  const variable = (name: string) =>
    Config.String(name)
      .pipe(Config.option)
      .parse(shell)
      .pipe(Effect.orElseSucceed(() => O.none<string>()))
  const nodeEnv = yield* variable("NODE_ENV")
  const files = envFilesFor(nodeEnv)
  const inFiles = yield* Effect.forEach(
    files,
    (file) =>
      Effect.gen(function* () {
        const path = repo.join(repo.root, file)
        const text = (yield* repo.exists(path)) ? yield* repo.text(path) : ""
        return { file, names: namesIn(text) }
      }),
    { concurrency: 1 }
  )
  const placed = yield* Effect.forEach(
    names,
    (name) =>
      Effect.gen(function* () {
        const where = A.flatMap(inFiles, (one) => (A.contains(one.names, name) ? [`the root ${one.file}`] : []))
        if (A.isReadonlyArrayNonEmpty(where)) return [`${name} (${A.join(where, ", ")})`]
        const inShell = yield* variable(name)
        return O.isSome(inShell) ? [`${name} (your shell)`] : []
      }),
    { concurrency: 1 }
  )
  const set = A.flatten(placed)
  if (A.isReadonlyArrayNonEmpty(set)) {
    return yield* stop(
      `Set outside this command: ${A.join(set, ", ")}. Alchemy uses credentials from the environment and the root .env before any profile, and a secret set there before the one 1Password is asked for, so the deploy would not use what this command checks and tells you. Take ${set.length === 1 ? "it" : "them"} out of the file named (Bun loads a root env file into every \`bun run\`, so \`env -u\` cannot), or unset ${set.length === 1 ? "it" : "them"} in your shell for this run (\`env -u NAME ... bun run beep infra setup ...\`), then run this again. Nothing was started; no value was printed.`
    )
  }
})

/**
 * Stops unless the command is at a terminal with `CI` unset. This keeps a workflow and a plain agent shell out. It
 * is not proof of a person: a program given a terminal passes it, so nothing secret is shown through this command
 * (a test stage's minted password is left out of its deploy), and every thing made waits for a yes.
 */
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

/**
 * The account for one role: the one the flag names, the only one after a yes, or the one he picks. However it was
 * come by, an account that holds production's zone is used for previews only after a yes to a question that says so.
 */
const pick = Effect.fn("InfraSetup.pick")(function* (input: {
  readonly role: Role
  readonly wanted: O.Option<string>
  readonly accounts: A.NonEmptyReadonlyArray<Account>
  /** The account that holds production's zone, when cf could tell. */
  readonly holder: O.Option<Account>
}) {
  const workstation = yield* Workstation
  const { role, wanted, accounts } = input
  const holds = (account: Account) => O.exists(input.holder, (holder) => holder.id === account.id)
  const shared = (account: Account) => role === "preview" && holds(account)
  const note = ` It holds the zone ${productionZone}, so it is production's account: a test stage here shares it.`
  const [only, ...others] = accounts
  if (O.isNone(wanted) && !A.isReadonlyArrayNonEmpty(others)) {
    const yes = yield* workstation.confirm(
      `Use the Cloudflare account "${only.name}" for ${role}?${shared(only) ? note : ""}`
    )
    if (!yes) return yield* stop(`Stopped: no Cloudflare account for ${role}.`)
    return only
  }
  const chosen = yield* O.match(wanted, {
    onSome: (name) =>
      O.match(
        A.findFirst(accounts, (account) => account.id === name || account.name === name),
        {
          onNone: () => stop(`No Cloudflare account named "${name}" for ${role}: cf sees ${named(accounts)}.`),
          onSome: (account) => Effect.succeed(account)
        }
      ),
    onNone: () =>
      workstation
        .choose(
          `Which Cloudflare account is for ${role}?`,
          A.map(accounts, (account) => ({
            title: holds(account) ? `${account.name} (holds ${productionZone})` : account.name,
            value: account.id
          }))
        )
        .pipe(
          Effect.map((id) =>
            O.getOrElse(
              A.findFirst(accounts, (account) => account.id === id),
              () => only
            )
          )
        )
  })
  if (shared(chosen)) {
    const yes = yield* workstation.confirm(`Use the Cloudflare account "${chosen.name}" for ${role}?${note}`)
    if (!yes) return yield* stop(`Stopped: no Cloudflare account for ${role}.`)
  }
  return chosen
})

const cloudflare = Effect.fn("InfraSetup.cloudflare")(function* (
  wantedRoles: ReadonlyArray<Role>,
  options: SetupOptions,
  found: Found
) {
  const workstation = yield* Workstation
  if (found.previewByToken) {
    yield* workstation.say(
      `Cloudflare: the previews' account is the one ${localEnvFile} names a token and an id for. No login to it is needed: cf is asked only, if it is logged in, which account holds the zone ${productionZone}.`
    )
  }
  const roles = found.previewByToken ? A.filter(wantedRoles, (role) => role !== "preview") : wantedRoles
  // cf logged out answers with an error, so any failure here is read as not logged in, and a login is started.
  const whoAmI = heard(WhoAmI, { command: "cf", args: ["auth", "whoami"] }, "`cf auth whoami`").pipe(
    Effect.map(Result.getSuccess)
  )
  // Which account holds the zone, or why cf could not say: an error is shown in cf's words, not as "in no account".
  const zoneAsked = heard(S.Array(Zone), zoneCall, `\`${shown(zoneCall)}\``)
  const holderOf = (asked: Result.Result<ReadonlyArray<typeof Zone.Type>, string>) =>
    pipe(
      Result.getSuccess(asked),
      O.flatMap((zones) => (zones.length === 1 ? A.head(zones) : O.none())),
      O.map(({ account }) =>
        Account.make({ id: account.id, name: O.getOrElse(O.fromNullishOr(account.name), () => account.id) })
      )
    )
  const unheard = (asked: Result.Result<ReadonlyArray<typeof Zone.Type>, string>) =>
    O.match(Result.getFailure(asked), { onNone: () => "", onSome: (why) => ` (${why})` })
  if (!A.isReadonlyArrayNonEmpty(roles)) {
    // No account is asked of cf here, and no login is started for it. If cf happens to be logged in, though, it can
    // say which account holds production's zone, which is what the token's account is then held against.
    const looked = yield* whoAmI
    const zone = pipe(looked, loggedIn, O.isSome) ? yield* Effect.asSome(zoneAsked) : O.none()
    const holder = O.flatMap(zone, holderOf)
    const failed = O.match(zone, { onNone: () => "", onSome: unheard })
    yield* workstation.say(
      O.match(holder, {
        onSome: (account) =>
          `Cloudflare: cf says "${account.name}" (${account.id}) holds the zone ${productionZone}: that one is production's account.`,
        onNone: () =>
          failed === ""
            ? `Cloudflare: cf is not logged in to an account that holds the zone ${productionZone}, so it cannot say which account is production's.`
            : `Cloudflare: cf could not say which account holds the zone ${productionZone}${failed}.`
      })
    )
    return { ...found, zoneHolder: holder }
  }
  const looked = yield* whoAmI
  const first = loggedIn(looked)
  if (O.isNone(first)) {
    yield* workstation.say("Cloudflare: cf is not logged in. Starting `cf auth login`: approve it in the browser.")
    const code = yield* workstation.hand("cf", ["auth", "login"])
    if (code !== 0) return yield* stop("`cf auth login` did not finish. Run this again.")
  }
  const again = O.isSome(first) ? first : yield* whoAmI
  const who = loggedIn(again)
  if (O.isNone(who)) {
    return yield* stop("cf is still not logged in (`cf auth whoami`). Run this again.")
  }
  const accounts = who.value.accounts
  if (!A.isReadonlyArrayNonEmpty(accounts)) {
    return yield* stop("cf is logged in and sees no Cloudflare account.")
  }
  yield* workstation.say(
    `Cloudflare: cf is logged in and sees ${accounts.length === 1 ? "one account" : `${accounts.length} accounts`}: ${named(accounts)}.`
  )
  const asked = yield* zoneAsked
  const holder = holderOf(asked)
  yield* workstation.say(
    O.match(holder, {
      onSome: (account) =>
        `Cloudflare: "${account.name}" holds the zone ${productionZone}, so it is production's account.`,
      onNone: () => `Cloudflare: cf could not tell which account holds the zone ${productionZone}${unheard(asked)}.`
    })
  )
  // Production's address is on the zone, so production's account is the one that holds it. When cf cannot name that
  // account (logged in to another one, or the zone is active in none it sees), nothing here can tell production's
  // account from the previews', and decision I4 rests on telling them apart: the run stops instead of guessing.
  if (A.contains(roles, "production") && O.isNone(holder)) {
    return yield* stop(
      `cf cannot name the account that holds the zone ${productionZone} (\`${shown(zoneCall)}\` found it active in none of the accounts it sees, or did not answer${unheard(asked)}). That account is production's, and the setup of production or of the repository's stack does not go on without it: log cf in to the account that holds the zone (\`cf auth login\`), then run this again. Nothing was made.`
    )
  }
  const both = A.contains(roles, "preview") && A.contains(roles, "production")
  const sameAccount =
    "Production and the previews are two Cloudflare accounts (decision I4): a preview's deploy token covers its whole account, so in one account every pull request's run could change or remove production."
  if (both && accounts.length === 1) {
    return yield* stop(
      `cf sees one account. ${sameAccount} Name the second account's token and id in ${localEnvFile}: previews and test stages then go there with no login.`
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
        "Stopped: the accounts were not confirmed. Name them with `--production-account` and `--preview-account`."
      )
    }
    return { ...found, preview: O.some(previews), production: holder, zoneHolder: holder }
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
  // Production's address is on the zone, so an account named for production that does not hold it is a mistake.
  if (O.isSome(production) && O.isSome(holder) && production.value.id !== holder.value.id) {
    return yield* stop(
      `"${production.value.name}" was named for production, but "${holder.value.name}" holds the zone ${productionZone}. Production's account is the one that holds it: name that one, or leave the flag out.`
    )
  }
  if (both && O.isSome(preview) && O.isSome(production)) {
    const yes = yield* workstation.confirm(
      `Use "${production.value.name}" for production and "${preview.value.name}" for previews, test stages and staging?`
    )
    if (!yes) return yield* stop("Stopped: the accounts were not confirmed.")
  }
  return { ...found, preview, production, zoneHolder: holder }
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

const Verified = S.Struct({ id: CloudflareId, status: S.String }).pipe(
  $I.annoteSchema("Verified", { description: "What `cf accounts tokens verify` answers: the token's id and status" })
)

const Permitted = S.Struct({
  policies: S.Array(S.Struct({ effect: S.String, permission_groups: S.Array(S.Struct({ name: S.String })) }))
}).pipe($I.annoteSchema("Permitted", { description: "A token's policies: what each allows, by permission group" }))

/**
 * The question that asks Cloudflare for the previews' account's workers.dev subdomain, the one Alchemy's state store
 * asks (`GET /accounts/{id}/workers/subdomain`, in `resolveAccountId`) before it says the account "can't" be
 * accessed whatever the cause. cf has no command for it, so curl asks, under 1Password like the other calls of that
 * account; the token goes to curl on its input through the shell's own printf, never in an argument.
 */
export const subdomainCall: Call = {
  command: "op-human",
  args: [
    "run",
    "--env-file",
    localEnvFile,
    "--",
    "sh",
    "-c",
    `printf 'Authorization: Bearer %s\\n' "$${previewTokenName}" | curl -sS -H @- "https://api.cloudflare.com/client/v4/accounts/$${previewAccountIdName}/workers/subdomain"`
  ]
}

const Answered = S.Struct({
  success: S.Boolean,
  errors: S.Array(S.Struct({ code: S.Int, message: S.String })),
  result: S.Struct({ subdomain: S.String }).pipe(S.NullOr, S.optionalKey)
}).pipe(
  $I.annoteSchema("Answered", {
    description: "Cloudflare's answer to the workers.dev subdomain question: the subdomain, or its errors by code"
  })
)

/** Cloudflare's code for an account with no workers.dev subdomain yet (cf's own source reads it so). */
const noSubdomainYet = 10007
/** Cloudflare's code for a request the token is not allowed. */
const notAuthorized = 10000

/**
 * What a run says of the previews' workers.dev subdomain, from Cloudflare's answer: none yet, a token not allowed to
 * ask, or Cloudflare's own words. A new account has none until he picks one, and Alchemy then reports only that the
 * account cannot be accessed.
 *
 * @example
 * subdomainSaid({ success: false, errors: [{ code: 10007, message: "workers.api.error.subdomain_not_found" }] }) // Result.fail("… no workers.dev subdomain yet …")
 */
export const subdomainSaid = (answer: typeof Answered.Type): Result.Result<string, string> => {
  const subdomain = O.map(O.fromNullishOr(answer.result), (result) => result.subdomain)
  if (answer.success && O.isSome(subdomain)) {
    return Result.succeed(
      `Cloudflare: the previews' account has its workers.dev subdomain, ${subdomain.value}.workers.dev.`
    )
  }
  const codes = A.map(answer.errors, (error) => error.code)
  if (A.contains(codes, noSubdomainYet)) {
    return Result.fail(
      "The previews' account has no workers.dev subdomain yet, and Alchemy's state store and every preview and test stage live on one; without it the state store says only that the account cannot be accessed. Pick one in the Cloudflare dashboard: open the previews' account, Workers & Pages, and choose its workers.dev subdomain. Then run this again. Nothing was changed."
    )
  }
  if (A.contains(codes, notAuthorized)) {
    return Result.fail(
      `Cloudflare answered ${notAuthorized} (not authorized): the previews' token may not read the account's workers.dev subdomain, which takes the Workers Scripts permission (Read, or the Write a deploy needs) on that account. Give the token Workers Scripts Write on the previews' account in the dashboard, then run this again. Nothing was changed.`
    )
  }
  const words = A.map(answer.errors, (error) => `${error.code}: ${error.message}`)
  return Result.fail(
    `Cloudflare would not give the previews' account's workers.dev subdomain: ${A.isReadonlyArrayNonEmpty(words) ? A.join(words, "; ") : "no reason given"}. Nothing was changed.`
  )
}

/**
 * Whether the previews' token works and is allowed what a deploy needs, and its account has the workers.dev
 * subdomain the state store needs, said before anything is made with it. A token that cannot show its own
 * permissions, or lacks one, is his to go on with or not; an account with no subdomain stops the run.
 */
const tokenChecked = Effect.gen(function* () {
  const workstation = yield* Workstation
  const verified = yield* heard(Verified, asPreviews("cf accounts tokens verify"), "`cf accounts tokens verify`")
  if (Result.isFailure(verified)) {
    return yield* stop(
      `The token ${localEnvFile} names for the previews' account was not verified: ${verified.failure}. That decides nothing about the token: if cf's words are about it, check ${previewTokenName} and ${previewAccountIdName} there; if they are about the network or cf itself, run this again. Nothing was changed.`
    )
  }
  if (verified.success.status !== "active") {
    return yield* stop(
      `cf says the token ${localEnvFile} names for the previews' account is "${verified.success.status}", not active (\`cf accounts tokens verify\`). Check ${previewTokenName} there, or the token in the dashboard. Nothing was changed.`
    )
  }
  // The token's id is a CloudflareId by the time it is read: one that is not was refused as unreadable above.
  const needs = A.join(previewTokenNeeds, ", ")
  const getCall = `cf accounts tokens get ${verified.success.id}`
  const permitted = yield* heard(Permitted, asPreviews(getCall), `\`${getCall}\``)
  const lacking = Result.map(permitted, (token) => {
    const allowed = A.flatMap(token.policies, (policy) =>
      policy.effect === "allow" ? A.map(policy.permission_groups, (group) => group.name) : []
    )
    return A.filter(previewTokenNeeds, (need) => !A.contains(allowed, need))
  })
  if (Result.isSuccess(lacking) && !A.isReadonlyArrayNonEmpty(lacking.success)) {
    yield* workstation.say(`Cloudflare: the previews' token is active and allows what a deploy needs (${needs}).`)
  } else {
    yield* workstation.say(
      Result.match(lacking, {
        onFailure: (why) =>
          `Cloudflare: the previews' token is active, but its permissions were not shown (${why}), so they were not checked. A deploy needs: ${needs}.`,
        onSuccess: (missing) =>
          `Cloudflare: the previews' token is active and lacks: ${A.join(missing, ", ")}. A deploy needs: ${needs}. Add them to the token in the dashboard, or go on if the names differ there.`
      })
    )
    const yes = yield* workstation.confirm("Go on with this token?")
    if (!yes) return yield* stop("Stopped at the previews' token. Nothing was changed.")
  }
  const subdomain = yield* heard(Answered, subdomainCall, "Cloudflare's workers.dev subdomain question")
  if (Result.isFailure(subdomain)) {
    return yield* stop(
      `Cloudflare could not be asked for the previews' account's workers.dev subdomain: ${subdomain.failure}. Nothing was changed.`
    )
  }
  const said = subdomainSaid(subdomain.success)
  if (Result.isFailure(said)) return yield* stop(said.failure)
  yield* workstation.say(said.success)
})

const profileConnected = Effect.fn("InfraSetup.profileConnected")(function* (
  step: { readonly role: Role; readonly github: boolean; readonly onePassword: boolean },
  options: SetupOptions,
  found: Found
) {
  const { role, github } = step
  const workstation = yield* Workstation
  const name = profileOf(options, role)
  const wanted = ["Cloudflare", ...(github ? ["GitHub"] : []), ...(step.onePassword ? ["1Password"] : [])]
  const listed = Effect.gen(function* () {
    const answer = yield* workstation.ask("bunx", ["alchemy", "profile", "list"])
    if (answer.code !== 0) {
      return yield* stop(`\`bunx alchemy profile list\` failed: ${Str.trim(answer.stderr)}.`)
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
  const byToken = role === "preview" && found.previewByToken
  if (byToken && A.contains(toConnect, "Cloudflare")) {
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
    if (stored !== 0) {
      return yield* stop(
        `Connecting profile "${name}" did not finish; what it said is above. If those are 1Password's lines ("[ERROR] …"), Alchemy was never started. When they say op never reached the app ("error initializing client"), that it is locked or not signed in, or that a prompt was dismissed or timed out, ${theApp}. When they say ${A.join(
          A.map(refusedWords, (word) => `"${word}"`),
          ", "
        )}, 1Password refused a reference: check ${referencesRefused}. Any other line of 1Password's may be either: try both, then run this again.`
      )
    }
    const now = yield* listed
    if (!O.exists(now, (one) => connected(one.providers, "Cloudflare"))) {
      return yield* stop(`Profile "${name}" is still not connected to Cloudflare. Run this again.`)
    }
  }
  // By his token the profile needs no login to Cloudflare; whatever else it must reach is connected the usual way.
  const remaining = byToken ? A.filter(toConnect, (provider) => provider !== "Cloudflare") : toConnect
  if (!A.isReadonlyArrayNonEmpty(remaining)) return found
  const account = O.match(accountOf(found, role), { onNone: () => "", onSome: (one) => ` "${one.name}"` })
  yield* workstation.say(
    `Alchemy: connecting profile "${name}" to ${A.join(remaining, " and ")}. Yours to do: approve the login in the browser${
      A.contains(remaining, "Cloudflare")
        ? `, and if Alchemy asks which account, pick${account} (the ${role} account)`
        : ""
    }${A.contains(remaining, "GitHub") ? "; for GitHub pick gh-cli" : ""}${
      A.contains(remaining, "1Password")
        ? '; for 1Password pick the desktop app and your account (in the app, Settings, Developer, "Integrate with other apps" must be on)'
        : ""
    }.`
  )
  const code = yield* workstation.hand("bunx", [
    "alchemy",
    "profile",
    "edit",
    "--profile",
    name,
    ...A.flatMap(remaining, (provider) => ["--add", provider])
  ])
  if (code !== 0) return yield* stop(`Connecting profile "${name}" did not finish. Run this again.`)
  const after = yield* listed
  const still = missing(O.match(after, { onNone: () => "", onSome: (one) => one.providers }))
  if (A.isReadonlyArrayNonEmpty(still)) {
    return yield* stop(`Profile "${name}" is still not connected to ${A.join(still, " and ")}. Run this again.`)
  }
  return found
})

/**
 * The Cloudflare account id `alchemy profile show` gives for a profile. Only that one line is kept: the rest of what
 * the tool prints there (part of a token among it) is dropped unread.
 *
 * @example
 * accountIn("- p\n  Cloudflare (oauth) — ok\n    accountId: 0123456789abcdef0123456789abcdef") // the id
 */
export const accountIn = (shown: string): O.Option<string> => {
  const lines = Str.split("\n")(shown)
  return A.findFirstIndex(lines, (line) => /^ {2}Cloudflare \(/.test(line)).pipe(
    O.map((at) => A.takeWhile(A.drop(lines, at + 1), (line) => /^ {4}/.test(line))),
    O.flatMap(A.findFirst((line) => /^ {4}accountId: \S+\s*$/.test(line))),
    O.map((line) => Str.trim(Str.slice(15)(line)))
  )
}

/**
 * Stops unless the profile deploys into the account the questions name, and hands on the id it deploys into. Every
 * bootstrap and deploy runs with `--profile`, and nothing in the environment outranks the profile (`outside`), so
 * the profile's own account is the one deployed into. The previews' account must not be the one that holds
 * production's zone: a test stage alone may share it after a yes to a question that says so, and a run with
 * `--staging` or `--production` stops (decision I4), as it does when the two profiles deploy into one account or
 * the other profile's account cannot be read.
 */
const profileAccountChecked = Effect.fn("InfraSetup.profileAccountChecked")(function* (
  role: Role,
  options: SetupOptions,
  found: Found
) {
  const workstation = yield* Workstation
  const name = profileOf(options, role)
  const heldBy = Effect.fn("InfraSetup.heldBy")(function* (profileName: string) {
    const answer = yield* workstation.ask("bunx", ["alchemy", "profile", "show", "--profile", profileName])
    return answer.code === 0 ? accountIn(answer.stdout) : O.none<string>()
  })
  const reconnect = `Connect it to the right one with \`bunx alchemy profile edit --profile ${name} --reconfigure Cloudflare\`, then run this again.`
  const held = yield* heldBy(name)
  if (O.isNone(held)) {
    return yield* stop(
      `Could not read which Cloudflare account profile "${name}" deploys into (\`bunx alchemy profile show --profile ${name}\`), so nothing is made with it.`
    )
  }
  const byToken = role === "preview" && found.previewByToken
  // The id is compared inside the one process 1Password fills it for: this command never holds it. Alchemy keeps an
  // id trimmed and in lower case, so the field is compared the same way. Exit 3 is "they differ"; anything else is
  // the comparison itself failing (1Password locked or declined), which is not a wrong account.
  const tokenAccountIs = Effect.fn("InfraSetup.tokenAccountIs")(function* (id: string) {
    const same = yield* workstation.ask("op-human", [
      "run",
      "--env-file",
      localEnvFile,
      "--",
      "sh",
      "-c",
      `v="$(printf %s "$${previewAccountIdName}" | tr '[:upper:]' '[:lower:]' | tr -d '[:space:]')"; [ "$v" = "$1" ] || exit 3`,
      "sh",
      id
    ])
    // The script exits 0 or 3 only, so any other code is 1Password's: op ran nothing, or could not fill the id.
    if (same.code !== 0 && same.code !== 3) {
      return yield* onePasswordFailed(
        `the comparison of profile "${name}"'s account with the id ${localEnvFile} names`,
        same.stderr,
        referencesRefused
      )
    }
    return same.code === 0
  })
  if (byToken && !(yield* tokenAccountIs(held.value))) {
    return yield* stop(
      `Profile "${name}" deploys into the account ${held.value}, which is not the one ${localEnvFile} names for the previews. ${reconnect}`
    )
  }
  const namedAccount = byToken ? O.none<Account>() : accountOf(found, role)
  if (O.isSome(namedAccount) && namedAccount.value.id !== held.value) {
    return yield* stop(
      `Profile "${name}" deploys into the account ${held.value}, not "${namedAccount.value.name}" (${namedAccount.value.id}), the one named for ${role}: a yes to the questions would be about one account and the deploy would go into the other. ${reconnect}`
    )
  }
  const strict = has(options.sizes, "staging") || has(options.sizes, "production")
  const twoAccounts =
    "Production and the previews are two Cloudflare accounts (decision I4): a preview's deploy token covers its whole account."
  // A run with `--staging` or `--production` has production's account already, the one that holds the zone (the
  // Cloudflare step stops when cf cannot name it), so the previews' profile is held against that account.
  if (strict && role === "preview" && O.exists(found.production, (production) => production.id === held.value)) {
    return yield* stop(
      `Profile "${name}" deploys into the account ${held.value}, which is production's: it holds the zone ${productionZone}. ${twoAccounts} Give the previews an account of their own, then run this again.`
    )
  }
  // By his token nothing asked cf about this account, so it is asked here whether it is production's.
  if (role === "preview" && O.exists(found.zoneHolder, (holder) => holder.id === held.value)) {
    if (byToken) {
      const yes = yield* workstation.confirm(
        `The previews' account by your token is ${held.value}. It holds the zone ${productionZone}, so it is production's account: a test stage here shares it. Use it?`
      )
      if (!yes) return yield* stop("Stopped: no Cloudflare account for preview.")
    }
  }
  if (byToken && O.isNone(found.zoneHolder)) {
    yield* workstation.say(
      `Cloudflare: nothing here could say whether the account ${held.value} holds the zone ${productionZone}. If it is production's account, stop at the next question.`
    )
  }
  const otherName = profileOf(options, role === "preview" ? "production" : "preview")
  if (strict) {
    const listing = yield* workstation.ask("bunx", ["alchemy", "profile", "list"])
    if (listing.code !== 0) {
      return yield* stop(
        `Could not list the Alchemy profiles (\`bunx alchemy profile list\`), so "${name}"'s account cannot be told apart from profile "${otherName}"'s. ${twoAccounts}`
      )
    }
    const otherThere = A.some(
      profilesOf(listing.stdout),
      (one) => one.name === otherName && connected(one.providers, "Cloudflare")
    )
    // Production's profile with no previews' profile beside it is held against the previews' account his own file
    // names instead: the previews' profile may be under another name, or not made yet.
    if (!otherThere && role === "production" && found.previewByToken && (yield* tokenAccountIs(held.value))) {
      return yield* stop(
        `Profile "${name}" deploys into the account ${held.value}, the one ${localEnvFile} names for the previews. ${twoAccounts} ${reconnect}`
      )
    }
    if (!otherThere && role === "production" && !found.previewByToken) {
      yield* workstation.say(
        `Alchemy: no profile "${otherName}" is connected to Cloudflare and ${localEnvFile} names no previews' account, so production's account is held against no previews' account here.`
      )
    }
    const other = otherThere ? yield* heldBy(otherName) : O.none<string>()
    if (otherThere && O.isNone(other)) {
      return yield* stop(
        `Could not read which Cloudflare account profile "${otherName}" deploys into (it may need its login again: \`bunx alchemy profile show --profile ${otherName}\`), so it cannot be told apart from "${name}"'s. ${twoAccounts}`
      )
    }
    if (O.exists(other, (id) => id === held.value)) {
      return yield* stop(
        `Profiles "${options.previewProfile}" and "${options.productionProfile}" both deploy into the account ${held.value}. ${twoAccounts} Connect the previews' profile to the second account (its token and id in ${localEnvFile}), then run this again.`
      )
    }
  }
  yield* workstation.say(
    `Alchemy: profile "${name}" deploys into the account ${held.value}. Checked against the one named for ${role}.`
  )
  return {
    ...found,
    held: role === "preview" ? { ...found.held, preview: held } : { ...found.held, production: held }
  }
})

const profile = Effect.fn("InfraSetup.profile")(function* (
  step: { readonly role: Role; readonly github: boolean; readonly onePassword: boolean },
  options: SetupOptions,
  found: Found
) {
  yield* profileConnected(step, options, found)
  return yield* profileAccountChecked(step.role, options, found)
})

/**
 * What a failed `state bootstrap` says. Alchemy reports any failure to read the account's workers.dev subdomain as
 * the credentials not reaching the account, and a new account has none. By his token that is asked before step 1;
 * by a login nothing here may ask it (cf has no command for it, and the login's token is Alchemy's), so the stop
 * names it as the likely cause when Alchemy said so.
 */
export const stateStoreFailed = (profile: string) =>
  `\`bunx alchemy state bootstrap --profile ${profile}\` failed; what it said is above. If it says the current credentials "can't access" the account, the account most likely has no workers.dev subdomain yet: pick one in the Cloudflare dashboard under that account, Workers & Pages, and run this again.`

const stateStore = Effect.fn("InfraSetup.stateStore")(function* (role: Role, options: SetupOptions, found: Found) {
  const workstation = yield* Workstation
  const name = profileOf(options, role)
  const account = accountSaid(found, role)
  yield* workstation.say(
    `State store: Alchemy keeps what it deployed in a small Worker in ${account}. \`state bootstrap\` makes it, or adopts the one that is there (one an older build of Alchemy made is upgraded, one way).`
  )
  const yes = yield* workstation.confirm(`Make sure the state store exists in ${account}?`)
  if (!yes) return yield* stop(`Stopped before the state store in ${account}. Nothing was made there by this step.`)
  const code = yield* workstation.hand("bunx", ["alchemy", "state", "bootstrap", "--profile", name])
  if (code !== 0) return yield* stop(stateStoreFailed(name))
  return found
})

const opFailed = (what: string, said: string) =>
  stop(`1Password: ${what} failed: ${Str.trim(said)}. Nothing was written to ${opEnvFile}.`)

/** The owner's own references file as it stands, or nothing when he has none. */
const ownText = Effect.gen(function* () {
  const repo = yield* Repo
  const file = repo.join(repo.root, localEnvFile)
  return (yield* repo.exists(file)) ? yield* repo.text(file) : ""
})

const previewPassword = Effect.fn("InfraSetup.previewPassword")(function* (options: SetupOptions, found: Found) {
  const workstation = yield* Workstation
  const repo = yield* Repo
  const file = repo.join(repo.root, opEnvFile)
  const text = yield* repo.text(file)
  const mine = yield* ownText
  const given = referenceGiven({ committed: text, own: mine, name: previewPasswordName })
  if (given.state === "reference") {
    yield* workstation.say(
      `1Password: ${given.file} already names a reference for ${previewPasswordName}, and previews and staging take their password from it. Left as it is.`
    )
    return found
  }
  if (given.state === "not-a-reference") {
    return yield* stop(
      `${given.file} has a line for ${previewPasswordName} that is not an op:// reference. That file holds references only: put the line right, or remove it, and run this again. The line was not printed.`
    )
  }
  yield* workstation.say(
    `1Password: ${opEnvFile} names no ${previewPasswordName}. Looking for the item "${previewPasswordItem}"; 1Password may ask you to unlock.`
  )
  const vaults = yield* heard(
    S.Array(Named),
    { command: "op-human", args: ["vault", "list", "--format", "json"] },
    "`op-human vault list`",
    "that your 1Password account is signed in and may see its vaults"
  )
  if (Result.isFailure(vaults)) return yield* opFailed("`op-human vault list`", vaults.failure)
  const all = vaults.success
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
  const items = heard(
    S.Array(Titled),
    { command: "op-human", args: ["item", "list", "--vault", vault.id, "--format", "json"] },
    "`op-human item list`",
    `that your account may read the vault "${vault.name}" (or name another with \`--vault\`)`
  ).pipe(
    Effect.flatMap(
      Result.match({
        onFailure: (why) => opFailed("`op-human item list`", why),
        onSuccess: (listed) => Effect.succeedSome(A.filter(listed, (item) => item.title === previewPasswordItem))
      })
    )
  )
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
    if (made.code !== 0) {
      return yield* onePasswordFailed(
        "`op-human item create`",
        made.stderr,
        `that your account may make items in the vault "${vault.name}" (or name another with \`--vault\`)`
      )
    }
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
    if (code !== 0) return yield* stop("`gh auth login` did not finish. Run this again.")
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
  const committed = target === "test-stage" ? "" : yield* repo.text(repo.join(repo.root, opEnvFile))
  const own = target === "test-stage" ? "" : yield* ownText
  const key = referenceGiven({ committed, own, name: modelKeyName })
  const modelKey = key.state
  if (target !== "test-stage") {
    yield* workstation.say(
      modelKey === "reference"
        ? `Model key: ${key.file} names a reference for ${modelKeyName}. The stack asks 1Password for it at the deploy, and the app asks you to authorize; this command never reads it.`
        : `Model key: ${key.file} names none, so this deploys with DEPLOY_WITHOUT_MODEL_KEY=true: production runs without a model and its rules answer. To use a model, write a reference for ${modelKeyName} there and run this again.`
    )
    const password = referenceGiven({ committed, own, name: previewPasswordName })
    if (target === "repository" && password.state !== "reference") {
      return yield* stop(`${password.file} names no reference for ${previewPasswordName}.`)
    }
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
  const into = Target.match(target, {
    "test-stage": () => ` into ${accountSaid(found, "preview")}`,
    repository: () =>
      ` (to ${gitHubRepository} on GitHub, and one token in ${accountSaid(found, "production")}; previews and staging then deploy into ${accountSaid(found, "preview")} with your token)`,
    production: () => ` into ${accountSaid(found, "production")}`
  })
  const yes = yield* workstation.confirm(`Deploy ${what}${into} as that plan says?`)
  if (!yes) return yield* stop(`Stopped: ${what} was not deployed.`)
  const call = deployCall(options, target, "deploy")
  yield* workstation.say(`Deploying ${what}: \`${shown(call)}\`.`)
  const deployed = yield* workstation.hand(call.command, call.args, given)
  if (deployed !== 0) return yield* stop(`The deploy of ${what} failed; what it said is above.`)
  yield* workstation.say(
    Target.match(target, {
      "test-stage": () =>
        `Deployed ${stage}. Its address is in Alchemy's output above. Its password was left out of this run on purpose. To read it, run \`bunx alchemy deploy --stage ${stage} --profile ${options.previewProfile}\` yourself: it should change nothing, and its output shows testAccountPassword. Sign in as dana@example-works.test with it. To remove the stage: \`bunx alchemy destroy --stage ${stage} --profile ${options.previewProfile}\`, yours to run too.`,
      repository: () =>
        "Deployed the repository's stack. The next push to main that passes CI deploys staging; a pull request gets a preview. Both deploy with your own token: to rotate it, make a new one in the previews' account, put it in your 1Password item, and run this again.",
      production: () =>
        `Deployed production. Open its address: an email on the sign-up list (your 1Password item for ${signUpName}) can open an account there; with \`closed\` in it, nobody can, you included.`
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
    Profile: (step) => profile(step, options, found),
    StateStore: (step) => stateStore(step.role, options, found),
    GitHubLogin: () => gitHubLogin(options, found),
    Deploy: (step) => deploy(step.target, options, found)
  })

/**
 * Runs the setup: a dry run prints its steps and starts nothing; a real run refuses anything but a person at a
 * terminal, then does each step in order and stops at the first one that cannot go on.
 */
export const setup = Effect.fn("InfraSetup.setup")(function* (given: SetupOptions) {
  const workstation = yield* Workstation
  // A dry run with no size prints the steps of all three, so the command the agents' rule names prints steps.
  const unsized = !A.isReadonlyArrayNonEmpty(given.sizes)
  const stageName = /^[a-z0-9][-_a-z0-9]*$/
  // Nobody asked for a test stage, so a name this machine's user does not make is shown as the placeholder.
  const options: SetupOptions =
    unsized && given.dryRun
      ? { ...given, sizes: SetupSize.literals, user: stageName.test(given.user) ? given.user : "<user>" }
      : given
  if (!A.isReadonlyArrayNonEmpty(options.sizes)) {
    return yield* stop(
      "Say how much to set up: `--test-stage` (a test stage and its address), `--staging` (the repository's stack) or `--production`. `--dry-run` prints the steps and starts nothing."
    )
  }
  if (has(options.sizes, "test-stage") && !stageName.test(options.user) && !(unsized && options.dryRun)) {
    return yield* stop(
      `"test_${options.user}" is not a stage name (lower-case letters, digits, - and _). Pass \`--user <name>\`.`
    )
  }
  const repo = yield* Repo
  const local = repo.join(repo.root, localEnvFile)
  const own = (yield* repo.exists(local)) ? yield* repo.text(local) : ""
  const committed = yield* repo.text(repo.join(repo.root, opEnvFile))
  // Read as the repository's stack reads them: the last line of a name across op.env and then op.env.local.
  const token = referenceGiven({ committed, own, name: previewTokenName })
  const accountId = referenceGiven({ committed, own, name: previewAccountIdName })
  const previewByToken =
    token.state === "reference" &&
    accountId.state === "reference" &&
    token.file === localEnvFile &&
    accountId.file === localEnvFile
  const access = referenceGiven({ committed, own, name: previewAccessName })
  const signUp = referenceGiven({ committed, own, name: signUpName })
  const stopsBefore = filesStop({ committed, token, accountId, access, signUp, previewByToken, sizes: options.sizes })
  if (options.dryRun) {
    const said = unsized ? ["No size was given, so these are the steps of all three sizes at once."] : []
    return yield* Effect.forEach([...said, ...dryRun({ options, previewByToken, stopsBefore })], workstation.say, {
      concurrency: 1,
      discard: true
    })
  }
  yield* ownerOnly
  yield* outside(options)
  if (O.isSome(stopsBefore)) return yield* stop(stopsBefore.value)
  // Before the first step, so a token that will not do is said before anything is made with it or beside it.
  if (previewByToken) yield* tokenChecked
  const steps = stepsFor(options.sizes)
  yield* Effect.reduce(
    steps,
    (): Found => ({ ...nothingFound, previewByToken }),
    (found, step, index) =>
      workstation.say(`\nStep ${index + 1} of ${steps.length}.`).pipe(
        Effect.andThen(perform(options, found)(step)),
        // A stop inside a step says what stopped it; what the steps before it made is still there.
        Effect.catchTag("SetupStopped", (stopped) =>
          stop(
            index === 0
              ? stopped.message
              : `${stopped.message} Steps 1 to ${index} of this run are done and stay as they are; a run again goes on from them.`
          )
        )
      )
  )
  yield* workstation.say("\nDone. Nothing else was started.")
})
