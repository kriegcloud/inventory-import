// A confirm names the revision of the draft its screen showed, and the server writes it only while the draft is
// still at that revision (DECISIONS.md: "Refuse, show, confirm again"). What must not break: a confirm made on an
// older picture writes nothing at all, not an item and not the confirming person's own unsent rows, so nothing is
// imported that was not on screen and nobody's decision is overwritten. On the real handlers and SQL, a fresh D1.
import { expect, layer } from "@effect/vitest"
import * as A from "effect/Array"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as Order from "effect/Order"
import * as R from "effect/Record"
import * as Result from "effect/Result"
import * as HttpApiTest from "effect/http-api/HttpApiTest"
import clean from "../../public/samples/items_clean.csv?raw"
import messy from "../../public/samples/items_messy.csv?raw"
import { Api } from "../../src/api/v1/Api.ts"
import { decisionFromFlags } from "@inventory/catalog-contract/Decision"
import { ConfirmId } from "@inventory/catalog-contract/Ids"
import { ConfirmPlan } from "@inventory/catalog-model/Confirm"
import { ConfirmWrite, ImportStore } from "@inventory/catalog-model/ImportStore"
import { Activity } from "@inventory/kernel/Activity"
import { ActivityId, MemberId, OrganizationId } from "@inventory/kernel/Ids"
import { as, TypedApp } from "./support/app.ts"
import { stage } from "./support/files.ts"
import { upload } from "./support/upload.ts"

const acceptComma = { "row-55": decisionFromFlags({ accepted: ["unitCost"] }) }
const undoUnit = { "row-18": decisionFromFlags({ reverted: ["uom"] }) }

layer(TypedApp)("a confirm names the revision its screen showed", (it) => {
  it.effect(
    "made on an older picture it is refused and writes nothing; made again on the newer one it writes, unsent rows too",
    () =>
      Effect.gen(function* () {
        const client = yield* HttpApiTest.groups(Api, ["imports", "items", "activity"])
        const marcus = as("mem_marcus")
        const dana = as("mem_dana")
        const staged = yield* upload({ client, table: yield* stage(new File([messy], "items_messy.csv")) }).pipe(marcus)
        const params = { id: staged.id }
        // Dana decides a row Marcus's screen has not shown: the draft moves on by one.
        const theirs = yield* client.imports
          .decide({ params, payload: { madeOn: staged.revision, set: acceptComma, clear: [] } })
          .pipe(dana)
        expect(theirs).toEqual({ revision: staged.revision + 1, changed: true, notApplied: [] })

        // Marcus confirms the picture he has, with a decision of his own he had not sent yet.
        const refused = yield* Effect.flip(
          client.imports
            .commit({
              params,
              payload: { revision: staged.revision, madeOn: staged.revision, set: undoUnit, clear: ["row-55"] }
            })
            .pipe(marcus)
        )
        expect([refused._tag, refused._tag === "DraftMoved" ? refused.revision : -1]).toEqual([
          "DraftMoved",
          theirs.revision
        ])
        // Nothing was written: no item, the import open where Dana left it, her decision there and his not.
        expect((yield* client.items.list().pipe(marcus)).length).toBe(0)
        const still = yield* client.imports.get({ params }).pipe(marcus)
        expect([still.status, still.revision, R.keys(still.decisions)]).toEqual(["open", theirs.revision, ["row-55"]])
        const trail = yield* client.activity.recent().pipe(marcus)
        expect(A.filter(trail, (line) => line.action === "Imported items")).toEqual([])

        // He has the newer picture now and confirms it: her row and his are both in what is written.
        const confirmed = yield* client.imports
          .commit({ params, payload: { revision: still.revision, madeOn: still.revision, set: undoUnit, clear: [] } })
          .pipe(marcus)
        const result = O.getOrThrow(confirmed.result)
        expect([confirmed.status, result.created, result.notImported]).toEqual(["imported", 155, 45])
        expect(A.sort(R.keys(confirmed.decisions), Order.String)).toEqual(["row-18", "row-55"])
        // One revision on, so the confirmed import is never taken for the open one it was made from.
        expect(confirmed.revision).toBe(still.revision + 1)
        expect((yield* client.items.list().pipe(marcus)).length).toBe(155)
      })
  )

  it.effect("the write itself refuses another revision, whatever was read before it", () =>
    Effect.gen(function* () {
      const client = yield* HttpApiTest.groups(Api, ["imports", "items"])
      const store = yield* ImportStore
      const marcus = as("mem_marcus")
      const staged = yield* upload({ client, table: yield* stage(new File([clean], "items_clean.csv")) }).pipe(marcus)
      const params = { id: staged.id }
      const before = (yield* client.items.list().pipe(marcus)).length
      const moved = yield* client.imports
        .decide({
          params,
          payload: { madeOn: staged.revision, set: { "row-2": decisionFromFlags({ out: true }) }, clear: [] }
        })
        .pipe(marcus)
      // The write a handler would send had it read the draft a moment before that save landed.
      const at = yield* DateTime.now
      const write = (expected: number) =>
        ConfirmWrite.make({
          draft: staged.id,
          fileName: staged.fileName,
          confirm: ConfirmId.make(`00000000-0000-4000-8000-00000000000${expected}`),
          expected,
          unsaved: { set: { "row-3": decisionFromFlags({ out: true }) }, clear: ["row-2"] },
          plan: ConfirmPlan.make({ draft: staged.id, rows: [] }),
          itemIds: [],
          audit: Activity.make({
            id: ActivityId.make(`00000000-0000-4000-8000-00000000010${expected}`),
            organizationId: OrganizationId.make("org_prairie"),
            actorId: MemberId.make("mem_marcus"),
            actorName: "Marcus Oyelaran",
            action: "Imported items",
            detail: "",
            agent: O.none(),
            createdAt: at
          })
        })
      const stale = yield* store.commit(write(staged.revision))
      expect(stale).toEqual({ kind: "moved", revision: moved.revision })
      const still = yield* client.imports.get({ params }).pipe(marcus)
      expect([still.status, still.revision, R.keys(still.decisions)]).toEqual(["open", moved.revision, ["row-2"]])
      expect((yield* client.items.list().pipe(marcus)).length).toBe(before)
      // On the revision the draft is at, the same write goes in, the unsent rows with it.
      const written = yield* store.commit(write(moved.revision))
      expect(written.kind).toBe("confirmed")
      const after = yield* client.imports.get({ params }).pipe(marcus)
      expect([after.status, after.revision, R.keys(after.decisions)]).toEqual([
        "imported",
        moved.revision + 1,
        ["row-3"]
      ])
    })
  )

  it.effect("of two confirms of the same picture sent at once, one writes and the other is told so", () =>
    Effect.gen(function* () {
      const client = yield* HttpApiTest.groups(Api, ["imports", "items"])
      const marcus = as("mem_marcus")
      const staged = yield* upload({ client, table: yield* stage(new File([clean], "items_twice.csv")) }).pipe(marcus)
      const before = (yield* client.items.list().pipe(marcus)).length
      const confirm = Effect.result(
        client.imports
          .commit({
            params: { id: staged.id },
            payload: { revision: staged.revision, madeOn: staged.revision, set: {}, clear: [] }
          })
          .pipe(marcus)
      )
      const answers = yield* Effect.all([confirm, confirm], { concurrency: 2 })
      const passed = A.filter(answers, Result.isSuccess)
      const failed = A.filter(answers, Result.isFailure)
      expect([passed.length, A.map(failed, (answer) => answer.failure._tag)]).toEqual([1, ["AlreadyImported"]])
      const made = O.getOrThrow(O.getOrThrow(A.head(passed)).success.result)
      expect(made.created).toBe(25)
      expect((yield* client.items.list().pipe(marcus)).length).toBe(before + 25)
    })
  )
})
