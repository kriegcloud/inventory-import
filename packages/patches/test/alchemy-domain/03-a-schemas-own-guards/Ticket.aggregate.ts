// A ticket that is new, then open, then closed, with every case told the way a schema tells it: the union's own
// `guards`, `isAnyOf`, `match` and `matchOrElse`, `Schema.is`, and `constTrue` and `constFalse`
// as the answers. That reading is what the patch is about. Each function decides one rule that holds and one that is
// broken on purpose, so a prover that read the function as anything else would lose one of the two.
import * as Domain from "@alchemy.run/domain"
import { constFalse, constTrue } from "effect/Function"
import * as S from "effect/Schema"

/** A ticket was opened under this title. */
export class Opened extends Domain.Event("Opened", { title: S.String }) {}

/** A note was added to an open ticket. */
export class Noted extends Domain.Event("Noted", {}) {}

/** A ticket was closed by this person. */
export class Closed extends Domain.Event("Closed", { by: S.String }) {}

/** Every event of a ticket, told by its `_tag`. */
export const TicketEvent = S.Union([Opened, Noted, Closed]).pipe(S.toTaggedUnion("_tag"))

/** The ticket is not in the state the command needs. */
export class NotNow extends Domain.Rejection("NotNow", {}) {}

/** The title is longer than a ticket keeps. */
export class TitleTooLong extends Domain.Rejection("TitleTooLong", {}) {}

/** Open a new ticket under a title. */
export class Open extends Domain.Command("Open", {
  input: { ticketId: S.String, title: S.String },
  events: [Opened],
  rejects: [NotNow, TitleTooLong]
}) {}

/** Add a note to an open ticket. */
export class Note extends Domain.Command("Note", {
  input: { ticketId: S.String },
  events: [Noted],
  rejects: [NotNow]
}) {}

/** Close an open ticket. */
export class Close extends Domain.Command("Close", {
  input: { ticketId: S.String, by: S.String },
  events: [Closed],
  rejects: [NotNow]
}) {}

/** Who closed a ticket: a name, never the empty text. */
export const Name = S.String.check(S.isMinLength(1))

/** Every command of a ticket, told by its `_tag`. */
export const TicketCommand = S.Union([Open, Note, Close]).pipe(S.toTaggedUnion("_tag"))

const Title = S.String.check(S.isMaxLength(20))
const Notes = S.Int.check(S.isBetween({ minimum: 0, maximum: 3 }))

/** What a ticket is: new, open under a title of at most 20 characters with at most 3 notes, or closed. */
export const TicketState = S.Union([
  S.Struct({ status: S.Literal("New") }),
  S.Struct({ status: S.Literal("Open"), title: Title, notes: Notes }),
  S.Struct({ status: S.Literal("Closed"), title: Title, notes: Notes, by: S.String })
]).pipe(S.toTaggedUnion("status"))

type TicketState = typeof TicketState.Type

const isOpened = S.is(Opened)
const notesOf = TicketState.match({ New: () => 0, Open: (open) => open.notes, Closed: (closed) => closed.notes })
const isLive = TicketState.isAnyOf(["New", "Open"])

/** One ticket. */
export class Ticket extends Domain.Aggregate("Ticket", {
  id: S.String,
  state: TicketState,
  initial: { status: "New" },
  invariants: {
    // `guards`, on a state the code built: the whole case, its title's length included.
    ATitleIsNeverLongerThanTwenty: (ticket) =>
      TicketState.matchOrElse(ticket, { New: constTrue }, (titled) => titled.title.length <= 20),
    // Broken on purpose, by the title "x": a guard that never answers yes would keep it.
    ATicketIsNeverTitledX: (ticket) => TicketState.guards.New(ticket) || ticket.title !== "x",
    // `match`, data-last: each case's own handler.
    ATicketNeverHoldsMoreThanThreeNotes: (ticket) => notesOf(ticket) <= 3,
    // Broken on purpose, by a second note.
    ATicketNeverHoldsTwoNotes: (ticket) =>
      TicketState.match(ticket, { New: constTrue, Open: (open) => open.notes < 2, Closed: constTrue }),
    // `isAnyOf` of two cases: a ticket is one of them or closed, so each case named has to count.
    ATicketIsLiveOrClosed: (ticket) => isLive(ticket) || TicketState.guards.Closed(ticket),
    // Broken on purpose, by a close: `isAnyOf` of every case, said of a closed ticket.
    ATicketIsNeverClosed: (ticket) => !TicketState.isAnyOf(["Closed"])(ticket),
    // `matchOrElse`, data-last, with `constFalse` as the answer for the one case it names.
    ATicketIsNeverClosedByNobody: TicketState.matchOrElse({ Closed: (closed) => closed.by !== "" }, constTrue),
    // Broken on purpose, by a close: `constFalse` read as anything but no would keep it.
    AnOpenTicketIsTheOnlyKind: TicketState.matchOrElse({ Closed: constFalse }, constTrue)
  },
  transitions: {
    // A union's guard of a command's class: yes to its own command, though the prover loaded the class a second time.
    OnlyACloseCloses: ({ before, after, command }) =>
      !TicketState.guards.Closed(after) || TicketState.guards.Closed(before) || TicketCommand.guards.Close(command),
    // Broken on purpose, by a close: a guard that said yes to another command's class would keep it.
    OnlyAnOpenChangesATicket: ({ before, after, command }) =>
      TicketCommand.guards.Open(command) || TicketState.guards.Closed(after) === TicketState.guards.Closed(before)
  },
  commands: [Open, Note, Close],
  keyOf: (cmd) => cmd.ticketId,
  decide: {
    Open: (ticket, cmd) => {
      if (!TicketState.guards.New(ticket)) return NotNow.make({})
      // The guard of a case, asked of a value built here: it says yes only when the title fits the case's schema,
      // and no to a value that leaves a field of the case out (who closed it).
      return TicketState.guards.Open({ status: "Open", title: cmd.title, notes: 0 }) &&
        !TicketState.guards.Closed({ status: "Closed", title: cmd.title, notes: 0 })
        ? [Opened.make({ title: cmd.title })]
        : TitleTooLong.make({})
    },
    Note: (ticket) => (TicketState.guards.Open(ticket) && ticket.notes < 3 ? [Noted.make({})] : NotNow.make({})),
    Close: (ticket, cmd) =>
      // `Schema.is` of a plain schema, on the command's text.
      S.is(Name)(cmd.by) && TicketState.guards.Open(ticket) ? [Closed.make({ by: cmd.by })] : NotNow.make({})
  },
  evolve: {
    // `Schema.is` of an event's class, and the event union's own guard: each says yes to its own event only.
    Opened: (ticket, event): TicketState =>
      isOpened(event) && TicketEvent.guards.Opened(event) && !TicketEvent.guards.Closed(event)
        ? { status: "Open", title: event.title, notes: 0 }
        : ticket,
    Noted: (ticket, event): TicketState =>
      TicketState.guards.Open(ticket) && TicketEvent.guards.Noted(event)
        ? { ...ticket, notes: ticket.notes + 1 }
        : ticket,
    Closed: (ticket, event): TicketState =>
      TicketState.guards.Open(ticket) && TicketEvent.isAnyOf(["Closed"])(event)
        ? { status: "Closed", title: ticket.title, notes: ticket.notes, by: event.by }
        : ticket
  }
}) {}
