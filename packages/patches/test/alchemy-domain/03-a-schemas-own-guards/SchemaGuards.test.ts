// The test of `alchemy-domain/03-a-schemas-own-guards.patch`. Without the patch the prover reads none of it: every
// rule of the ticket comes back "not read", at the first guard a `decide` asks.
import * as Prove from "@alchemy.run/domain/Prove"
import * as NodeServices from "@effect/platform-node/NodeServices"
import { expect, layer } from "@effect/vitest"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import { Code } from "./Code.aggregate.ts"
import { Exact } from "./Exact.aggregate.ts"
import { Ticket } from "./Ticket.aggregate.ts"
import { Mark } from "./Unread.aggregate.ts"

const proved = (rule: string): RegExp =>
  new RegExp(`✓ ${rule}\\n\\s+✓ holds on the initial state\\n\\s+✓ proved for Open, Note, Close\\n`)

const kept = (rule: string): RegExp =>
  new RegExp(`✓ ${rule}\\n\\s+✓ holds on the initial state\\n\\s+✓ proved for AskName, AskWhole, AskPair, AskVoid\\n`)

const unread = (command: string, why: string): RegExp => new RegExp(`✗ ${command}: not read\\n.*\\n\\s+${why}\\n`)

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

  it.effect(
    "are answered as the library answers: a class by its name, a whole number within 2^53 - 1, a key that is written",
    Effect.fnUntraced(function* () {
      const report = yield* Prove.report(Exact, { source: new URL("./Exact.aggregate.ts", import.meta.url) })
      const said = Prove.render(report)
      expect(said).not.toMatch(/not read|read wrongly|not decided|not proved/)
      expect(said).toMatch(/Agreed with the real code: inputs picked for each of 5 paths/)
      // The guard of the event `Copied` says yes to a rejection named "Copied", so the mark is made.
      expect(said).toMatch(
        /✗ NothingIsMarkedByItsName\n\s+✓ holds on the initial state\n\s+✓ proved for AskWhole, AskPair, AskVoid\n\s+✗ AskName: violated\n[\s\S]*?events\s+Marked \{ which: "name" \}/
      )
      // `isInt` refuses 2^53, written out or sent in a command.
      expect(said).toMatch(kept("NothingIsMarkedByItsLargeWhole"))
      expect(said).toMatch(kept("NothingIsMarkedByItsWhole"))
      // A key that may be `undefined` and is not written is refused.
      expect(said).toMatch(kept("NothingIsMarkedByItsPair"))
      // `Schema.Void` says yes to a number.
      expect(said).toMatch(kept("NothingIsMarkedByItsVoid"))
      expect(said).toMatch(kept("The state stays in its schema"))
    }),
    120_000
  )

  it.effect(
    "are not guessed where the prover applies no check or reads no tag: each such guard comes back not read",
    Effect.fnUntraced(function* () {
      const report = yield* Prove.report(Mark, { source: new URL("./Unread.aggregate.ts", import.meta.url) })
      const said = Prove.render(report)
      const inexact = (schema: string): string =>
        `asks Schema\\.is\\(${schema}\\) of a value, where the prover does not read the schema or the value exactly`
      // A check on a union, which the prover applies to none of its members.
      expect(said).toMatch(unread("AskUnion", inexact("WholeOrOne")))
      // A union told by a number: the library finds a case under the number's text.
      expect(said).toMatch(unread("AskSize", "matches on a field the prover does not model"))
      expect(said).toMatch(unread("AskEither", "Sized\\.isAnyOf is given cases the prover cannot see"))
      // A literal asked of a division, which JavaScript rounds.
      expect(said).toMatch(unread("AskShare", inexact("JustBelowOne")))
      // A struct with no key asked of an array.
      expect(said).toMatch(unread("AskList", inexact("Anything")))
      expect(said).not.toMatch(/proved for Ask|violated|read wrongly/)
    }),
    120_000
  )
})
