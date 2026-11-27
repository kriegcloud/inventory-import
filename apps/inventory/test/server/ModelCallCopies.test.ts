// The day's limit of model calls is written in two places, because the boundaries law lets no model read another
// context's contract: the usage contract (the one the Usage model and the allowance's gateway read) and the catalog's
// in-memory ports. Only an app may read both, so the comparison is here. The access contract's copy of the limit and
// the purposes went with the old count at move 2's hosted half (Benjamin, 2026-11-27: the compare test's access half
// goes when the access copy does).
import { describe, expect, it } from "@effect/vitest"
import { offline } from "@inventory/catalog-model/Memory"
import * as Usage from "@inventory/usage-contract/ModelCall"

describe("the copies of the day's model calls", () => {
  it("the catalog's in-memory limit is the usage contract's", () => {
    expect(offline.calls).toEqual(Usage.dailyModelCalls)
  })
})
