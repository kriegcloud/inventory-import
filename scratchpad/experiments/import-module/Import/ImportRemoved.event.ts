// One event of the import, and what it makes of an import.
import * as Domain from "@alchemy.run/domain"
import * as S from "effect/Schema"
import { Change } from "../Review/Change.schema.ts"
import { ImportState } from "./Import.state.ts"

/** An open import with nothing in force was removed. */
export class Event extends Domain.Event(
  "ImportRemoved",
  { change: Change, by: S.String },
  { description: "An import with nothing in force was removed" }
) {}

/** What an import is after `ImportRemoved`. */
export const evolve = (s: ImportState): ImportState =>
  ImportState.guards.Open(s)
    ? ImportState.cases.Removed.make({ status: "Removed", organizationId: s.organizationId })
    : s
