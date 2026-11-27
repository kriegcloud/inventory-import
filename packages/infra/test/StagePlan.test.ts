// What each stage gets, held to Benjamin's decisions: production alone has the real address and a model key and is
// never seeded; a name that is no stage of this app is refused, so a deploy without --stage stops.
import { describe, expect, it } from "@effect/vitest"
import { assertTrue } from "@effect/vitest/utils"
import * as A from "effect/Array"
import * as Arbitrary from "effect/Arbitrary"
import * as O from "effect/Option"
import * as Redacted from "effect/Redacted"
import * as Result from "effect/Result"
import * as S from "effect/Schema"
import { StagePlan } from "@beep/infra/Stage"
import {
  accessEmailsFor,
  givenPreviewAccess,
  givenPreviewToken,
  givenSignUpList,
  telemetryFor,
  givenTestPassword,
  kindOf,
  modelKeyFor,
  planFor,
  testPasswordOf
} from "@beep/infra/StagePlan"

const collector = {
  to: "collector",
  address: "TELEMETRY_COLLECTOR_URL",
  authorization: "TELEMETRY_COLLECTOR_AUTHORIZATION"
}

const plan = (stage: string) => {
  const result = planFor(stage)
  assertTrue(Result.isSuccess(result), "Expected result to be a success")
  return result.success
}

describe("the plan of a stage", () => {
  it("production answers at the real address, holds no seed, and reads its model key and sign-up list at deploy", () => {
    expect(plan("prod")).toEqual({
      stage: "prod",
      kind: "production",
      address: { at: "hostname", hostname: "inventory.beep-effect.com", zone: "beep-effect.com" },
      seeds: [],
      modelKey: { from: "environment", variable: "OPENROUTER_API_KEY" },
      signUp: { from: "environment", variable: "SIGN_UP" },
      access: { from: "nowhere" },
      telemetry: collector,
      deployed: true
    })
  })

  it("only staging and production name a collector for Cloudflare's telemetry", () => {
    expect(
      A.map(["prod", "pr-42", "staging", "test_ben", "dev_ben"], (stage) => [stage, plan(stage).telemetry])
    ).toEqual([
      ["prod", collector],
      ["pr-42", { to: "nowhere" }],
      ["staging", collector],
      ["test_ben", { to: "nowhere" }],
      ["dev_ben", { to: "nowhere" }]
    ])
  })

  describe("where a stage's telemetry goes", () => {
    const staging = { stage: "staging", source: plan("staging").telemetry }

    it("is the collector's two paths, with the header it was given", () => {
      expect(
        telemetryFor({
          ...staging,
          address: O.some(" https://otel.example.test/otlp/ "),
          authorization: O.some("Basic abc")
        })
      ).toEqual(
        Result.succeed(
          O.some({
            traces: "https://otel.example.test/otlp/v1/traces",
            logs: "https://otel.example.test/otlp/v1/logs",
            authorization: O.some("Basic abc")
          })
        )
      )
    })

    it("is nowhere while no address is named, with or without a header", () => {
      expect(telemetryFor({ ...staging, address: O.none(), authorization: O.some("Basic abc") })).toEqual(
        Result.succeed(O.none())
      )
      expect(
        telemetryFor({
          stage: "prod",
          source: plan("prod").telemetry,
          address: O.none(),
          authorization: O.none<string>()
        })
      ).toEqual(Result.succeed(O.none()))
    })

    it("is nowhere for a preview, a test stage and a personal one, whatever the variables hold", () => {
      expect(
        A.map(["pr-42", "test_ben", "dev_ben"], (stage) =>
          telemetryFor({
            stage,
            source: plan(stage).telemetry,
            address: O.some("https://otel.example.test"),
            authorization: O.some("Basic abc")
          })
        )
      ).toEqual([Result.succeed(O.none()), Result.succeed(O.none()), Result.succeed(O.none())])
    })

    it("stops on an address that is not https, has a query, or is no address", () => {
      for (const address of [
        "http://otel.example.test",
        "https://otel.example.test/v1?key=abc",
        "otel.example.test",
        "https://"
      ]) {
        const stopped = telemetryFor({ ...staging, address: O.some(address), authorization: O.none<string>() })
        assertTrue(Result.isFailure(stopped), `Expected "${address}" to be refused`)
        expect(stopped.failure.message).toContain("TELEMETRY_COLLECTOR_URL is not an https address without a query")
      }
    })
  })

  it("only a preview is behind Cloudflare Access, and reads who may open it at deploy", () => {
    expect(A.map(["prod", "pr-42", "staging", "test_ben", "dev_ben"], (stage) => [stage, plan(stage).access])).toEqual([
      ["prod", { from: "nowhere" }],
      ["pr-42", { from: "environment", variable: "PREVIEW_ACCESS" }],
      ["staging", { from: "nowhere" }],
      ["test_ben", { from: "nowhere" }],
      ["dev_ben", { from: "nowhere" }]
    ])
  })

  describe("who may open a preview", () => {
    const preview = { stage: "pr-42", source: plan("pr-42").access }

    it("is the emails it is given, lower case, without the spaces around them", () => {
      expect(accessEmailsFor({ ...preview, given: O.some("Ben@Example.test, qa@example.test") })).toEqual(
        Result.succeed(O.some(["ben@example.test", "qa@example.test"]))
      )
      expect(accessEmailsFor({ ...preview, given: O.some("one@example.test") })).toEqual(
        Result.succeed(O.some(["one@example.test"]))
      )
    })

    it("stops with none, and says how to set it without repeating anything", () => {
      const stopped = accessEmailsFor({ ...preview, given: O.none() })
      assertTrue(Result.isFailure(stopped), "Expected stopped to be a failure")
      expect(stopped.failure.message).toBe(
        'Stage "pr-42" has no list of who may open it: PREVIEW_ACCESS is not set, so the preview would answer anyone. ' +
          "Make a 1Password item whose field holds the emails, separated by commas, write " +
          'PREVIEW_ACCESS="op://<vault>/<item>/<field>" in packages/infra/env/op.env.local, and deploy the ' +
          "repository's stack (bun run beep infra setup --staging), which writes it to the preview environment as a secret"
      )
    })

    it("stops on a list with a piece that is no email, and never repeats what it was given", () => {
      for (const given of [
        "",
        " ",
        "ben@example.test,",
        "ben@example.test; qa@example.test",
        "everyone",
        "@example.test"
      ]) {
        const stopped = accessEmailsFor({ ...preview, given: O.some(given) })
        assertTrue(Result.isFailure(stopped), `Expected "${given}" to be refused`)
        expect(stopped.failure.message).toContain("PREVIEW_ACCESS is not a list of emails separated by commas")
        expect(stopped.failure.message).not.toContain("example.test")
      }
    })

    it("a stage with no policy reads nothing, whatever the variable holds", () => {
      expect(
        A.map(["prod", "staging", "test_ben", "dev_ben"], (stage) =>
          accessEmailsFor({ stage, source: plan(stage).access, given: O.some("ben@example.test") })
        )
      ).toEqual([
        Result.succeed(O.none()),
        Result.succeed(O.none()),
        Result.succeed(O.none()),
        Result.succeed(O.none())
      ])
    })
  })

  describe("the lists the repository's stack writes to GitHub", () => {
    it("writes the previews' list as it was given, and only once it reads as emails", () => {
      const given = Redacted.make("Ben@Example.test, qa@example.test")
      expect(givenPreviewAccess(O.some(given))).toEqual(Result.succeed(given))
      for (const text of ["", "ben@example.test,", "everyone"]) {
        const stopped = Redacted.make(text).pipe(O.some, givenPreviewAccess)
        assertTrue(Result.isFailure(stopped), `Expected "${text}" to be refused`)
        expect(stopped.failure.message).toContain("PREVIEW_ACCESS is not a list of emails separated by commas")
      }
      const missing = givenPreviewAccess(O.none())
      assertTrue(Result.isFailure(missing), "Expected a missing list to stop the stack")
      expect(missing.failure.message).toContain("PREVIEW_ACCESS is not set")
    })

    it("stops without production's sign-up list, so a run again never closes production", () => {
      expect(givenSignUpList(O.some("closed"))).toEqual(Result.succeed("closed"))
      const stopped = givenSignUpList(O.none())
      assertTrue(Result.isFailure(stopped), "Expected a missing list to stop the stack")
      expect(stopped.failure.message).toContain("SIGN_UP is not set")
      expect(stopped.failure.message).toContain("op.env.local")
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
    assertTrue(Result.isFailure(refused), "Expected refused to be a failure")
    expect(refused.failure.message).toBe(
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
      assertTrue(Result.isFailure(stopped), "Expected stopped to be a failure")
      expect(stopped.failure.message).toContain(
        "so nobody could sign in to this stage. Write the reference PREVIEW_TEST_ACCOUNT_PASSWORD="
      )
      expect(stopped.failure.message).toContain("to the staging environment as a secret.")
    })

    it("a preview with none stops, with a sentence naming the reference", () => {
      const stopped = givenTestPassword({ stage: "pr-42", given: O.none<string>() })
      assertTrue(Result.isFailure(stopped), "Expected stopped to be a failure")
      expect(stopped.failure.message).toBe(
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
      assertTrue(Result.isFailure(stopped), "Expected stopped to be a failure")
      expect(stopped.failure.message).toBe(
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
      assertTrue(Result.isFailure(stopped), "Expected stopped to be a failure")
      expect(stopped.failure.message).toBe(
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
