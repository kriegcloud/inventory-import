/**
 * What one stage of the app is: its name, its kind, the address it answers at, the seed data it gets, where its
 * model key and its sign-up list come from. A plan holds names and references, never a secret's value.
 *
 * @packageDocumentation
 */
import { LiteralKit } from "@beep/schema/LiteralKit"
import * as S from "effect/Schema"
import * as Tuple from "effect/Tuple"
import { $InfraId } from "./internal/identity.ts"

const $I = $InfraId.create("Stage")

/**
 * The name of a pull request's preview: `pr-` and the pull request's number.
 *
 * @category schemas
 */
export const PreviewStageName = S.String.check(S.isPattern(/^pr-[1-9][0-9]{0,8}$/)).pipe(
  $I.annoteSchema("PreviewStageName", { description: "A preview's stage name: pr- and the pull request's number" })
)

/**
 * The name of a test stage, deployed by hand: `test_` and its owner's user name.
 *
 * @category schemas
 */
export const TestStageName = S.String.check(S.isPattern(/^test_[a-z0-9][-_a-z0-9]{0,40}$/)).pipe(
  $I.annoteSchema("TestStageName", { description: "A test stage's name: test_ and its owner's user name" })
)

/**
 * The name of a personal stage, one developer's machine: `dev_` and the user name.
 *
 * @category schemas
 */
export const PersonalStageName = S.String.check(S.isPattern(/^dev_[a-z0-9][-_a-z0-9]{0,40}$/)).pipe(
  $I.annoteSchema("PersonalStageName", { description: "A personal stage's name: dev_ and the user name" })
)

/**
 * A stage's name, as this app has them: `prod`, `staging`, `pr-<number>`, `test_<user>` or `dev_<user>`. Alchemy
 * takes any name of lower-case letters, digits, `-` and `_`; a name of none of the five kinds is refused, `live_<user>`
 * among them, which is what a deploy without `--stage` would use.
 *
 * @category schemas
 */
export const StageName = S.Union([
  S.Literal("prod"),
  S.Literal("staging"),
  PreviewStageName,
  TestStageName,
  PersonalStageName
]).pipe($I.annoteSchema("StageName", { description: "A stage's name: one of the app's five kinds of stage" }))

/**
 * Runtime type of {@link StageName}.
 *
 * @category models
 */
export type StageName = typeof StageName.Type

/**
 * A host name such as `inventory.beep-effect.com`.
 *
 * @category schemas
 */
export const Hostname = S.String.check(S.isMaxLength(253), S.isPattern(/^([a-z0-9-]{1,63}\.)+[a-z]{2,63}$/)).pipe(
  $I.annoteSchema("Hostname", { description: "A host name, lower case, without scheme or path" })
)

/**
 * Runtime type of {@link Hostname}.
 *
 * @category models
 */
export type Hostname = typeof Hostname.Type

/**
 * The name of an environment variable, as a deploy reads one.
 *
 * @category schemas
 */
export const VariableName = S.String.check(S.isMaxLength(64), S.isPattern(/^[A-Z][A-Z0-9_]*$/)).pipe(
  $I.annoteSchema("VariableName", { description: "An environment variable's name, upper case" })
)

/**
 * Runtime type of {@link VariableName}.
 *
 * @category models
 */
export type VariableName = typeof VariableName.Type

/**
 * What a stage is for. Personal is one developer's machine; test is the deploy test's own copy; preview is a pull
 * request's; staging is main's head, deployed when its check passed (an older commit's check never puts it back);
 * production is the one people use.
 *
 * @category schemas
 */
export const StageKind = LiteralKit(["personal", "test", "preview", "staging", "production"]).pipe(
  $I.annoteSchema("StageKind", { description: "What a stage is for" })
)

/**
 * Runtime type of {@link StageKind}.
 *
 * @category models
 */
export type StageKind = typeof StageKind.Type

/**
 * A file of seed rows under the app's `seeds/` folder. Production never gets one.
 *
 * @category schemas
 */
export const Seed = LiteralKit(["organizations", "accounts"]).pipe(
  $I.annoteSchema("Seed", { description: "A seed file: the two test organizations, or the test accounts" })
)

/**
 * Runtime type of {@link Seed}.
 *
 * @category models
 */
export type Seed = typeof Seed.Type

/**
 * Where a stage's test accounts get their password. `none`: the stage has no test account, or runs on a developer's
 * machine with the password written in the repository. `minted`: the stack makes one for the stage. `given`: the
 * deploy is handed one, the same for every preview.
 *
 * @category schemas
 */
export const TestPassword = LiteralKit(["none", "minted", "given"]).pipe(
  $I.annoteSchema("TestPassword", { description: "Where a stage's test accounts get their password" })
)

/**
 * The decoded value of `TestPassword`.
 *
 * @category models
 */
export type TestPassword = typeof TestPassword.Type

/** The stage answers at the address Cloudflare gives every Worker, on `workers.dev`. */
export class OnWorkersDev extends S.Opaque<OnWorkersDev, { readonly brand: unique symbol }>()(
  S.Struct({ at: S.tag("workersDev") }).pipe(
    $I.annoteSchema("OnWorkersDev", { description: "The Worker's own workers.dev address" })
  )
) {}

/** The stage answers at a host name on a zone the account already holds; the zone is looked up, never managed. */
export class OnHostname extends S.Opaque<OnHostname, { readonly brand: unique symbol }>()(
  S.Struct({
    at: S.tag("hostname"),
    hostname: Hostname.pipe(S.annotateKey({ description: "The address people open" })),
    zone: Hostname.pipe(S.annotateKey({ description: "The zone the host name is on" }))
  }).pipe($I.annoteSchema("OnHostname", { description: "A host name on an existing zone" }))
) {}

/**
 * Where a stage answers.
 *
 * @category schemas
 */
export const StageAddress = LiteralKit(["workersDev", "hostname"])
  .mapMembers(() => Tuple.make(OnWorkersDev, OnHostname))
  .pipe(S.toTaggedUnion("at"), $I.annoteSchema("StageAddress", { description: "Where a stage answers" }))

/**
 * Runtime type of {@link StageAddress}.
 *
 * @category models
 */
export type StageAddress = typeof StageAddress.Type

/** The stage has no such value: the app's own default holds (the rules answer; sign-up is closed). */
export class NotGiven extends S.Opaque<NotGiven, { readonly brand: unique symbol }>()(
  S.Struct({ from: S.tag("nowhere") }).pipe(
    $I.annoteSchema("NotGiven", { description: "No value: the app's default holds" })
  )
) {}

/**
 * The value is read from a variable of the deploying process, which the stack's 1Password entry or the deploy job's environment fills.
 * The plan names the variable and never holds what is in it.
 */
export class FromEnvironment extends S.Opaque<FromEnvironment, { readonly brand: unique symbol }>()(
  S.Struct({
    from: S.tag("environment"),
    variable: VariableName.pipe(S.annotateKey({ description: "The variable the deploy reads" }))
  }).pipe($I.annoteSchema("FromEnvironment", { description: "Read from a variable of the deploying process" }))
) {}

/**
 * Where a setting's value comes from at deploy time.
 *
 * @category schemas
 */
export const SettingSource = LiteralKit(["nowhere", "environment"])
  .mapMembers(() => Tuple.make(NotGiven, FromEnvironment))
  .pipe(
    S.toTaggedUnion("from"),
    $I.annoteSchema("SettingSource", { description: "Where a setting's value comes from at deploy time" })
  )

/**
 * Runtime type of {@link SettingSource}.
 *
 * @category models
 */
export type SettingSource = typeof SettingSource.Type

/**
 * The address people open production at, and the zone it is on.
 *
 * @category constants
 */
export const production = { hostname: "inventory.beep-effect.com", zone: "beep-effect.com" } as const

/** Production's own address: the real host name on its zone, and no other. */
const ProductionAddress = S.Struct({
  at: S.tag("hostname"),
  hostname: S.tag(production.hostname).pipe(S.annotateKey({ description: "The address people open" })),
  zone: S.tag(production.zone).pipe(S.annotateKey({ description: "The zone the host name is on" }))
}).pipe($I.annoteSchema("ProductionAddress", { description: "Production's host name on its zone" }))

/** A variable of the deploying process that production reads, named once here. */
const fromVariable = <const Name extends string>(variable: Name, description: string) =>
  S.Struct({ from: S.tag("environment"), variable: S.tag(variable) }).pipe(S.annotateKey({ description }))

/** What every stage but production is seeded with: the two test organizations, then the test accounts. */
const rehearsalSeeds = S.Tuple([S.Literal("organizations"), S.Literal("accounts")]).pipe(
  S.annotateKey({ description: "The seed files applied after the migrations, in order" })
)

/** The fields of a stage that is a rehearsal: on workers.dev, the test accounts, no model key, sign-up closed. */
const rehearsal = {
  address: OnWorkersDev.pipe(S.annotateKey({ description: "Where the stage answers" })),
  seeds: rehearsalSeeds,
  modelKey: NotGiven.pipe(S.annotateKey({ description: "No model key: the rules answer" })),
  signUp: NotGiven.pipe(S.annotateKey({ description: "Sign-up is closed to everyone" }))
}

/**
 * Production: the real address on its zone, never seeded, its model key and sign-up list read at deploy.
 *
 * @category models
 */
export class ProductionPlan extends S.Opaque<ProductionPlan, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("production"),
    stage: S.tag("prod").pipe(S.annotateKey({ description: "The stage's name" })),
    address: ProductionAddress.pipe(S.annotateKey({ description: "Where the stage answers" })),
    seeds: S.Tuple([]).pipe(S.annotateKey({ description: "No seed file: production holds people's own data" })),
    modelKey: fromVariable("OPENROUTER_API_KEY", "The model's key, read from this variable at deploy"),
    signUp: fromVariable("SIGN_UP", "The emails that may sign up, read from this variable at deploy"),
    deployed: S.tag(true)
  }).pipe($I.annoteSchema("ProductionPlan", { description: "What production gets" }))
) {}

/**
 * Staging, main's head once its check passed: a rehearsal, deployed.
 *
 * @category models
 */
export class StagingPlan extends S.Opaque<StagingPlan, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("staging"),
    stage: S.tag("staging").pipe(S.annotateKey({ description: "The stage's name" })),
    ...rehearsal,
    deployed: S.tag(true)
  }).pipe($I.annoteSchema("StagingPlan", { description: "What staging gets" }))
) {}

/**
 * A pull request's preview: a rehearsal, deployed.
 *
 * @category models
 */
export class PreviewPlan extends S.Opaque<PreviewPlan, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("preview"),
    stage: PreviewStageName.pipe(S.annotateKey({ description: "The stage's name" })),
    ...rehearsal,
    deployed: S.tag(true)
  }).pipe($I.annoteSchema("PreviewPlan", { description: "What a preview gets" }))
) {}

/**
 * A test stage, deployed by hand: a rehearsal, deployed.
 *
 * @category models
 */
export class TestPlan extends S.Opaque<TestPlan, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("test"),
    stage: TestStageName.pipe(S.annotateKey({ description: "The stage's name" })),
    ...rehearsal,
    deployed: S.tag(true)
  }).pipe($I.annoteSchema("TestPlan", { description: "What a test stage gets" }))
) {}

/**
 * A personal stage: a rehearsal on one developer's machine, never deployed.
 *
 * @category models
 */
export class PersonalPlan extends S.Opaque<PersonalPlan, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("personal"),
    stage: PersonalStageName.pipe(S.annotateKey({ description: "The stage's name" })),
    ...rehearsal,
    deployed: S.tag(false)
  }).pipe($I.annoteSchema("PersonalPlan", { description: "What a personal stage gets" }))
) {}

/**
 * Everything that differs between stages, decided once from the stage's name: one case per kind, so a plan of one
 * kind cannot hold another's values (production seeded, a preview with a model key, a personal stage deployed).
 *
 * @category schemas
 */
export const StagePlan = StageKind.mapMembers(() =>
  Tuple.make(PersonalPlan, TestPlan, PreviewPlan, StagingPlan, ProductionPlan)
).pipe(S.toTaggedUnion("kind"), $I.annoteSchema("StagePlan", { description: "What one stage gets" }))

/**
 * Runtime type of {@link StagePlan}.
 *
 * @category models
 */
export type StagePlan = typeof StagePlan.Type
