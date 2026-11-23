// A save names the opening its screen decided in (how many times the import had been confirmed then), through the
// same `fetch` the Worker exports. What must not break: a save is written only in the opening it names. One decided
// before a confirm and sent after the import was confirmed and opened again is refused with 409 and nothing of it is
// written, the draft's revision where it was; one naming more confirms than the import has had is refused too, in
// words that do not say it was imported; and a save that leaves `opening` out is a 400 naming it, never a guess.
// Storage is the in-memory twin; the D1 adapter's guard is the same rule (ConfirmRevision.slow.test.ts).
import { expect, layer } from "@effect/vitest"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as O from "effect/Option"
import * as R from "effect/Record"
import * as S from "effect/Schema"
import * as Str from "effect/String"
import * as FetchHttpClient from "effect/http/FetchHttpClient"
import * as HttpApiClient from "effect/http-api/HttpApiClient"
import messy from "../../public/samples/items_messy.csv?raw"
import { Api } from "../../src/api/v1/Api.ts"
import { decisionFromFlags, SaveRequest } from "@inventory/catalog-contract/Decision"
import { AlreadyImported } from "@inventory/catalog-contract/ImportRejection"
import { ModelId } from "@beep/openrouter/OpenRouterModel"
import { OpenRouterTest } from "@beep/openrouter/OpenRouterTest"
import { MemberId, OrganizationId } from "@inventory/kernel/Ids"
import { Member } from "@inventory/kernel/Member"
import { inMemoryApp, send, TestFetch, testOrigin } from "./support/app.ts"
import { stage } from "./support/files.ts"
import { upload } from "./support/upload.ts"

const marcus = Member.make({
  id: MemberId.make("mem_marcus"),
  name: "Marcus Oyelaran",
  role: "editor",
  organizationId: OrganizationId.make("org_prairie"),
  organizationName: "Example Works (test)"
})

const Worker = TestFetch.layer(
  inMemoryApp({ member: marcus, ai: OpenRouterTest.off("noKey", ModelId.make("test/model")) })
)

/** An HTTP client whose every request goes to the Worker's own `fetch`. */
const ToWorker = FetchHttpClient.layer.pipe(
  Layer.provide(
    Layer.effect(
      FetchHttpClient.Fetch,
      Effect.gen(function* () {
        const { handle } = yield* TestFetch
        return (input: string | URL | Request, init?: RequestInit) => handle(new Request(input, init))
      })
    )
  )
)

const App = Layer.provideMerge(ToWorker, Worker)

/** The typed client, its requests sent through the Worker's own `fetch`. */
const client = HttpApiClient.make(Api, { baseUrl: testOrigin })

const encodeSave = S.encodeEffect(SaveRequest)
const ImportRead = S.Struct({ revision: S.Int, status: S.String, decisions: S.Record(S.String, S.Unknown) })
const readImport = S.decodeUnknownEffect(ImportRead)
/** The 409's body read as the error the API names: it decodes only when it is that one. */
const readAlreadyImported = S.decodeUnknownEffect(AlreadyImported)
const ProblemDocument = S.Struct({
  errors: S.Array(S.Struct({ path: S.Array(S.Union([S.String, S.Int])), message: S.String }))
})
const readProblem = S.decodeUnknownEffect(ProblemDocument)

const accept = { "row-55": decisionFromFlags({ accepted: ["unitCost"] }) }
/** Row 55's accept as JSON, for a payload the Schema would refuse to encode. */
const encodeAccept = S.encodeEffect(SaveRequest.fields.set)(accept)
const reopenedWords = "opened again since this was decided"

/** The messy sample staged; and, with `reopened`, confirmed once and opened again, so it is in its second opening. */
const staged = Effect.fn("test.staged")(function* (reopened: boolean) {
  const api = yield* client
  const table = yield* stage(new File([messy], "items_messy.csv"))
  const view = yield* upload({ client: api, table })
  const params = { id: view.id }
  const path = `/api/v1/imports/${view.id}`
  if (!reopened) return { api, params, path, revision: view.revision }
  yield* api.imports.commit({ params, payload: { revision: view.revision, madeOn: {}, set: {}, clear: [] } })
  const again = yield* api.imports.reopen({ params })
  return { api, params, path, revision: again.revision }
})

/** The import as stored now: its status, its revision and its decisions. */
const read = (path: string) => Effect.flatMap(send({ path }), (answer) => readImport(answer.json))

/** A body sent as a save of decisions, as raw JSON through the Worker's `fetch`. */
const put = (path: string, body: unknown) => send({ path: `${path}/decisions`, method: "PUT", body })
/** A save of decisions, encoded as a screen sends it. */
const save = (path: string, request: SaveRequest) => Effect.flatMap(encodeSave(request), (body) => put(path, body))

layer(App)("a save names the opening its screen decided in", (it) => {
  it.effect("left out, it is a 400 that names `opening`, and nothing is written", () =>
    Effect.gen(function* () {
      const { path, revision } = yield* staged(false)
      const set = yield* encodeAccept
      const answer = yield* put(path, { madeOn: { "row-55": revision }, set, clear: [] })
      expect(answer.status).toBe(400)
      const problem = yield* readProblem(answer.json)
      expect(A.map(problem.errors, (issue) => [issue.path, issue.message])).toEqual([
        [["payload", "opening"], "Send `opening`: how many confirms the import's history held when the screen decided."]
      ])
      const after = yield* read(path)
      expect([after.revision, R.has(after.decisions, "row-55")]).toEqual([revision, false])
    })
  )

  it.effect(
    "after a confirm and a reopen: below is refused as decided before it, equal is written, above is refused",
    () =>
      Effect.gen(function* () {
        const { path, revision } = yield* staged(true)
        const madeOn = { "row-55": revision }
        // Decided before the confirm: the opening it was made in, the first.
        const below = yield* save(path, { madeOn, opening: 0, set: accept, clear: [] })
        expect(below.status).toBe(409)
        const belowSaid = yield* readAlreadyImported(below.json)
        expect(Str.includes(reopenedWords)(belowSaid.reason)).toBe(true)
        // Naming a confirm the import never had: refused, and not told it was imported and opened again.
        const above = yield* save(path, { madeOn, opening: 2, set: accept, clear: [] })
        expect(above.status).toBe(409)
        const aboveSaid = yield* readAlreadyImported(above.json)
        expect(aboveSaid.reason).toBe(
          "This was decided over items_messy.csv as it has never been: it has been imported 1 time, not 2. Nothing of it was written: look at the import as it is now."
        )
        // Neither wrote anything: the draft is where the reopen left it.
        const after = yield* read(path)
        expect([after.status, after.revision, R.has(after.decisions, "row-55")]).toEqual(["open", revision, false])
        // Decided in this opening: written.
        const equal = yield* save(path, { madeOn, opening: 1, set: accept, clear: [] })
        const stored = yield* read(path)
        expect([equal.status, stored.revision, R.has(stored.decisions, "row-55")]).toEqual([200, revision + 1, true])
      })
  )

  it.effect("never confirmed: a save naming confirms is refused in words that do not say it was imported", () =>
    Effect.gen(function* () {
      const { path, revision } = yield* staged(false)
      const madeOn = { "row-55": revision }
      const above = yield* save(path, { madeOn, opening: 3, set: accept, clear: [] })
      expect(above.status).toBe(409)
      const { reason } = yield* readAlreadyImported(above.json)
      expect([Str.includes(reopenedWords)(reason), Str.includes("imported 0 times, not 3")(reason)]).toEqual([
        false,
        true
      ])
      const untouched = yield* read(path)
      expect([untouched.revision, R.has(untouched.decisions, "row-55")]).toEqual([revision, false])
      const taken = yield* save(path, { madeOn, opening: 0, set: accept, clear: [] })
      expect(taken.status).toBe(200)
    })
  )

  it.effect("an empty save and a clear-only save from an earlier opening are refused and write nothing", () =>
    Effect.gen(function* () {
      const { path, revision } = yield* staged(true)
      // Row 55 decided in this opening, so a clear of it would change what is stored.
      yield* save(path, { madeOn: { "row-55": revision }, opening: 1, set: accept, clear: [] })
      const decided = yield* read(path)
      const empty = yield* save(path, { madeOn: {}, opening: 0, set: {}, clear: [] })
      const clearOnly = yield* save(path, {
        madeOn: { "row-55": decided.revision },
        opening: 0,
        set: {},
        clear: ["row-55"]
      })
      const after = yield* read(path)
      expect([empty.status, clearOnly.status, after.revision, O.isSome(R.get(after.decisions, "row-55"))]).toEqual([
        409,
        409,
        decided.revision,
        true
      ])
      const clearSaid = yield* readAlreadyImported(clearOnly.json)
      expect(Str.includes(reopenedWords)(clearSaid.reason)).toBe(true)
    })
  )

  it.effect("confirmed, taken back and opened again: the first opening's save is refused, this one's is written", () =>
    Effect.gen(function* () {
      const { api, params, path, revision } = yield* staged(false)
      const confirmed = yield* api.imports.commit({ params, payload: { revision, madeOn: {}, set: {}, clear: [] } })
      yield* api.imports.takeBack({ params, payload: { confirms: confirmed.takeBack.confirms } })
      const reopened = yield* api.imports.reopen({ params })
      const madeOn = { "row-55": reopened.revision }
      const before = yield* save(path, { madeOn, opening: 0, set: accept, clear: [] })
      const between = yield* read(path)
      const now = yield* save(path, { madeOn, opening: 1, set: accept, clear: [] })
      const after = yield* read(path)
      expect([
        before.status,
        between.revision,
        R.has(between.decisions, "row-55"),
        now.status,
        R.has(after.decisions, "row-55")
      ]).toEqual([409, reopened.revision, false, 200, true])
    })
  )
})
