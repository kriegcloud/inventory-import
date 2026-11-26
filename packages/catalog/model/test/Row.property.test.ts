// What the model cannot say of `seal`: that it can be read back, so no two levels whose sizes are true share a seal.
// The row's rules compare seals and never read them; this is why comparing them is enough.
import { expect, it } from "@effect/vitest"
import * as S from "effect/Schema"
import * as O from "effect/Option"
import * as Str from "effect/String"
import { CUT, Level, seal, sizesAreTrue } from "../src/Row/Row.aggregate.ts"

/** The six numbers a seal starts with, each followed by a colon. */
const head = /^(-?\d+):(-?\d+):(\d+):(\d+):(\d+):(\d+):/

/** A seal read back: the level it holds and what was below it. None for a text that is no seal. */
const unseal = (text: string): O.Option<{ readonly level: Level; readonly below: string }> => {
  const found = Str.match(head)(text)
  return O.map(found, ([whole, change, madeOn, bySize, stepSize, labelSize, flagsSize]) => {
    const sizes = { by: Number(bySize), step: Number(stepSize), label: Number(labelSize), flags: Number(flagsSize) }
    const start = whole.length
    const stepAt = start + sizes.by
    const labelAt = stepAt + sizes.step
    const flagsAt = labelAt + sizes.label
    const belowAt = flagsAt + sizes.flags
    return {
      level: Level.make({
        change: Number(change),
        madeOn: Number(madeOn),
        by: Str.slice(start, stepAt)(text),
        step: Str.slice(stepAt, labelAt)(text),
        label: Str.slice(labelAt, flagsAt)(text),
        flags: Str.slice(flagsAt, belowAt)(text),
        bySize: sizes.by,
        stepSize: sizes.step,
        labelSize: sizes.label,
        flagsSize: sizes.flags
      }),
      below: Str.slice(belowAt)(text)
    }
  })
}

it.prop(
  "a seal is read back as what was sealed",
  { change: S.Int, madeOn: S.Int, by: S.String, step: S.String, label: S.String, flags: S.String, below: S.String },
  ({ below, by, change, flags, label, madeOn, step }) => {
    // -0 is written "0" and equals 0 wherever the model compares numbers.
    const level = Level.make({
      change: change + 0,
      madeOn: madeOn + 0,
      by,
      step,
      label,
      flags,
      bySize: by.length,
      stepSize: step.length,
      labelSize: label.length,
      flagsSize: flags.length
    })
    expect(sizesAreTrue(level)).toBe(true)
    expect(unseal(seal({ level, below }))).toEqual(O.some({ level, below }))
    // What stands for a history let go is never a seal.
    expect(seal({ level, below })).not.toBe(CUT)
  },
  { arbitrary: { runs: 2000 } }
)

it("what stands for a history let go is no seal", () => {
  expect(unseal(CUT)).toEqual(O.none())
})
