// `CatalogApi` served in process, through the `Session` middleware every command names, on the memory host: each
// command it serves is sent by nobody, by a viewer, and by a member of another organization, and each is refused, with
// nothing committed. Verify assumes the middleware lets every caller in and the stories provide `CurrentActor`
// themselves, so this is where `Session` runs and where "another organization starts from nothing" is held for every
// call a client can send. Said plainly: a test of each served call, not a proof.
//
// The one thing not to break: the cases are the Api's own list. An entry the Api serves with no case here fails by
// name, so a command served later cannot join untested.
import type * as Api from "@alchemy.run/domain/Api"
import * as InMemory from "@alchemy.run/domain/InMemory"
import { describe, expect, it } from "@effect/vitest"
import { ImportId, RowId } from "@inventory/catalog-contract/Ids"
import { NotSignedIn } from "@inventory/kernel/AccessError"
import * as A from "effect/Array"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as O from "effect/Option"
import * as Order from "effect/Order"
import * as R from "effect/Record"
import * as S from "effect/Schema"
import type { Actor } from "../src/Actor/Actor.context.ts"
import type { Session } from "../src/Actor/Session.middleware.ts"
import { CatalogApi } from "../src/Catalog.api.ts"
import { Catalog } from "../src/Catalog.model.ts"
import {
  AlreadyStaged,
  ImportNotFound,
  MatchedSince,
  NoImportThere,
  NotClosed,
  NotImported,
  NotPermitted,
  ReviewMovedOn
} from "../src/Import/Import.aggregate.ts"
import { NotYourStep } from "../src/Review/Undoing.decision.ts"
import { noLevel } from "../src/Row/Row.aggregate.ts"
import { noSession, sessionAs } from "./session.ts"

const importId = ImportId.make("0190a5c2-7b1e-4c3a-9f10-4d2e8b6a1c55")
const row = RowId.make("row-2")
const ana: Actor = { organizationId: "org_prairie", memberId: "ana", role: "editor" }
const priya: Actor = { organizationId: "org_prairie", memberId: "priya", role: "viewer" }
// An admin of the second organization: a role is no key to another organization's imports.
const elena: Actor = { organizationId: "org_northline", memberId: "elena", role: "admin" }

/** The client of `CatalogApi`, as a caller holds it. */
type Client = Context.Service.Shape<typeof CatalogApi.Client>

/** What a refusal says, as plain data a test compares; anything else is left as it came, so a diff shows it whole. */
const told = (refusal: unknown): unknown =>
  S.is(NotPermitted)(refusal)
    ? { refused: refusal._tag, required: refusal.required }
    : S.is(ImportNotFound)(refusal)
      ? { refused: refusal._tag, reason: refusal.reason }
      : S.is(NotSignedIn)(refusal)
        ? { refused: refusal._tag }
        : refusal

/** A call's answer as data: what it was refused with, or that it was taken. */
const answer = <A, E>(call: Effect.Effect<A, E>): Effect.Effect<unknown> =>
  Effect.match(call, { onFailure: told, onSuccess: (receipt) => ({ accepted: receipt }) })

/**
 * One call of each command the Api serves, on the import `ana` staged, sent in this order. They are not all valid as
 * written: from an editor of Prairie most are refused by the import's state (staged already, moved on, not closed),
 * and only the first match and the suggestion are taken. So a test of who sends them compares each refusal exactly,
 * by its tag and its fields, never "refused or not"; the editor's own answers are held below, so a case that starts
 * being refused for who sends it fails by name.
 */
const cases: Readonly<Record<string, (client: Client) => Effect.Effect<unknown>>> = {
  StageImport: (client) => answer(client.StageImport({ importId, rows: 3, columns: "by heading" })),
  MatchColumn: (client) => answer(client.MatchColumn({ importId, columns: "sku: A", saw: 0, opening: 0 })),
  RecordSuggestion: (client) => answer(client.RecordSuggestion({ importId })),
  ConfirmImport: (client) =>
    answer(
      client.ConfirmImport({
        importId,
        seen: 0,
        planAt: 0,
        shown: "plan",
        plan: "plan",
        created: 3,
        updated: 0,
        already: 0,
        notImported: 0
      })
    ),
  TakeBackImport: (client) => answer(client.TakeBackImport({ importId, seen: 0, kept: 0, keptReplaced: 0 })),
  ReopenImport: (client) => answer(client.ReopenImport({ importId, seen: 0 })),
  RemoveImport: (client) => answer(client.RemoveImport({ importId, seen: 0 })),
  DecideRow: (client) =>
    answer(
      client.DecideRow({
        importId,
        row,
        step: "s1",
        sawGroup: 0,
        covered: false,
        asItReads: false,
        opening: 0,
        saw: 0,
        sawUndone: 0,
        flags: '{"out":true}',
        madeOn: 0,
        label: "Decide"
      })
    ),
  UndoRowStep: (client) =>
    answer(
      client.UndoRowStep({
        importId,
        row,
        undo: 1,
        step: "s2",
        sawGroup: 0,
        covered: false,
        madeOn: 0,
        sawUndone: 0,
        opening: 0,
        next: noLevel,
        below: ""
      })
    ),
  DecideGroup: (client) =>
    answer(
      client.DecideGroup({
        importId,
        step: "g1",
        opening: 0,
        seen: 0,
        madeOn: 0,
        patch: '{"accept":"unit"}',
        rows: "row-2,row-3",
        count: 2,
        label: "2 fixes accepted"
      })
    ),
  UndoGroup: (client) => answer(client.UndoGroup({ importId, step: "g1", undo: 1, opening: 0, seen: 0 }))
}

/** The name of an entry an Api serves: a command's tag, a view's, stream's or query's name. */
const nameOf = (entry: Api.Servable): string => {
  switch (entry.kind) {
    case "Command":
      return entry.tag
    case "View":
      return entry.viewName
    case "Stream":
      return entry.streamName
    case "Query":
      return entry.queryName
  }
}

/**
 * The model on a memory host of its own, and the record of every event a command committed. `clientAs` builds a client
 * of `CatalogApi` over it whose every call runs through `session`, as a Worker builds one per request.
 */
const hosted = Effect.gen(function* () {
  const memory = InMemory.make()
  const model = yield* Layer.build(Catalog.layer(Layer.empty).pipe(Layer.provide(memory.layer)))
  const clientAs = (session: Layer.Layer<Session>) =>
    Effect.map(
      Layer.build(
        CatalogApi.layerClientInProcess.pipe(Layer.provide(Layer.merge(session, Layer.succeedContext(model))))
      ),
      Context.get(CatalogApi.Client)
    )
  return { clientAs, control: memory.control }
})

/**
 * Sends every case as `caller`, after `ana` staged the import, and gives each one's answer and how many events were
 * committed once `ana` had staged and once every case had been sent.
 */
const answersOf = Effect.fnUntraced(function* (caller: Layer.Layer<Session>) {
  const { clientAs, control } = yield* hosted
  const asAna = yield* clientAs(sessionAs(ana))
  yield* asAna.StageImport({ importId, rows: 3, columns: "by heading" })
  const staged = control.commits.length
  const client = yield* clientAs(caller)
  const answers = yield* Effect.forEach(
    R.toEntries(cases),
    ([name, send]) => Effect.map(send(client), (said) => [name, said] as const),
    { concurrency: 1 }
  )
  return { answers: R.fromEntries(answers), staged, after: control.commits.length }
}, Effect.scoped)

/**
 * The refusals the import's state answers an editor's calls with, each under the name a test reads it by. A refusal is
 * told apart by its own class, never by its tag.
 */
const byState = [
  ["AlreadyStaged", AlreadyStaged],
  ["ReviewMovedOn", ReviewMovedOn],
  ["NotImported", NotImported],
  ["NotClosed", NotClosed],
  ["MatchedSince", MatchedSince],
  ["NotYourStep", NotYourStep]
] as const

/** A call's answer by its name alone: who it was refused to, the import's state that refused it, or "accepted". */
const named = (said: unknown): string =>
  S.is(S.Struct({ refused: S.String }))(said)
    ? said.refused
    : O.match(
        A.findFirst(byState, ([, refusal]) => S.is(refusal)(said)),
        {
          onSome: ([name]) => name,
          onNone: () => (S.is(S.Struct({ accepted: S.Unknown }))(said) ? "accepted" : "something else")
        }
      )

describe("CatalogApi, served in process through Session", () => {
  it("has a case for every entry it serves, and no case for one it does not", () => {
    expect(A.sort(A.map(CatalogApi.serves, nameOf), Order.String)).toEqual(A.sort(R.keys(cases), Order.String))
  })

  it.effect("an editor of the import's organization stages it: the session names who acts", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const { clientAs, control } = yield* hosted
        const client = yield* clientAs(sessionAs(ana))
        yield* client.StageImport({ importId, rows: 3, columns: "by heading" })
        expect(control.commits).toEqual([{ aggregate: "Import", id: importId, index: 0 }])
      })
    )
  )

  // The same calls from an editor of Prairie: each is answered by the import's state, and none by who sends it, so
  // the three tests after this one say something about the sender and not about the calls.
  it.effect("an editor of Prairie is answered every case by the import's state, never as the sender", () =>
    Effect.gen(function* () {
      const { answers } = yield* answersOf(sessionAs(ana))
      expect(R.map(answers, named)).toEqual({
        StageImport: "AlreadyStaged",
        MatchColumn: "accepted",
        RecordSuggestion: "accepted",
        ConfirmImport: "ReviewMovedOn",
        TakeBackImport: "NotImported",
        ReopenImport: "NotClosed",
        RemoveImport: "ReviewMovedOn",
        DecideRow: "MatchedSince",
        UndoRowStep: "NotYourStep",
        DecideGroup: "ReviewMovedOn",
        UndoGroup: "NotYourStep"
      })
    })
  )

  it.effect("with no session every command is refused NotSignedIn, and nothing is committed", () =>
    Effect.gen(function* () {
      const { answers, staged, after } = yield* answersOf(noSession)
      expect(answers).toEqual(R.map(cases, () => ({ refused: "NotSignedIn" })))
      expect(after).toBe(staged)
    })
  )

  it.effect("a viewer is refused every command NotPermitted, naming the editor role, and nothing is committed", () =>
    Effect.gen(function* () {
      const { answers, staged, after } = yield* answersOf(sessionAs(priya))
      expect(answers).toEqual(R.map(cases, () => ({ refused: "NotPermitted", required: "editor" })))
      expect(after).toBe(staged)
    })
  )

  it.effect(
    "a member of another organization is answered every command as for an import that does not exist, and nothing is committed",
    () =>
      Effect.gen(function* () {
        const { answers, staged, after } = yield* answersOf(sessionAs(elena))
        expect(answers).toEqual(R.map(cases, () => ({ refused: "ImportNotFound", reason: NoImportThere })))
        expect(after).toBe(staged)
      })
  )
})
