// A form says every problem at once. The rule that would hurt if wrong: a press on a form with several mistakes lists
// every one of them, in the form's order, and nothing for a field that is fine.
import { it } from "@effect/vitest"
import { Array as Arr, Schema } from "effect"
import { expect } from "vitest"
import { formProblems, problemOf } from "../../src/web/lib/form.ts"

const Check = Schema.NullOr(Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(40)))

it.prop(
  "lists exactly the fields whose check failed, all of them, in the form's order",
  { name: Check, quantity: Check, unit: Check, cost: Check },
  (checks) => {
    const fields = ["name", "quantity", "unit", "cost"] as const
    const problems = formProblems({
      name: checks.name ?? undefined,
      quantity: checks.quantity ?? undefined,
      unit: checks.unit ?? undefined,
      cost: checks.cost ?? undefined
    })
    expect(Arr.map(problems, (problem) => problem.field)).toEqual(Arr.filter(fields, (field) => checks[field] !== null))
    for (const field of fields) expect(problemOf(problems, field)).toBe(checks[field] ?? undefined)
  }
)
