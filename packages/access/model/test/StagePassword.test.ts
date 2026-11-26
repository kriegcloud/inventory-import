// The test accounts' password on a deployed stage (decision "infra, the test accounts' password"): the stage's own
// opens them, and the one written in the repository opens nothing there.
import { describe, expect, it } from "@effect/vitest"
import * as O from "effect/Option"
import * as Arbitrary from "effect/Arbitrary"
import * as S from "effect/Schema"
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

// The comparator's zero padding must never confuse unequal lengths or UTF-16 code units.
it.prop(
  "stage password selection agrees with exact text equality",
  [Arbitrary.schema(S.String), Arbitrary.schema(S.String), Arbitrary.schema(S.String)],
  ([stage, repository, typed]) => {
    expect(passwordToVerify({ stage: O.some(stage), repository, typed })).toEqual(
      typed === stage ? O.some(repository) : typed === repository ? O.none() : O.some(typed)
    )
  }
)

it("keeps empty, NUL, and surrogate code units distinct", () => {
  for (const stage of ["", "\0", "a\0", "😀", "\ud800", "\udfff"]) {
    for (const typed of ["", "\0", "a", "a\0", "😀", "\ud800", "\udfff"]) {
      expect(passwordToVerify({ stage: O.some(stage), repository, typed })).toEqual(
        typed === stage ? O.some(repository) : O.some(typed)
      )
    }
  }
})
