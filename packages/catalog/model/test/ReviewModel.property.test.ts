// What every schema and every declaration of the review's model owes. A generator can be made from each named schema
// and gives only values the schema accepts (docs/standards/schema-first.md, SF-7): that fails for a schema whose checks
// no generator can meet, or whose own generator disagrees with it, and says nothing of what the bounds are, since the
// generator is made from the same checks. So the bounds a rule or a comment leans on are stated once more as values
// that must be refused. And every command, event and
// rejection, each aggregate and decision, the model and its Api say in words what they are: an Api's tool list, its
// command line and its OpenAPI document are written from those words.
import { describe, expect, it } from "@effect/vitest"
import * as A from "effect/Array"
import * as Arbitrary from "effect/Arbitrary"
import * as S from "effect/Schema"
import * as O from "effect/Option"
import * as Str from "effect/String"
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

describe("refuses what its bounds say", () => {
  it("a step is never empty and at most 64 characters", () => {
    expect(S.is(Step)("")).toBe(false)
    expect(S.is(Step)(Str.repeat(64)("s"))).toBe(true)
    expect(S.is(Step)(Str.repeat(65)("s"))).toBe(false)
  })
  it("a group names at least one row, in at most a million characters", () => {
    expect(S.is(Rows)("")).toBe(false)
    expect(S.is(Rows)(Str.repeat(1_000_000)("r"))).toBe(true)
    expect(S.is(Rows)(Str.repeat(1_000_001)("r"))).toBe(false)
  })
  it("the ids of 50,000 items at their longest fit in one group", () => {
    // "row-1234567.1234" is the longest id the contract's `RowId` allows: 16 characters.
    const longest = `[${A.join(
      A.makeBy(50_000, () => '"row-1234567.1234"'),
      ","
    )}]`
    expect(longest.length).toBe(950_001)
    expect(S.is(Rows)(longest)).toBe(true)
  })
  it("a decision's text, a patch, a label and a match's columns are bounded", () => {
    expect(S.is(Flags)(Str.repeat(600_001)("f"))).toBe(false)
    expect(S.is(Patch)(Str.repeat(10_001)("p"))).toBe(false)
    expect(S.is(Label)(Str.repeat(201)("l"))).toBe(false)
    expect(S.is(Columns)(Str.repeat(10_001)("c"))).toBe(false)
  })
  it("a change is a whole number", () => {
    expect(S.is(Change)(1.5)).toBe(false)
  })
})

describe("says what it is", () => {
  /** The names of the declarations that carry no description. */
  const silent = (declared: ReadonlyArray<{ readonly name: string; readonly description: string | undefined }>) =>
    A.map(
      A.filter(declared, (one) => !O.exists(O.fromUndefinedOr(one.description), Str.isNonEmpty)),
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
