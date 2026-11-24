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
import verifyDoc from "../../../../docs/verify.md?raw"
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
  it("finds in the table of docs/verify.md the lock's own counts, by whose rule each is", () => {
    // The first seven add up, with the two relations, to the rules that must stay proved (`Catalog.verify.test.ts`).
    // A rule's name starts with whose it is; the model's own start with its name, and are told by their kind.
    const owners = A.map(R.toEntries(lock.rules.Catalog), ([name, rule]) => {
      const owner = A.headNonEmpty(Str.split(".")(name))
      return owner === "Catalog" ? rule.kind : owner
    })
    const count = (owner: string): number => A.filter(owners, (whose) => whose === owner).length
    // The table's rows as the page has them: the words of the first cell, and the number in the second.
    const rows = A.getSomes(
      A.map(Str.split("\n")(verifyDoc), (line) =>
        O.flatMap(Str.match(/^\| ([^|]+) \| (\d+) \|/)(line), (found) =>
          O.map(
            O.all([O.fromUndefinedOr(found[1]), O.fromUndefinedOr(found[2])]),
            ([words, count]) => `${words}: ${count}`
          )
        )
      )
    )
    expect(rows).toEqual([
      `The import's own (\`Import\`): ${count("Import")}`,
      `The row's own (\`Row\`): ${count("Row")}`,
      `An act on a group's own (\`Group\`): ${count("Group")}`,
      `An act on a row (\`DecideRow\`): ${count("DecideRow")}`,
      `Its undo (\`UndoRowStep\`): ${count("UndoRowStep")}`,
      `An act on a group (\`DecideGroup\`): ${count("DecideGroup")}`,
      `Its undo (\`UndoGroup\`): ${count("UndoGroup")}`,
      `Between an import and one row, or one group: ${count("relation")}`,
      `Over every import, row and group at once: ${count("model invariant")}`,
      `That each command can be taken: ${count("sometimes")}`
    ])
    // Every rule of the lock is in one row of the table.
    expect(A.length(owners)).toBe(
      A.reduce(
        [
          "Import",
          "Row",
          "Group",
          "DecideRow",
          "UndoRowStep",
          "DecideGroup",
          "UndoGroup",
          "relation",
          "model invariant",
          "sometimes"
        ],
        0,
        (sum, owner) => sum + count(owner)
      )
    )
  })
})
