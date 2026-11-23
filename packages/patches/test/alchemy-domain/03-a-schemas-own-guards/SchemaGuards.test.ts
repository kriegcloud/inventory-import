// The test of `alchemy-domain/03-a-schemas-own-guards.patch`. Without the patch the prover reads none of it: every
// rule of the ticket comes back "not read", at the first guard a `decide` asks.
import * as Prove from "@alchemy.run/domain/Prove"
import * as NodeServices from "@effect/platform-node/NodeServices"
import { expect, layer } from "@effect/vitest"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import { Code } from "./Code.aggregate.ts"
import { Ticket } from "./Ticket.aggregate.ts"

const proved = (rule: string): RegExp =>
  new RegExp(`✓ ${rule}\\n\\s+✓ holds on the initial state\\n\\s+✓ proved for Open, Note, Close\\n`)

const broken = (rule: string, others: string, by: string, command: string, after: string): RegExp =>
  new RegExp(
    `✗ ${rule}\\n\\s+✓ holds on the initial state\\n\\s+✓ proved for ${others}\\n\\s+✗ ${by}: violated\\n[\\s\\S]*?` +
      `command\\s+${command}\\n[\\s\\S]*?after\\s+${after}\\n`
  )

layer(NodeServices.layer)("a schema's own guards", (it) => {
  it.effect(
    "are read as the library writes them: each rule that holds is proved, each broken one comes back with what breaks it",
    Effect.fnUntraced(function* () {
      const report = yield* Prove.report(Ticket, { source: new URL("./Ticket.aggregate.ts", import.meta.url) })
      const said = Prove.render(report)
      // Nothing was left unread, and the real code did what the prover read on every path it took.
      expect(said).not.toMatch(/not read|read wrongly|not decided|not proved/)
      expect(said).toMatch(/Agreed with the real code: inputs picked for each of 9 paths/)
      expect(A.map(report.commands, (command) => [command.command, command.accepted])).toEqual([
        ["Open", true],
        ["Note", true],
        ["Close", true]
      ])
      // The whole case, its title's length included: the guard of a value the code built.
      expect(said).toMatch(proved("The state stays in its schema"))
      expect(said).toMatch(proved("ATitleIsNeverLongerThanTwenty"))
      expect(said).toMatch(
        broken(
          "ATicketIsNeverTitledX",
          "Note, Close",
          "Open",
          'Open \\{ ticketId: "[^"]*", title: "x" \\}',
          '\\{ status: "Open", title: "x", notes: 0 \\}'
        )
      )
      // `match`, with `constTrue` as an answer.
      expect(said).toMatch(proved("ATicketNeverHoldsMoreThanThreeNotes"))
      expect(said).toMatch(
        broken(
          "ATicketNeverHoldsTwoNotes",
          "Open, Close",
          "Note",
          'Note \\{ ticketId: "[^"]*" \\}',
          '\\{ status: "Open", title: "[^"]*", notes: 2 \\}'
        )
      )
      // `isAnyOf`.
      expect(said).toMatch(proved("ATicketIsLiveOrClosed"))
      expect(said).toMatch(
        broken(
          "ATicketIsNeverClosed",
          "Open, Note",
          "Close",
          'Close \\{ ticketId: "[^"]*", by: "[^"]+" \\}',
          '\\{ status: "Closed", title: "[^"]*", notes: \\d, by: "[^"]+" \\}'
        )
      )
      // `matchOrElse`, `Schema.is` of a text, and `constFalse` as an answer.
      expect(said).toMatch(proved("ATicketIsNeverClosedByNobody"))
      expect(said).toMatch(
        broken(
          "AnOpenTicketIsTheOnlyKind",
          "Open, Note",
          "Close",
          'Close \\{ ticketId: "[^"]*", by: "[^"]+" \\}',
          '\\{ status: "Closed", title: "[^"]*", notes: \\d, by: "[^"]+" \\}'
        )
      )
      // A union's guard of a command's class, on the command the prover made.
      expect(said).toMatch(/✓ OnlyACloseCloses\n\s+✓ proved for Open, Note, Close\n/)
      expect(said).toMatch(
        /✗ OnlyAnOpenChangesATicket\n\s+✓ proved for Open, Note\n\s+✗ Close: violated\n[\s\S]*?command\s+Close \{/
      )
    }),
    120_000
  )

  it.effect(
    "are not guessed: of a schema with a check the prover does not read, it says so and proves nothing",
    Effect.fnUntraced(function* () {
      const report = yield* Prove.report(Code, { source: new URL("./Code.aggregate.ts", import.meta.url) })
      const said = Prove.render(report)
      expect(said).toMatch(
        /✗ ACodeIsNeverLowerCaseA\n\s+✓ holds on the initial state\n\s+✗ Keep: not read\n.*\n\s+asks Schema\.is\(Capitals\) of a value, where the prover does not read the schema or the value exactly/
      )
      expect(said).not.toMatch(/proved for Keep|violated/)
    }),
    120_000
  )
})
