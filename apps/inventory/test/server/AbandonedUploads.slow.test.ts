// A begin deletes the organization's uploads left unfinished for over an hour, in SQL, by comparing the stored moment
// with a cut-off. On a fresh D1, at any two moments: an upload begun earlier is still there after a second begin
// exactly when it began less than an hour before it.
import { expect, layer } from "@effect/vitest"
import { UploadKey } from "@inventory/catalog-contract/Ids"
import { StagedHead } from "@inventory/catalog-contract/Staged"
import { ImportStoreD1 } from "@inventory/catalog-host/ImportStoreD1"
import { ImportStore } from "@inventory/catalog-model/ImportStore"
import { abandonedAfterMinutes } from "@inventory/catalog-model/Upload"
import { MemberId, OrganizationId } from "@inventory/kernel/Ids"
import { Member } from "@inventory/kernel/Member"
import { D1Instant } from "@beep/d1/D1Instant"
import * as Arbitrary from "effect/Arbitrary"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as O from "effect/Option"
import * as Result from "effect/Result"
import * as S from "effect/Schema"
import * as TestClock from "effect/testing/TestClock"
import { TestDatabase } from "./support/app.ts"

const Store = ImportStoreD1.pipe(Layer.provide(TestDatabase))

// A seeded member of a seeded organization (seeds/organizations.sql): the upload's foreign keys need both.
const dana = Member.make({
  id: MemberId.make("mem_dana"),
  name: "Dana Whitfield",
  role: "admin",
  organizationId: OrganizationId.make("org_prairie"),
  organizationName: "Example Works (test)"
})
const counts = { rowCount: 1, chunkCount: 1 }
// The moment of a begin whose cut-off is itself a moment D1 stores: not in the first hour of year 0, which no server's
// clock reads.
const beginMoment = Arbitrary.filter(Arbitrary.schema(D1Instant), (at) =>
  S.is(D1Instant)(DateTime.subtract(at, { minutes: abandonedAfterMinutes }))
)

layer(Store, { timeout: "60 seconds" })("abandoned uploads on D1", (it) => {
  it.effect.prop(
    "a second begin deletes the first upload exactly when it began over an hour before",
    [
      Arbitrary.schema(D1Instant),
      beginMoment,
      Arbitrary.schema(UploadKey),
      Arbitrary.schema(UploadKey),
      Arbitrary.schema(StagedHead)
    ],
    ([first, second, firstKey, secondKey, head]) =>
      Effect.gen(function* () {
        const store = yield* ImportStore
        yield* first.pipe(DateTime.toEpochMillis, TestClock.setTime)
        const begun = yield* store.beginUpload(dana, firstKey, head, counts)
        yield* second.pipe(DateTime.toEpochMillis, TestClock.setTime)
        const again = yield* store.beginUpload(dana, secondKey, head, counts)
        if (Result.isFailure(begun) || Result.isFailure(again)) return
        const kept = yield* store.findUpload(dana, begun.success)
        // Each run leaves nothing behind, so a key a later run draws again starts a new upload.
        yield* store.discardUpload(dana, begun.success)
        yield* store.discardUpload(dana, again.success)
        const cutOff = DateTime.toEpochMillis(second) - abandonedAfterMinutes * 60_000
        expect(O.isSome(kept)).toBe(DateTime.toEpochMillis(first) >= cutOff)
      }),
    { arbitrary: { runs: 25 } }
  )
})
