// A diary that writes down the UTC day of its last entry: the smallest model whose `decide` reads `now` and records
// what it read. Verify's search runs every command of a short sequence at one time, the solver's first, and a story
// starts at 2026-01-01; the day written is what tells the two apart.
import * as Domain from "@alchemy.run/domain"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as S from "effect/Schema"

/** A UTC day, in milliseconds. */
const dayMs = 86_400_000

/** An entry was written on this UTC day, as days since 1970-01-01. */
export class EntryWritten extends Domain.Event("EntryWritten", { day: S.Int }) {}

/** Write an entry today. */
export class WriteEntry extends Domain.Command("WriteEntry", { input: {}, events: [EntryWritten] }) {}

/** One diary: the day of its last entry, or none. */
export class Diary extends Domain.Aggregate("Diary", {
  id: S.String,
  state: S.Struct({ day: S.Int }),
  initial: { day: -1 },
  commands: [WriteEntry],
  keyOf: () => "diary",
  decide: {
    WriteEntry: Effect.fn("Diary.WriteEntry")(function* (_s, _cmd, { now }) {
      return [EntryWritten.make({ day: Math.floor(DateTime.toEpochMillis(now) / dayMs) })]
    })
  },
  evolve: {
    EntryWritten: (_s, e) => ({ day: e.day })
  }
}) {}

/** The diary as a model of its own. */
export class Diaries extends Domain.Model("Diaries", { aggregates: [Diary] }) {}

/** What a client may send: an entry. */
export class DiaryApi extends Domain.Api("DiaryApi", {
  model: Diaries,
  commands: ["WriteEntry"],
  views: [],
  streams: [],
  queries: []
}) {}
