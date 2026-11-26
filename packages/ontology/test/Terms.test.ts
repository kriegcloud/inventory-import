// The vocabulary literal decodes strictly through `Vocabulary`, and gate 4's rules find nothing in it when the
// exception list holds `Role` (decision 97) and `Party` (decision 176) and the decision log answers 97, 111 and 176.
// Gate 4's own test reads the real log and the committed list; this test holds the literal itself: the thread's terms
// with the party slice's step 9 (goals/party-slice PLAN), at version 0.2.0 (decision 144).
import { describe, expect, it } from "@effect/vitest"
import { Vocabulary } from "@beep/vocabulary/Model"
import { coherenceFindings, ExceptionList } from "@beep/vocabulary/Rules"
import * as Effect from "effect/Effect"
import * as HashSet from "effect/HashSet"
import * as R from "effect/Record"
import * as S from "effect/Schema"
import { vocabulary } from "@inventory/kernel/Terms"

const strict = { onExcessProperty: "error", errors: "all" } as const

const exceptions = [
  {
    class: "Role",
    reason: "Its individuals are the concepts of MemberRoleScheme; gist:Permission fits once permits exists.",
    ratification: { decision: 97 }
  },
  {
    class: "Party",
    reason:
      "gist 14.1.0 has no party class; Party gathers Person and Organization, which keep their gist parents, and supplies no identity.",
    ratification: { decision: 176 }
  }
]

describe("the vocabulary", () => {
  it.effect("decodes strictly and is coherent with Role's and Party's exceptions and decisions 97, 111 and 176", () =>
    Effect.gen(function* () {
      const decoded = yield* S.decodeEffect(Vocabulary, strict)(vocabulary)
      const list = yield* S.decodeEffect(ExceptionList, strict)(exceptions)
      expect(vocabulary.version).toBe("0.2.0")
      expect(R.size(decoded.classes)).toBe(9)
      expect([R.size(decoded.objectProperties), R.size(decoded.datatypeProperties)]).toStrictEqual([8, 8])
      expect(R.size(decoded.schemes)).toBe(2)
      expect(R.keys(decoded.gist.properties)).toStrictEqual(["isCategorizedBy", "isAbout"])
      expect(
        coherenceFindings({ vocabulary: decoded, exceptions: list, decisions: HashSet.make(97, 111, 176) })
      ).toEqual([])
    })
  )
})
