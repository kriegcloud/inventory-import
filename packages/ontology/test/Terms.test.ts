// The thread's vocabulary literal decodes strictly through `Vocabulary`, and gate 4's rules find nothing in it when the
// exception list holds `Role` (decision 97) and the decision log answers 97 and 111. Step 4 reads the real log and the
// committed list; this test holds the literal itself.
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
  }
]

describe("the thread's vocabulary", () => {
  it.effect("decodes strictly and is coherent with Role's exception and decisions 97 and 111", () =>
    Effect.gen(function* () {
      const decoded = yield* S.decodeEffect(Vocabulary, strict)(vocabulary)
      const list = yield* S.decodeEffect(ExceptionList, strict)(exceptions)
      expect(R.size(decoded.classes)).toBe(7)
      expect(R.size(decoded.objectProperties) + R.size(decoded.datatypeProperties)).toBe(9)
      expect(R.size(decoded.schemes)).toBe(2)
      expect(coherenceFindings({ vocabulary: decoded, exceptions: list, decisions: HashSet.make(97, 111) })).toEqual([])
    })
  )
})
