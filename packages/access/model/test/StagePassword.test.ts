// The test accounts' password on a deployed stage (decision "infra, the test accounts' password"): the stage's own
// opens them, and the one written in the repository opens nothing there.
import { describe, expect, it } from "@effect/vitest"
import * as O from "effect/Option"
import { passwordToVerify } from "@inventory/access-model/StagePassword"

const repository = "local-test-password"
const onStage = (typed: string) => passwordToVerify({ stage: O.some("9c41d0aa72e6b3f5d2a17c08"), repository, typed })

describe("the password held against a stored hash", () => {
  it("is what the person typed where no stage password is set: a developer's machine, and production", () => {
    expect(passwordToVerify({ stage: O.none(), repository, typed: repository })).toEqual(O.some(repository))
    expect(passwordToVerify({ stage: O.none(), repository, typed: "her-own-password" })).toEqual(
      O.some("her-own-password")
    )
  })

  it("is the repository's when the stage's own password is typed, so a seeded test account opens", () => {
    expect(onStage("9c41d0aa72e6b3f5d2a17c08")).toEqual(O.some(repository))
  })

  it("is nothing when the repository's password is typed on a stage with its own: refused without a look", () => {
    expect(onStage(repository)).toEqual(O.none())
  })

  it("is what was typed for any other password, and a near miss of the stage's is not the stage's", () => {
    expect(onStage("her-own-password")).toEqual(O.some("her-own-password"))
    expect(onStage("9c41d0aa72e6b3f5d2a17c0")).toEqual(O.some("9c41d0aa72e6b3f5d2a17c0"))
    expect(onStage("9c41d0aa72e6b3f5d2a17c089")).toEqual(O.some("9c41d0aa72e6b3f5d2a17c089"))
    expect(onStage("")).toEqual(O.some(""))
  })
})
