import { describe, expect, it } from "@effect/vitest"
import { assertTrue } from "@effect/vitest/utils"
import * as Arbitrary from "effect/Arbitrary"
import * as Result from "effect/Result"
import * as S from "effect/Schema"
import { NonBlankSecret } from "../src/internal/Secret.ts"

describe("secret presence without changing its bytes", () => {
  it("rejects blank text, including Unicode whitespace", () => {
    for (const text of ["", " ", "\t\r\n", "\u00a0\u2003\ufeff"]) {
      expect(S.is(NonBlankSecret)(text)).toBe(false)
    }
  })

  it("keeps all surrounding whitespace on a supplied secret", () => {
    const text = " \t\u00a0key with spaces\ufeff\r\n"
    const decoded = S.decodeResult(NonBlankSecret)(text)
    assertTrue(Result.isSuccess(decoded), "A nonblank secret must decode")
    expect(decoded.success).toBe(text)
  })

  it.prop("generates only nonblank secret text", [Arbitrary.schema(NonBlankSecret)], ([text]) => {
    expect(S.is(NonBlankSecret)(text)).toBe(true)
  })
})
