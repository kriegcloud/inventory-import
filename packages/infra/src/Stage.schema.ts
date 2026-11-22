/**
 * What one stage of the app is: its name, its kind, the address it answers at, the seed data it gets, where its
 * model key and its sign-up list come from. A plan holds names and references, never a secret's value.
 *
 * @packageDocumentation
 */
import { LiteralKit } from "@beep/schema/LiteralKit"
import * as Effect from "effect/Effect"
import * as S from "effect/Schema"
import * as Tuple from "effect/Tuple"
import { $InfraId } from "./internal/identity.ts"

const $I = $InfraId.create("Stage")

/**
 * A stage's name as Alchemy accepts one: lower-case letters, digits, `-` and `_`, starting with a letter or digit.
 *
 * @category schemas
 */
export const StageName = S.String.check(S.isMaxLength(64), S.isPattern(/^[a-z0-9][-_a-z0-9]*$/)).pipe(
  $I.annoteSchema("StageName", { description: "A stage's name: lower-case letters, digits, - and _" })
)

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
 * request's; staging is what `main` holds, deployed after every green push; production is the one people use.
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
 * The value is read from a variable of the deploying process, which `op run` or the deploy job's environment fills.
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
 * Everything that differs between stages, decided once from the stage's name.
 *
 * @category models
 */
export class StagePlan extends S.Opaque<StagePlan, { readonly brand: unique symbol }>()(
  S.Struct({
    stage: StageName.pipe(S.annotateKey({ description: "The stage's name" })),
    kind: StageKind.pipe(S.annotateKey({ description: "What the stage is for" })),
    address: StageAddress.pipe(S.annotateKey({ description: "Where the stage answers" })),
    seeds: S.Array(Seed.annotateKey({ description: "One seed file" }))
      .check(S.isUnique())
      .pipe(
        S.annotateKey({ description: "The seed files applied after the migrations, in order" }),
        S.withConstructorDefault(Effect.succeed([])),
        S.withDecodingDefaultTypeKey(Effect.succeed([]))
      ),
    modelKey: SettingSource.pipe(
      S.annotateKey({ description: "Where the model's key comes from; nowhere means the rules answer" })
    ),
    signUp: SettingSource.pipe(
      S.annotateKey({ description: "Where the emails that may sign up come from; nowhere means sign-up is closed" })
    ),
    deployed: S.Boolean.pipe(
      S.annotateKey({ description: "Whether the stage is deployed to Cloudflare at all; a personal stage is not" })
    )
  }).pipe($I.annoteSchema("StagePlan", { description: "What one stage gets" }))
) {}
