// What each stage gets, held to Benjamin's decisions: production alone has the real address and a model key and is
// never seeded; a name that is no stage of this app is refused, so a deploy without --stage stops.
import { describe, expect, it } from "@effect/vitest"
import * as A from "effect/Array"
import * as Arbitrary from "effect/Arbitrary"
import * as Result from "effect/Result"
import * as S from "effect/Schema"
import { StagePlan } from "@beep/infra/Stage"
import { hasOwnTestPassword, kindOf, planFor } from "@beep/infra/StagePlan"

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
    const others = A.map(["pr-1", "pr-999", "test_a", "dev_a"], plan)
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
      "staging",
      "test_",
      "",
      "prod "
    ]) {
      const refused = planFor(name)
      expect([name, Result.isFailure(refused)]).toEqual([name, true])
    }
    const refused = kindOf("live_ben")
    expect(Result.isFailure(refused) ? refused.failure.message : "").toBe(
      '"live_ben" is not a stage of this app. Name one with --stage: prod, pr-<number>, test_<user> or dev_<user>.'
    )
  })

  it.prop(
    "every plan a stage name gives is a valid plan",
    [Arbitrary.schema(S.Literals(["prod", "pr-7", "test_x", "dev_x"]))],
    ([name]) => {
      expect(S.is(StagePlan)(plan(name))).toBe(true)
    }
  )

  it.prop("the plan schema generates only valid values", [Arbitrary.schema(StagePlan)], ([value]) => {
    expect(S.is(StagePlan)(value)).toBe(true)
  })

  it("every deployed stage with test accounts has its own password for them; the repository's is for a developer's machine", () => {
    expect(
      A.map(["prod", "pr-42", "test_ben", "dev_ben"], (stage) => [stage, hasOwnTestPassword(plan(stage))])
    ).toEqual([
      ["prod", false],
      ["pr-42", true],
      ["test_ben", true],
      ["dev_ben", false]
    ])
  })
})
