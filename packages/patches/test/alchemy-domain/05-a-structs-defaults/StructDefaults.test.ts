// The test of `alchemy-domain/05-a-structs-defaults.patch`. Without the patch the prover reads `Running.make({...})`
// as the fields written and nothing more: every rule of the meter comes back "read wrongly", because the real `make`
// adds the status, the reading, the unit, the seal and the floor from their constructor defaults.
import * as Prove from "@alchemy.run/domain/Prove"
import * as NodeServices from "@effect/platform-node/NodeServices"
import { expect, layer } from "@effect/vitest"
import * as Effect from "effect/Effect"
import { ClockedMeter } from "./Clocked.aggregate.ts"
import { ListedMeter } from "./Listed.aggregate.ts"
import { Meter } from "./Meter.aggregate.ts"

const proved = (rule: string): RegExp => new RegExp(`✓ ${rule}\\n\\s+✓ proved for Start\\n`)

const broken = (rule: string): RegExp =>
  new RegExp(
    `✗ ${rule}\\n\\s+✗ Start: violated\\n[\\s\\S]*?after\\s+` +
      '\\{ status: "Running", reading: 0, unit: "kWh", sealed: true, steps: -?\\d+, place: \\{ room: "[^"]*", floor: 1 \\} \\}\\n'
  )

const unread = (rule: string, command: string, field: string, schema: string): RegExp =>
  new RegExp(
    `✗ ${rule}\\n\\s+✗ ${command}: not supported\\n.*\\n\\s+` +
      `leaves ${field} of ${schema}.make to a default the prover does not read\\n`
  )

layer(NodeServices.layer)("a struct made without the fields that have a constructor default", (it) => {
  it.effect(
    "holds each default as the library's make gives it: a rule that rests on one is proved, a false one is broken",
    Effect.fnUntraced(function* () {
      const report = yield* Prove.report(Meter, { source: new URL("./Meter.aggregate.ts", import.meta.url) })
      const said = Prove.render(report)
      expect(said).not.toMatch(/not supported|read wrongly|not decided|not proved/)
      expect(said).toMatch(/Agreed with the real code: inputs picked for each of 2 paths/)
      expect(said).toMatch(/✓ The state stays in its schema\n\s+✓ holds on the initial state\n\s+✓ proved for Start\n/)
      // A number, a text, a truth, and a number in a struct held inside the state.
      expect(said).toMatch(proved("AStartedMeterReadsZero"))
      expect(said).toMatch(proved("AStartedMeterCountsInKilowattHours"))
      expect(said).toMatch(proved("AStartedMeterIsSealed"))
      expect(said).toMatch(proved("AStartedMeterIsOnTheFirstFloor"))
      // Each false of the real code, and shown with the state the real `make` builds.
      expect(said).toMatch(broken("AStartedMeterReadsOne"))
      expect(said).toMatch(broken("AStartedMeterIsOnTheSecondFloor"))
    }),
    120_000
  )

  it.effect(
    "says so of a default that is worked out when asked for: the rule is not proved",
    Effect.fnUntraced(function* () {
      const report = yield* Prove.report(ClockedMeter, { source: new URL("./Clocked.aggregate.ts", import.meta.url) })
      const said = Prove.render(report)
      expect(said).toMatch(unread("AClockedMeterReadsZero", "Clock", "reading", "Reading"))
      expect(said).not.toMatch(/✓ AClockedMeterReadsZero/)
    }),
    120_000
  )

  it.effect(
    "says so of a default that is a list: the rule is not proved",
    Effect.fnUntraced(function* () {
      const report = yield* Prove.report(ListedMeter, { source: new URL("./Listed.aggregate.ts", import.meta.url) })
      const said = Prove.render(report)
      expect(said).toMatch(unread("AListedMeterHoldsNoMark", "List", "marks", "Marks"))
      expect(said).not.toMatch(/✓ AListedMeterHoldsNoMark/)
    }),
    120_000
  )
})
