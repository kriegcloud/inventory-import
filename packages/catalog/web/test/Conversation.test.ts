// Who answered the assistant's last request decides whether the screen says what the rules read: told by the case
// the answer carries, never by the name the line shows, so a model whose id is "Rules" is still read as a model.
import { describe, expect, it } from "@effect/vitest"
import { AnsweredBy } from "@inventory/catalog-contract/Answer"
import { answererName, type Entry, lastAnsweredByRules } from "../src/Conversation.machine.ts"

const entry = (answeredBy: AnsweredBy | null): Entry => ({
  id: "ask-1",
  prompt: "only Box",
  outcome: "applied",
  answeredBy,
  note: null,
  reason: null,
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
