// The check of ours that a decision recording on a row or a group says whose act it records (`missingRules`): what
// it asks is taken from the decision's own class, so the list of rules by event cannot fall behind an event.
import { describe, expect, it } from "@effect/vitest"
import * as A from "effect/Array"
import * as O from "effect/Option"
import * as R from "effect/Record"
import * as Str from "effect/String"
import { Group } from "../src/Group/Group.aggregate.ts"
import { Deciding } from "../src/Review/Deciding.decision.ts"
import { DecidingGroup } from "../src/Review/DecidingGroup.decision.ts"
import { Undoing } from "../src/Review/Undoing.decision.ts"
import { UndoingGroup } from "../src/Review/UndoingGroup.decision.ts"
import { Row } from "../src/Row/Row.aggregate.ts"
import lock from "./Catalog.lock.json" with { type: "json" }
import { missingRules, recordsWithNoCommand, ruleOfWhoMayChange } from "./proving.ts"

/** A report that states no rule: the check reads the report's reads and its rules only. */
const nothingProved = { reads: [], rules: [] }

describe("what a decision must say of whose act it records", () => {
  it("reads the events from the decision itself: each of the four records one on a row or a group", () => {
    expect(recordsWithNoCommand(Deciding)).toEqual(["RowDecided"])
    expect(recordsWithNoCommand(Undoing)).toEqual(["StepUndone"])
    expect(recordsWithNoCommand(DecidingGroup)).toEqual(["GroupDecided"])
    expect(recordsWithNoCommand(UndoingGroup)).toEqual(["GroupUndone"])
  })
  it("has rules listed for every event of a row and of a group", () => {
    const events = A.map([...Row.definition.events, ...Group.definition.events], (event) => event.tag)
    expect(A.filter(events, (tag) => !R.has(ruleOfWhoMayChange, tag))).toEqual([])
  })
  it("names an event recorded on an aggregate with no command for which no rule is listed", () => {
    const trial = {
      command: { events: [{ tag: "RowMoved" }, { tag: "ActCounted" }] },
      reads: {
        life: { definition: { commands: [{}], events: [{ tag: "ActCounted" }] } },
        row: { definition: { commands: [], events: [{ tag: "RowDecided" }, { tag: "RowMoved" }] } }
      }
    }
    expect(recordsWithNoCommand(trial)).toEqual(["RowMoved"])
    expect(missingRules({ report: nothingProved, decision: trial })).toEqual([
      "no rule of who may change is listed for RowMoved"
    ])
  })
  it("names each rule a decision that takes a row's decision back does not state", () => {
    expect(missingRules({ report: nothingProved, decision: Undoing })).toEqual([
      "does not state NobodyClearsAnotherPersonsDecision",
      "does not state OnlyItsOwnOrganizationChangesTheRow",
      "does not state AViewerChangesNoRow"
    ])
  })
  it("counts the lock's rules as the table in docs/verify.md states them, by whose rule each is", () => {
    // The first seven add up, with the two relations, to the rules that must stay proved (`Catalog.verify.test.ts`).
    // A rule's name starts with whose it is; the model's own start with its name, and are told by their kind.
    const owners = A.map(R.toEntries(lock.rules.Catalog), ([name, rule]) => {
      const owner = O.getOrElse(A.head(Str.split(".")(name)), () => "")
      return owner === "Catalog" ? rule.kind : owner
    })
    const count = (owner: string): number => A.filter(owners, (whose) => whose === owner).length
    expect({
      Import: count("Import"),
      Row: count("Row"),
      Group: count("Group"),
      DecideRow: count("DecideRow"),
      UndoRowStep: count("UndoRowStep"),
      DecideGroup: count("DecideGroup"),
      UndoGroup: count("UndoGroup"),
      between: count("relation"),
      overAll: count("model invariant"),
      canBeTaken: count("sometimes")
    }).toEqual({
      Import: 37,
      Row: 6,
      Group: 10,
      DecideRow: 26,
      UndoRowStep: 28,
      DecideGroup: 20,
      UndoGroup: 14,
      between: 2,
      overAll: 8,
      canBeTaken: 11
    })
  })
})
