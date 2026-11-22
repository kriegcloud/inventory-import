// The browser's storage, refused. The rule that would hurt if wrong: a private window, a full disk or blocked site data
// never throws into a screen; every call answers none, and what the browser does keep is read back as it was kept.
import * as A from "effect/Array"
import * as O from "effect/Option"
import * as R from "effect/Record"
import { describe, expect, it } from "vitest"
import { browserStorage, sharedStorage, tabStorage } from "@inventory/client/Storage"

/** A storage that keeps what it is given, and refuses whatever `refuse` names. */
const storageThat = (refuse: { readonly reads?: boolean; readonly writes?: boolean }): Storage => {
  const kept: Record<string, string> = {}
  const refused = (): never => {
    throw new DOMException("The quota has been exceeded.", "QuotaExceededError")
  }
  return {
    getItem: (key: string) => (refuse.reads === true ? refused() : (kept[key] ?? null)),
    setItem: (key: string, value: string) => {
      if (refuse.writes === true) refused()
      kept[key] = value
    },
    removeItem: (key: string) => {
      if (refuse.writes === true) refused()
      delete kept[key]
    },
    key: (index: number) => (refuse.reads === true ? refused() : O.getOrNull(A.get(R.keys(kept), index))),
    get length() {
      return refuse.reads === true ? refused() : R.size(kept)
    },
    clear: () => undefined
  }
}

describe("the browser's storage", () => {
  it("reads back what it kept, and none for a key it never kept", () => {
    const storage = browserStorage(() => storageThat({}))
    // One lookup per call, as the browser's own: the same storage each time.
    const one = storageThat({})
    const same = browserStorage(() => one)
    expect(same.write("theme", "dark")).toEqual(O.some(undefined))
    expect(same.read("theme")).toEqual(O.some("dark"))
    expect(same.keys()).toEqual(O.some(["theme"]))
    expect(same.remove("theme")).toEqual(O.some(undefined))
    expect(same.read("theme")).toEqual(O.none())
    expect(same.keys()).toEqual(O.some([]))
    expect(storage.read("never")).toEqual(O.none())
  })

  it("answers none for a write the browser refuses (a full disk), and keeps reading what it has", () => {
    const one = storageThat({ writes: true })
    const storage = browserStorage(() => one)
    expect(storage.write("theme", "dark")).toEqual(O.none())
    expect(storage.remove("theme")).toEqual(O.none())
    expect(storage.read("theme")).toEqual(O.none())
    expect(storage.keys()).toEqual(O.some([]))
  })

  it("answers none for every read the browser refuses (blocked site data)", () => {
    const storage = browserStorage(() => storageThat({ reads: true }))
    expect(storage.read("theme")).toEqual(O.none())
    expect(storage.keys()).toEqual(O.none())
  })

  it("answers none when the browser refuses to hand over the storage at all (a private window)", () => {
    const storage = browserStorage((): Storage => {
      throw new DOMException("The operation is insecure.", "SecurityError")
    })
    expect(storage.read("theme")).toEqual(O.none())
    expect(storage.write("theme", "dark")).toEqual(O.none())
    expect(storage.remove("theme")).toEqual(O.none())
    expect(storage.keys()).toEqual(O.none())
  })

  it("answers none with no browser at all (no window here)", () => {
    expect(sharedStorage.read("theme")).toEqual(O.none())
    expect(sharedStorage.write("theme", "dark")).toEqual(O.none())
    expect(tabStorage.read("inventory:tab")).toEqual(O.none())
    expect(tabStorage.keys()).toEqual(O.none())
  })
})
