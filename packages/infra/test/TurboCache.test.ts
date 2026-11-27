// The shared cache's settings, as the repository's stack takes them: all three or none, never a part. A part would
// leave CI holding a cache that refuses it, and every run would say so in a warning nobody reads.
import { describe, expect, it } from "@effect/vitest"
import { assertTrue } from "@effect/vitest/utils"
import * as O from "effect/Option"
import * as Result from "effect/Result"
import { cacheSettingsOf } from "@beep/infra/TurboCache"

const api = "https://cache.example"

describe("the shared cache's settings", () => {
  it("all three are written as given", () => {
    expect(cacheSettingsOf({ api: O.some(api), read: O.some("read"), write: O.some("write") })).toEqual(
      Result.succeed(O.some({ api, read: "read", write: "write" }))
    )
  })

  it("none is no cache: the stack writes no setting of it", () => {
    expect(cacheSettingsOf({ api: O.none(), read: O.none<string>(), write: O.none<string>() })).toEqual(
      Result.succeed(O.none())
    )
  })

  it("a part stops the stack, naming each variable that is missing and where it is written", () => {
    const stopped = cacheSettingsOf({ api: O.some(api), read: O.none<string>(), write: O.some("write") })
    assertTrue(Result.isFailure(stopped), "Expected stopped to be a failure")
    expect(stopped.failure.missing).toEqual(["TURBO_CACHE_READ_TOKEN"])
    expect(stopped.failure.message).toContain("TURBO_CACHE_READ_TOKEN is not set")
    expect(stopped.failure.message).toContain("packages/infra/env/op.env.local")
  })

  it("the address alone given is a part too", () => {
    const stopped = cacheSettingsOf({ api: O.some(api), read: O.none<string>(), write: O.none<string>() })
    assertTrue(Result.isFailure(stopped), "Expected stopped to be a failure")
    expect(stopped.failure.missing).toEqual(["TURBO_CACHE_READ_TOKEN", "TURBO_CACHE_WRITE_TOKEN"])
    expect(stopped.failure.message).toContain("TURBO_CACHE_READ_TOKEN, TURBO_CACHE_WRITE_TOKEN are not set")
  })
})
