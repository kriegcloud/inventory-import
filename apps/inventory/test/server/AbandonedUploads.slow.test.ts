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
const hour = abandonedAfterMinutes * 60_000

/**
 * How long after the first begin the second comes, in milliseconds, never before it: anywhere in two hours, or within
 * two milliseconds of the hour, so both sides of the cut-off are drawn.
 */
const Gap = S.Union([
  S.Int.check(S.isBetween({ minimum: 0, maximum: 2 * hour })),
  S.Int.check(S.isBetween({ minimum: hour - 2, maximum: hour + 2 }))
])
const TwoBegins = S.Struct({ first: D1Instant, gap: Gap, firstKey: UploadKey, secondKey: UploadKey, head: StagedHead })
// Both begins at moments D1 stores, the first with its own cut-off one too (no server's clock reads the first hour of
// year 0), and two keys: a second begin with the first's key is a retry of it, not another upload.
const twoBegins = Arbitrary.filter(
  Arbitrary.schema(TwoBegins),
  (drawn) =>
    S.is(D1Instant)(DateTime.subtract(drawn.first, { minutes: abandonedAfterMinutes })) &&
    S.is(D1Instant)(DateTime.add(drawn.first, { milliseconds: drawn.gap })) &&
    drawn.firstKey !== drawn.secondKey
)

layer(Store, { timeout: "60 seconds" })("abandoned uploads on D1", (it) => {
  it.effect.prop(
    "a second begin deletes the first upload exactly when it began over an hour before",
    [twoBegins],
    ([drawn]) =>
      Effect.gen(function* () {
        const store = yield* ImportStore
        yield* drawn.first.pipe(DateTime.toEpochMillis, TestClock.setTime)
        const begun = yield* Effect.flatMap(
          store.beginUpload(dana, drawn.firstKey, drawn.head, counts),
          Effect.fromResult
        )
        yield* TestClock.adjust(drawn.gap)
        const again = yield* Effect.flatMap(
          store.beginUpload(dana, drawn.secondKey, drawn.head, counts),
          Effect.fromResult
        )
        const kept = yield* store.findUpload(dana, begun)
        // Each run leaves nothing behind, so a key a later run draws again starts a new upload.
        yield* store.discardUpload(dana, begun)
        yield* store.discardUpload(dana, again)
        // Kept for the hour, the hour itself included; gone a millisecond after it.
        expect(O.isSome(kept)).toBe(drawn.gap <= hour)
      }),
    { arbitrary: { runs: 40 } }
  )
})
