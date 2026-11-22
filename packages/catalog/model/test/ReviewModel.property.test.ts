// Two things every schema and every declaration of the review's model owes. A named schema generates only values it
// accepts, so a property drawn from it never tests a value the model would refuse. And every command, event and
// rejection, each aggregate and decision, the model and its Api say in words what they are: an Api's tool list, its
// command line and its OpenAPI document are written from those words.
import { describe, expect, it } from "@effect/vitest"
import * as A from "effect/Array"
import * as Arbitrary from "effect/Arbitrary"
import * as S from "effect/Schema"
import { Actor } from "../src/Actor/Actor.context.ts"
import { Catalog, CatalogApi } from "../src/Catalog.model.ts"
import { GroupState } from "../src/Group/Group.aggregate.ts"
import { ImportState } from "../src/Import/Import.aggregate.ts"
import { Change, Columns, Flags, Patch, Rows, Step } from "../src/Review/Change.schema.ts"
import { Label } from "../src/Review/Deciding.decision.ts"
import { Level, RowState } from "../src/Row/Row.aggregate.ts"

describe("generates only valid values", () => {
  it.prop("Step", [Arbitrary.schema(Step)], ([value]) => {
    expect(S.is(Step)(value)).toBe(true)
  })
  it.prop("Change", [Arbitrary.schema(Change)], ([value]) => {
    expect(S.is(Change)(value)).toBe(true)
  })
  it.prop("Columns", [Arbitrary.schema(Columns)], ([value]) => {
    expect(S.is(Columns)(value)).toBe(true)
  })
  it.prop("Flags", [Arbitrary.schema(Flags)], ([value]) => {
    expect(S.is(Flags)(value)).toBe(true)
  })
  it.prop("Rows", [Arbitrary.schema(Rows)], ([value]) => {
    expect(S.is(Rows)(value)).toBe(true)
  })
  it.prop("Patch", [Arbitrary.schema(Patch)], ([value]) => {
    expect(S.is(Patch)(value)).toBe(true)
  })
  it.prop("Label", [Arbitrary.schema(Label)], ([value]) => {
    expect(S.is(Label)(value)).toBe(true)
  })
  it.prop("Actor", [Arbitrary.schema(Actor)], ([value]) => {
    expect(S.is(Actor)(value)).toBe(true)
  })
  it.prop("Level", [Arbitrary.schema(Level)], ([value]) => {
    expect(S.is(Level)(value)).toBe(true)
  })
  it.prop("RowState", [Arbitrary.schema(RowState)], ([value]) => {
    expect(S.is(RowState)(value)).toBe(true)
  })
  it.prop("GroupState", [Arbitrary.schema(GroupState)], ([value]) => {
    expect(S.is(GroupState)(value)).toBe(true)
  })
  it.prop("ImportState", [Arbitrary.schema(ImportState)], ([value]) => {
    expect(S.is(ImportState)(value)).toBe(true)
  })
})

describe("says what it is", () => {
  /** The names of the declarations that carry no description. */
  const silent = (declared: ReadonlyArray<{ readonly name: string; readonly description: string | undefined }>) =>
    A.map(
      A.filter(declared, (one) => one.description === undefined || one.description === ""),
      (one) => one.name
    )

  it("every command, event and rejection of the model", () => {
    const commands = [...Catalog.commands]
    expect(commands.length).toBe(11)
    expect(
      silent([
        ...A.map(commands, (command) => ({ name: command.tag, description: command.annotations.description })),
        ...A.flatMap(commands, (command) => [
          ...A.map(command.events, (event) => ({ name: event.tag, description: event.annotations.description })),
          ...A.map(command.rejects, (rejection) => ({
            name: rejection.tag,
            description: rejection.annotations.description
          }))
        ])
      ])
    ).toEqual([])
  })

  it("each aggregate, each decision, the model and its Api", () => {
    expect(
      silent([
        ...A.map(Catalog.aggregates, (aggregate) => ({
          name: aggregate.aggregateName,
          description: aggregate.annotations.description
        })),
        ...A.map(Catalog.decisions, (decision) => ({
          name: decision.command.tag,
          description: decision.annotations.description
        })),
        { name: Catalog.modelName, description: Catalog.annotations.description },
        { name: CatalogApi.apiName, description: CatalogApi.annotations.description }
      ])
    ).toEqual([])
  })
})
