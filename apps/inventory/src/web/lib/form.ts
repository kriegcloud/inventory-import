// A form says every problem at once. The rule this file protects: pressing Save on a form with three mistakes lists
// all three, beside their fields, not one per attempt. Each field's check runs whatever the others found.
import * as A from "effect/Array"
import { dual } from "effect/Function"
import * as O from "effect/Option"
import * as R from "effect/Record"

/** One problem of a form: the field it is in and a sentence that says what to change. */
export type FieldProblem<F extends string> = { readonly field: F; readonly sentence: string }

/**
 * Every problem of a form, in the form's order: each field's check is a sentence or undefined, and all of them run.
 *
 * @example formProblems({ action: "Say what was done.", detail: undefined })
 * // [{ field: "action", sentence: "Say what was done." }]
 */
export const formProblems = <F extends string>(checks: {
  readonly [K in F]: string | undefined
}): ReadonlyArray<FieldProblem<F>> =>
  A.flatMap(R.keys(checks), (field) => {
    const sentence = checks[field]
    return sentence === undefined ? [] : [{ field, sentence }]
  })

/**
 * The sentence for one field, or undefined: what a field's `FieldError` shows. Data first or in a pipe.
 *
 * @example pipe(formProblems({ action: "Say what was done.", detail: undefined }), problemOf("action"))
 * // "Say what was done."
 */
export const problemOf: {
  <F extends string>(field: F): (problems: ReadonlyArray<FieldProblem<F>>) => string | undefined
  <F extends string>(problems: ReadonlyArray<FieldProblem<F>>, field: F): string | undefined
} = dual(2, <F extends string>(problems: ReadonlyArray<FieldProblem<F>>, field: F): string | undefined =>
  O.getOrUndefined(
    O.map(
      A.findFirst(problems, (problem) => problem.field === field),
      (problem) => problem.sentence
    )
  )
)
