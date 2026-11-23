// A form says every problem at once. The rule that would hurt if wrong: a press on a form with several mistakes lists
// every one of them, in the form's order, and nothing for a field that is fine.
import { it } from "@effect/vitest"
import * as A from "effect/Array"
import { pipe } from "effect/Function"
import * as O from "effect/Option"
import * as P from "effect/Predicate"
import * as S from "effect/Schema"
import { expect } from "vitest"
import { formProblems, problemOf } from "../../src/web/lib/form.ts"

const Check = S.UndefinedOr(S.String.check(S.isMinLength(1), S.isMaxLength(40)))

it.prop(
  "lists exactly the fields whose check failed, all of them, in the form's order",
  { name: Check, quantity: Check, unit: Check, cost: Check },
  (checks) => {
    const fields = ["name", "quantity", "unit", "cost"] as const
    const problems = formProblems({
      name: checks.name,
      quantity: checks.quantity,
      unit: checks.unit,
      cost: checks.cost
    })
    expect(A.map(problems, (problem) => problem.field)).toEqual(
      A.filter(fields, (field) => P.isNotUndefined(checks[field]))
    )
    for (const field of fields) {
      const sentence = O.fromUndefinedOr(checks[field])
      expect(problemOf(problems, field)).toEqual(sentence)
      expect(pipe(problems, problemOf(field))).toEqual(sentence)
    }
  }
)
