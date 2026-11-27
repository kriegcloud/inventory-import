// The day's limit of model calls and the purposes of a call are written in three places, because the boundaries law
// lets no contract read another's and no model read another context's contract: the usage contract (the one the Usage
// model reads), the access contract (the allowance the gateway still uses) and the catalog's in-memory ports. Only an
// app may read all three, so the comparison is here. It goes when the access copy does (Benjamin, 2026-11-27).
import { describe, expect, it } from "@effect/vitest"
import * as Access from "@inventory/access-contract/ModelAllowance"
import { offline } from "@inventory/catalog-model/Memory"
import * as Usage from "@inventory/usage-contract/ModelCall"

describe("the copies of the day's model calls", () => {
  it("the access contract's limit and the catalog's in-memory one are the usage contract's", () => {
    expect([Access.dailyModelCalls, offline.calls]).toEqual([Usage.dailyModelCalls, Usage.dailyModelCalls])
  })

  it("the access contract's purposes are the usage contract's", () => {
    expect(Access.ModelCallPurpose.Enum).toEqual(Usage.ModelCallPurpose.Enum)
  })
})
