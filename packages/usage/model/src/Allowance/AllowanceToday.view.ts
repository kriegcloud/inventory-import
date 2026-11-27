// How many model calls an organization has taken on the day of its last call, kept per allowance and pushed live to a
// reader. The organization is the key, never the state (`initial` is one value for every key), and the forty stay
// the aggregate's. What is left on a given day is not a field and not `computed`: `computed` sees the state only
// (`@alchemy.run/domain/src/View.ts:277`, kept as the static `computed` at :561), and the view moves only when a call
// is taken, so after midnight UTC it still holds yesterday's count until the first call of the new day.
// `leftOn` (`AllowanceLeft.rules.ts`) works it out from the state and today's day number.
//
// Who may read it: every member of the key's organization, viewers included, and nobody else (Benjamin, 2026-11-26:
// "No screen yet; any member may read"). Before move 6 there is no member record to read, so `validate` compares the
// key with the actor's organization; decision 22's check against the member record joins it then. The one thing not
// to break: a filter never grants access, so every read of a key goes through `validate`.
import * as Domain from "@alchemy.run/domain"
import * as Effect from "effect/Effect"
import * as S from "effect/Schema"
import { CurrentActor } from "../Actor/Actor.context.ts"
import { Session } from "../Actor/Session.middleware.ts"
import { Allowance, AllowanceNotFound } from "./Allowance.aggregate.ts"

/** The day of the allowance's last call and how many calls it took: no call yet reads day 0 and none taken. */
export const AllowanceTodayState = S.Struct({
  day: S.Int.pipe(S.annotateKey({ description: "The UTC day of the last call, as days since 1970-01-01" })),
  taken: S.Int.pipe(S.annotateKey({ description: "How many calls that day took" }))
}).annotate({ description: "The day of an organization's last model call, and how many calls that day took" })
/** The decoded value of `AllowanceTodayState`. */
export type AllowanceTodayState = typeof AllowanceTodayState.Type

/** One organization's count of the day's model calls, as a member's screen follows it. */
export class AllowanceToday extends Domain.View(
  "AllowanceToday",
  {
    from: [Allowance],
    key: Allowance,
    middleware: [Session],
    rejects: [AllowanceNotFound],
    state: AllowanceTodayState,
    initial: { day: 0, taken: 0 },
    evolve: {
      CallTaken: (s, e) => (e.day === s.day ? { day: s.day, taken: s.taken + 1 } : { day: e.day, taken: 1 })
    },
    // The library's count of changes to what the view computes, 0 by default (`@alchemy.run/domain/src/View.ts:260`):
    // a bump rebuilds every key from the history. The view has never been deployed, so nothing is rebuilt from an
    // earlier version and it starts at 0. Once a deploy is kept, raise it with any change to what the view computes
    // (`View.ts:260-263`): `evolve`, `emit`, `keyOf`, `state`, or the events and sources it reads (`from`).
    version: 0
  },
  { description: "How many of the day's model calls an organization has taken, on the day of its last call" }
) {}

/**
 * Who may read a key of `AllowanceToday`: a member of the organization the key is, whatever their role. A member of
 * another organization is refused `AllowanceNotFound`, on every read and on every change while they watch.
 */
export const AllowanceTodayLive = AllowanceToday.toLayer(
  Effect.succeed(
    Effect.fn("AllowanceToday.validate")(function* (request) {
      const actor = yield* CurrentActor
      if (request.key.id !== actor.organizationId) return yield* AllowanceNotFound.make({})
    })
  )
)
