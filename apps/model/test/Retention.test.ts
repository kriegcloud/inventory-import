import { retentionWindows } from "@alchemy.run/domain/DurableObjects"
import { describe, expect, it } from "@effect/vitest"
import * as Duration from "effect/Duration"
import { modelRetention } from "../src/Retention.ts"

// host-07 (Benjamin, 2026-11-27, "Receipts forever"): read through the library's own reading of a retention value,
// where no window (`undefined`) is a row kept for ever.
describe("how long the model's Worker keeps the rows only dedupe needs", () => {
  it("keeps a command's receipt for ever, so a press kept past 30 days is not applied again", () => {
    expect(retentionWindows(modelRetention).receipts).toBeUndefined()
  })

  it("leaves deliveries and cancelled rows at the library's 7 days", () => {
    const week = Duration.toMillis(Duration.days(7))
    const windows = retentionWindows(modelRetention)
    expect([windows.deliveries, windows.cancelled]).toEqual([week, week])
  })

  it("differs from the library's default, which drops a receipt after 30 days", () => {
    expect(retentionWindows().receipts).toBe(Duration.toMillis(Duration.days(30)))
  })
})
