// What each stage gets, held to Benjamin's decisions: production alone has the real address and a model key and is
// never seeded; a name that is no stage of this app is refused, so a deploy without --stage stops.
import { describe, expect, it } from "@effect/vitest"
import * as A from "effect/Array"
import * as Arbitrary from "effect/Arbitrary"
import * as O from "effect/Option"
import * as Result from "effect/Result"
import * as S from "effect/Schema"
import { StagePlan } from "@beep/infra/Stage"
import {
  givenPreviewToken,
  givenTestPassword,
  kindOf,
  modelKeyFor,
  planFor,
  testPasswordOf
} from "@beep/infra/StagePlan"

const plan = (stage: string) => Result.getOrThrow(planFor(stage))

describe("the plan of a stage", () => {
  it("production answers at the real address, holds no seed, and reads its model key and sign-up list at deploy", () => {
    expect(plan("prod")).toEqual({
      stage: "prod",
      kind: "production",
      address: { at: "hostname", hostname: "inventory.beep-effect.com", zone: "beep-effect.com" },
      seeds: [],
      modelKey: { from: "environment", variable: "OPENROUTER_API_KEY" },
      signUp: { from: "environment", variable: "SIGN_UP" },
      deployed: true
    })
  })

  it("a preview is on workers.dev with the test accounts, no model key, and sign-up closed to everyone", () => {
    expect(plan("pr-42")).toMatchObject({
      kind: "preview",
      address: { at: "workersDev" },
      seeds: ["organizations", "accounts"],
      modelKey: { from: "nowhere" },
      signUp: { from: "nowhere" }
    })
  })

  it("staging, what main holds, is on workers.dev with the test accounts, no model key, and reads a sign-up list", () => {
    expect(plan("staging")).toMatchObject({
      kind: "staging",
      address: { at: "workersDev" },
      seeds: ["organizations", "accounts"],
      modelKey: { from: "nowhere" },
      signUp: { from: "environment", variable: "SIGN_UP" },
      deployed: true
    })
  })

  it("a test stage has the test accounts, no model key, and sign-up closed", () => {
    expect(plan("test_ben")).toMatchObject({
      kind: "test",
      address: { at: "workersDev" },
      seeds: ["organizations", "accounts"],
      modelKey: { from: "nowhere" },
      signUp: { from: "nowhere" },
      deployed: true
    })
  })

  it("a personal stage is not deployed", () => {
    expect(plan("dev_ben")).toMatchObject({ kind: "personal", deployed: false })
  })

  it("only production is at a host name, holds a model key, and has no seed", () => {
    const others = A.map(["pr-1", "pr-999", "staging", "test_a", "dev_a"], plan)
    expect(A.every(others, (other) => other.address.at === "workersDev")).toBe(true)
    expect(A.every(others, (other) => other.modelKey.from === "nowhere")).toBe(true)
    expect(A.every(others, (other) => other.seeds.length > 0)).toBe(true)
  })

  it("refuses a name that is no stage of this app, and says which names are", () => {
    for (const name of [
      "live_ben",
      "production",
      "prod2",
      "pr-",
      "pr-0",
      "pr-1a",
      "PR-1",
      "stage",
      "staging_1",
      "test_",
      "",
      "prod "
    ]) {
      const refused = planFor(name)
      expect([name, Result.isFailure(refused)]).toEqual([name, true])
    }
    const refused = kindOf("live_ben")
    expect(Result.isFailure(refused) ? refused.failure.message : "").toBe(
      '"live_ben" is not a stage of this app. Name one with --stage: prod, staging, pr-<number>, test_<user> or dev_<user>.'
    )
  })

  it.prop(
    "every plan a stage name gives is a valid plan",
    [Arbitrary.schema(S.Literals(["prod", "staging", "pr-7", "test_x", "dev_x"]))],
    ([name]) => {
      expect(S.is(StagePlan)(plan(name))).toBe(true)
    }
  )

  // A plan the schema allows is exactly the plan its own stage name gives: no kind can hold another's values, so
  // production is never seeded or given test accounts, and a personal stage is never deployed.
  it.prop("every plan the schema allows is the one its stage name gives", [Arbitrary.schema(StagePlan)], ([value]) => {
    expect(planFor(value.stage)).toEqual(Result.succeed(value))
    expect(testPasswordOf(value) === "none").toBe(value.kind === "production" || value.kind === "personal")
  })

  describe("the password a stage's test accounts take", () => {
    it("is minted for a test stage, given to a preview and to staging, and the repository's only on a developer's machine", () => {
      expect(
        A.map(["prod", "pr-42", "staging", "test_ben", "dev_ben"], (stage) => [stage, testPasswordOf(plan(stage))])
      ).toEqual([
        ["prod", "none"],
        ["pr-42", "given"],
        ["staging", "given"],
        ["test_ben", "minted"],
        ["dev_ben", "none"]
      ])
    })

    it("a preview takes the password it is given", () => {
      expect(givenTestPassword({ stage: "pr-42", given: O.some("the previews' password") })).toEqual(
        Result.succeed("the previews' password")
      )
    })

    it("staging with none stops too, and says it is the staging environment", () => {
      const stopped = givenTestPassword({ stage: "staging", given: O.none<string>() })
      expect(Result.isFailure(stopped) ? stopped.failure.message : "").toContain(
        "so nobody could sign in to this stage. Write the reference PREVIEW_TEST_ACCOUNT_PASSWORD="
      )
      expect(Result.isFailure(stopped) ? stopped.failure.message : "").toContain(
        "to the staging environment as a secret."
      )
    })

    it("a preview with none stops, with a sentence naming the reference", () => {
      const stopped = givenTestPassword({ stage: "pr-42", given: O.none<string>() })
      expect(Result.isFailure(stopped) ? stopped.failure.message : "").toBe(
        'Stage "pr-42" has no password for its test accounts: PREVIEW_TEST_ACCOUNT_PASSWORD is not set, so nobody ' +
          "could sign in to this preview. Write the reference " +
          "PREVIEW_TEST_ACCOUNT_PASSWORD=op://<vault>/<item>/<field> in packages/infra/env/op.env and deploy the " +
          "repository's stack, which asks 1Password for it and gives the password to the preview environment as a secret."
      )
    })
  })

  describe("the token previews and staging deploy with", () => {
    it("is the one the owner gave; with none the repository's stack stops and says where the references go", () => {
      expect(givenPreviewToken(O.some("his own token"))).toEqual(Result.succeed("his own token"))
      const stopped = givenPreviewToken(O.none<string>())
      expect(Result.isFailure(stopped) ? stopped.failure.message : "").toBe(
        "The repository's stack has no Cloudflare token for previews and staging: PREVIEW_CLOUDFLARE_API_TOKEN is " +
          "not set, so no pull request could get a preview and main could not reach staging. Write the references " +
          'PREVIEW_CLOUDFLARE_API_TOKEN="op://<vault>/<item>/<field>" and ' +
          'PREVIEW_CLOUDFLARE_ACCOUNT_ID="op://<vault>/<item>/<field>" in packages/infra/env/op.env.local (git ' +
          "ignores it) and deploy the stack again; it asks 1Password for both. If they are written there already, " +
          "one of three things kept 1Password's answer out: CI is set in your shell (the stack then asks 1Password " +
          "for nothing, as in a workflow: unset it), the 1Password field is empty, or PREVIEW_CLOUDFLARE_API_TOKEN is " +
          "exported empty in your shell (an empty one is used before 1Password's answer: unset it)."
      )
    })
  })

  describe("the model key a stage is deployed with", () => {
    const keyFor = (stage: string, key: O.Option<string>, withoutOnPurpose: boolean) =>
      modelKeyFor({ stage, source: plan(stage).modelKey, key, withoutOnPurpose })

    it("stops a production deploy that has none, with a sentence naming the reference and the flag", () => {
      const stopped = keyFor("prod", O.none(), false)
      expect(Result.isFailure(stopped)).toBe(true)
      expect(Result.isFailure(stopped) ? stopped.failure.message : "").toBe(
        'Stage "prod" has no model key: OPENROUTER_API_KEY is not set, so every model feature would be answered by ' +
          "rules. Write the reference OPENROUTER_API_KEY=op://<vault>/<item>/<field> in packages/infra/env/op.env " +
          "and deploy the repository's stack, which asks 1Password for it and gives the key to the production environment. To " +
          "deploy without a model on purpose, set DEPLOY_WITHOUT_MODEL_KEY=true."
      )
    })

    it("deploys production with its key, and without one only when the flag says it is meant", () => {
      expect(keyFor("prod", O.some("key"), false)).toEqual(Result.succeed(O.some("key")))
      expect(keyFor("prod", O.none(), true)).toEqual(Result.succeed(O.none()))
    })

    it("gives a preview, staging and a test stage no key, whatever the environment holds", () => {
      expect(keyFor("pr-42", O.some("key"), false)).toEqual(Result.succeed(O.none()))
      // Decision I5: production alone holds a key, so staging's deploy never stops for want of one.
      expect(keyFor("staging", O.none(), false)).toEqual(Result.succeed(O.none()))
      expect(keyFor("test_ben", O.none(), false)).toEqual(Result.succeed(O.none()))
    })
  })
})
