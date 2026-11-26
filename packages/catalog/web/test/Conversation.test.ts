import { StorageTwin } from "@inventory/ui/StorageTwin"
// Who answered the assistant's last request decides whether the screen says what the rules read: told by the case
// the answer carries, never by the name the line shows, so a model whose id is "Rules" is still read as a model.
import { describe, expect, it } from "@effect/vitest"
import * as A from "effect/Array"
import * as O from "effect/Option"
import { vi } from "vitest"
import { AnsweredBy } from "@inventory/catalog-contract/Answer"
import { answererName, type Entry, lastAnsweredByRules, readConversation } from "../src/Conversation.machine.ts"

const entry = (answeredBy: AnsweredBy | null): Entry => ({
  id: "ask-1",
  prompt: "only Box",
  outcome: "applied",
  answeredBy: O.fromNullOr(answeredBy),
  note: O.none(),
  reason: O.none(),
  applied: [],
  undone: false
})

const rules = AnsweredBy.cases.Rules.make({ reason: "No AI key is set up." })
const namedRules = AnsweredBy.cases.Model.make({ provider: "openrouter", model: "Rules", fallback: false })
const haiku = AnsweredBy.cases.Model.make({ provider: "openrouter", model: "anthropic/claude-haiku", fallback: false })

describe("who answered the assistant", () => {
  it("reads the rules by the case, and a model named Rules as a model", () => {
    expect(lastAnsweredByRules([entry(rules)])).toBe(true)
    expect(lastAnsweredByRules([entry(namedRules)])).toBe(false)
    expect(lastAnsweredByRules([entry(rules), entry(haiku)])).toBe(false)
    expect(lastAnsweredByRules([entry(haiku), entry(rules)])).toBe(true)
    expect(lastAnsweredByRules([entry(rules), entry(null)])).toBe(false)
    expect(lastAnsweredByRules([])).toBe(false)
  })

  it("names the rules and each model on the line under a request", () => {
    expect(answererName(rules)).toBe("Rules")
    expect(answererName(haiku)).toBe("anthropic/claude-haiku")
    expect(answererName(namedRules)).toBe("Rules")
  })
})

// A conversation kept before who answered became a case (version 1, a name) comes back converted, with its Undo buttons
// and the columns the assistant left, never dropped.
describe("a conversation kept as version 1", () => {
  it("comes back with its entries, who answered as a case, and its columns", () => {
    const kept: Record<string, string> = {}
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => StorageTwin.getItem(kept, key),
      setItem: (key: string, value: string) => {
        kept[key] = value
      },
      removeItem: (key: string) => {
        delete kept[key]
      }
    })
    // As version 1 wrote it: each request with its change, its words and what takes it back, who answered as a name.
    const entry = (answeredBy: string, note: string) =>
      `{"id":"ask-1","prompt":"hide cost","outcome":"applied","answeredBy":${answeredBy},"note":${note},"reason":null,` +
      `"applied":[{"change":{"kind":"hide","column":"cost"},"label":"Hid Cost","patch":{"visibility":{"cost":true}},` +
      `"removed":false}],"undone":false}`
    const entries = A.join(
      [entry(`"Rules"`, `"No AI key is set up."`), entry(`"anthropic/claude-haiku"`, "null"), entry("null", "null")],
      ","
    )
    kept["v1"] = `{"version":1,"entries":[${entries}],"visibility":{"cost":false,"name":true}}`
    const found = readConversation("v1")
    expect(found.version).toBe(2)
    expect(found.visibility).toEqual({ cost: false, name: true })
    expect(A.map(found.entries, (each) => each.answeredBy)).toEqual([
      O.some(AnsweredBy.cases.Rules.make({ reason: "No AI key is set up." })),
      O.some(AnsweredBy.cases.Model.make({ provider: "openrouter", model: "anthropic/claude-haiku", fallback: false })),
      O.none()
    ])
    expect(A.map(found.entries, (each) => each.applied.length)).toEqual([1, 1, 1])
    expect(kept["v1"]).toBeDefined()
    vi.unstubAllGlobals()
  })
})
