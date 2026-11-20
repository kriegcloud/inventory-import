// The review's draft against a server and a network that answer in any order: the person decides, somebody else
// saves, a save is taken by the server and answered late, fails or is refused, reads and other answers arrive out of
// turn, the person leaves the Review step and comes back. Each rule here is one where a wrong result loses a decision
// without a word: the person's own, or one somebody else made on the same import. And the person confirms: a confirm
// the server makes writes exactly the decisions the screen showed when it was sent, never one it had not shown.
import { describe, expect, it } from "@effect/vitest"
import * as A from "effect/Array"
import * as Eq from "effect/Equal"
import * as O from "effect/Option"
import * as R from "effect/Record"
import * as S from "effect/Schema"
import { type DecisionDelta, decisionFromFlags, type SavedDecisions } from "@inventory/catalog-contract/Decision"
import {
  type Draft,
  DraftEffect,
  DraftEvent,
  emptyDraft,
  over,
  type Picture,
  mine,
  type RowChanges,
  Said,
  settled,
  shown,
  step,
  type Waiting,
  waiting
} from "../src/Draft.machine.ts"

const out = decisionFromFlags({ out: true })
const kept = decisionFromFlags({ kept: true })

const Row = S.Literals(["a", "b", "c"])
const To = S.Literals(["out", "kept", "nothing"])
/** Everything that can happen, in any order. */
const Command = S.TaggedUnion({
  Decide: { row: Row, to: To },
  SomeoneElse: { row: Row, to: To },
  ServerTakesSave: {},
  SaveAnswers: {},
  SaveFails: {},
  SaveRefused: {},
  SaveAgain: {},
  ReturnToTab: {},
  ServerTakesRead: {},
  ReadArrives: {},
  OtherAnswerSent: {},
  OtherAnswerArrives: {},
  Leave: {},
  ComeBack: {},
  ComeBackQuickly: {},
  Reload: {},
  SomeoneConfirms: {},
  PressConfirm: {},
  ServerTakesConfirm: {},
  ConfirmAnswers: {},
  ConfirmFails: {}
})
type Command = typeof Command.Type

const change = (row: string, to: "out" | "kept" | "nothing"): RowChanges => ({
  [row]: to === "nothing" ? O.none() : O.some(to === "out" ? out : kept)
})

/** The screen, the server, and what is on its way between them. */
interface World {
  draft: Draft
  server: Picture
  /** The import's view as the tab holds it: what every screen of the import reads. */
  view: O.Option<Picture>
  /** The save that is out: on its way, or taken by the server with what it will answer. */
  save: O.Option<{
    readonly delta: DecisionDelta
    readonly answer: O.Option<{ readonly revision: number; readonly changed: boolean }>
  }>
  /** The read that is out: on its way, or taken by the server with the picture it will answer. */
  read: O.Option<O.Option<Picture>>
  /** Pictures on their way from other requests (a match, a card's Continue), oldest first. */
  late: Array<Picture>
  /** The rows the person changed on this screen that the server has not confirmed, each with what they chose. */
  dirty: Record<string, "out" | "kept" | "nothing">
  /** The rows the server confirmed for the person, until somebody else changes the row or the person does again. */
  confirmed: Record<string, "out" | "kept" | "nothing">
  /** Rows of the save the server has taken that somebody else decided again before its answer arrived. */
  overtaken: Record<string, true>
  /** Every picture the server has held, by revision. */
  history: Record<number, SavedDecisions>
  restarts: number
  /** How many times the person was told that something changed on another screen. */
  announced: number
  /** How many times the person was told something about a save: not saved yet, refused, an accept taken back. */
  said: number
  /**
   * The confirm that is out: the revision it names, the rows it carries, what the screen showed when it was sent,
   * and what the server did with it once it has taken it.
   */
  confirm: O.Option<{
    readonly revision: number
    readonly delta: DecisionDelta
    readonly shown: SavedDecisions
    readonly answer: O.Option<"made" | "moved">
  }>
  /** The server made a confirm: the import is closed, and these are the decisions it was written with. */
  closed: O.Option<SavedDecisions>
  /** The revision at which somebody else's confirm closed the import: a picture of that revision or later says so. */
  elsewhere: O.Option<number>
  /** The person's waiting rows as the browser keeps them, written after everything that happens. */
  kept: O.Option<Waiting>
  /** Rows the server refused, set aside by the screen: each with what the person had chosen. */
  refused: Record<string, "out" | "kept" | "nothing">
  /** The rows this page is to name as left over, from when it learned the import was closed; none until then. */
  named: O.Option<Record<string, "out" | "kept" | "nothing">>
  /** The latest revision this tab has been told of: by a picture put into its view, or by a save's answer. */
  told: number
  /**
   * What the review region holds for itself: its decisions since it was last started, or none while it has made
   * none (it then shows what the draft shows). A Restart starts it again; leaving lets it go only after the idle
   * time, so a quick return finds it as it was.
   */
  region: O.Option<SavedDecisions>
}

const start = (): World => ({
  draft: emptyDraft,
  server: { revision: 1, decisions: {} },
  view: O.none(),
  save: O.none(),
  read: O.none(),
  late: [],
  dirty: {},
  confirmed: {},
  overtaken: {},
  history: { 1: {} },
  restarts: 0,
  announced: 0,
  said: 0,
  confirm: O.none(),
  closed: O.none(),
  told: 0,
  region: O.none(),
  elsewhere: O.none(),
  kept: O.none(),
  refused: {},
  named: O.none()
})

/** Whether a picture says the import can still be decided: one taken after somebody else's confirm says it cannot. */
const openIn = (world: World, picture: Picture): boolean =>
  !O.exists(world.elsewhere, (closedAt) => picture.revision >= closedAt)

/** True once this tab's view says the import was confirmed by somebody else. */
const toldClosed = (world: World): boolean => O.exists(world.view, (view) => !openIn(world, view))

/** What the person sees in the region: its own decisions, or the draft's while it has made none. */
const regionShows = (world: World): SavedDecisions => O.getOrElse(world.region, () => shown(world.draft))

/** The server takes rows; true when they changed something. A save that changes nothing is no new revision. */
const serverTakes = (world: World, changes: RowChanges): boolean => {
  const next = over(world.server.decisions, changes)
  if (Eq.equals(next, world.server.decisions)) return false
  world.server = { revision: world.server.revision + 1, decisions: next }
  world.history[world.server.revision] = next
  return true
}

const valueOf = (to: "out" | "kept" | "nothing") => (to === "nothing" ? O.none() : O.some(to === "out" ? out : kept))

/** A picture reaches the step that is drawn, with whether it says the import can still be decided. */
const arrive = (world: World, picture: Picture): void =>
  dispatch(world, DraftEvent.ViewArrived({ ...picture, open: openIn(world, picture) }))

/** A picture is put into the tab's view: never one of an earlier revision, and an ask that is out is issued again. */
const put = (world: World, picture: Picture): void => {
  if (O.exists(world.view, (view) => view.revision > picture.revision)) return
  world.view = O.some(picture)
  world.told = Math.max(world.told, picture.revision)
  if (O.isSome(world.read)) world.read = O.some(O.none())
  if (world.draft.onScreen) arrive(world, picture)
}

/** Only rows the person changed here and the server has not confirmed, each as the person last chose it. */
const ownRows = (world: World, delta: DecisionDelta): void => {
  for (const row of [...R.keys(delta.set), ...delta.clear]) {
    expect(R.has(world.dirty, row), "a row is sent that the person did not change").toBe(true)
    expect(R.get(delta.set, row), "a row is sent with another value than the person chose").toEqual(
      valueOf(world.dirty[row] ?? "nothing")
    )
  }
}

const perform = (world: World, effect: DraftEffect): void =>
  DraftEffect.$match(effect, {
    Say: () => {
      world.said += 1
    },
    Send: ({ delta }) => {
      // Away from the step the draft does not follow the tab's view: a save sent then is refused by the server.
      expect(
        world.draft.onScreen && toldClosed(world),
        "a save is sent from a step that knows the import is closed"
      ).toBe(false)
      // One save at a time, never beside a confirm, and only of the person's own rows.
      expect([O.isNone(world.save), O.isNone(world.confirm)], "a save beside a save or a confirm").toEqual([true, true])
      ownRows(world, delta)
      world.save = O.some({ delta, answer: O.none() })
    },
    Ask: () => {
      world.read = O.some(O.none())
    },
    Put: ({ decisions, revision }) => {
      // The person's own save moves the view on, never back.
      // The person's own save moves the view on, never back. Off screen the draft does not follow the view, so a
      // save answered then may be behind it: the runner keeps the later one (`put`), and the next visit reads it.
      if (world.draft.onScreen) {
        expect(
          O.exists(world.view, (view) => view.revision > revision),
          "the person's own save moved the view back"
        ).toBe(false)
      }
      put(world, { revision, decisions })
    },
    Restart: ({ announce }) => {
      // Counted when the person is there to see it: a draft let go while nobody looks restarts the region too.
      if (world.draft.onScreen) world.restarts += 1
      if (announce) world.announced += 1
      world.region = O.none()
    },
    Confirm: ({ delta, revision }) => {
      // One confirm at a time, never beside a save, carrying only the person's own rows: never the picture.
      expect([O.isNone(world.save), O.isNone(world.confirm)], "a confirm beside a save or a confirm").toEqual([
        true,
        true
      ])
      ownRows(world, delta)
      world.confirm = O.some({ revision, delta, shown: shown(world.draft), answer: O.none() })
    }
  })

const dispatch = (world: World, event: DraftEvent): void => {
  const before = world.draft
  const stepped = step(before, event)
  // Whenever what the screen shows changes and the person did not do it, the region is told to start again: its own
  // state would otherwise go on saying what it said. (The first picture of a visit starts the region itself.)
  if (
    !DraftEvent.$is("Decided")(event) &&
    before.onScreen &&
    stepped.draft.onScreen &&
    O.isSome(before.held) &&
    O.isSome(stepped.draft.held) &&
    !Eq.equals(shown(before), shown(stepped.draft))
  ) {
    expect(
      A.some(stepped.effects, DraftEffect.$is("Restart")),
      `what the screen shows changed without the person (${event._tag}), and the region was not told to start again`
    ).toBe(true)
  }
  world.draft = stepped.draft
  for (const effect of stepped.effects) perform(world, effect)
  // What waits is kept in the browser as it changes, so a reload finds it.
  world.kept = waiting(world.draft)
}

const sentRows = (delta: DecisionDelta): ReadonlyArray<string> => [...R.keys(delta.set), ...delta.clear]

/** The Review step is drawn again: it reads the view it finds, and asks again behind it. */
const comeBack = (world: World): void => {
  dispatch(world, DraftEvent.Opened({ kept: O.none() }))
  O.map(world.view, (view) => arrive(world, view))
  world.read = O.some(O.none())
}

const run = (world: World, command: Command): void => {
  // A confirmed import is closed: all that is left to happen is the confirm's own answer.
  if (O.isSome(world.closed) && !Command.guards.ConfirmAnswers(command)) return
  Command.match(command, {
    PressConfirm: () => {
      if (world.draft.onScreen && O.isSome(world.draft.held)) dispatch(world, DraftEvent.ConfirmPressed())
      return
    },
    ServerTakesConfirm: () =>
      O.match(world.confirm, {
        onNone: () => {},
        onSome: (confirm) => {
          // A closed import takes no confirm: it refuses it (`ConfirmFails`).
          if (O.isSome(confirm.answer) || O.isSome(world.elsewhere)) return
          // Made on another revision than the draft is at: the server writes nothing.
          if (confirm.revision !== world.server.revision) {
            world.confirm = O.some({ ...confirm, answer: O.some("moved") })
            return
          }
          const written = over(world.server.decisions, {
            ...R.map(confirm.delta.set, (decision) => O.some(decision)),
            ...R.fromEntries(A.map(confirm.delta.clear, (row) => [row, O.none()] as const))
          })
          // The rule: what a confirm writes is what its screen showed. No decision it had not shown, none missing.
          expect(written, "a confirm wrote another thing than its screen showed").toEqual(confirm.shown)
          world.server = { revision: world.server.revision + 1, decisions: written }
          world.history[world.server.revision] = written
          world.closed = O.some(written)
          world.confirm = O.some({ ...confirm, answer: O.some("made") })
        }
      }),
    ConfirmAnswers: () =>
      O.match(world.confirm, {
        onNone: () => {},
        onSome: (confirm) => {
          if (O.isNone(confirm.answer)) return
          world.confirm = O.none()
          if (confirm.answer.value === "moved") return dispatch(world, DraftEvent.ConfirmMoved())
          world.dirty = {}
          world.confirmed = {}
          world.region = O.none()
          dispatch(world, DraftEvent.ConfirmDone())
        }
      }),
    ConfirmFails: () => {
      // Lost on its way to the server: nothing was written.
      if (!O.exists(world.confirm, (confirm) => O.isNone(confirm.answer))) return
      world.confirm = O.none()
      return dispatch(world, DraftEvent.ConfirmFailed())
    },
    Decide: (command) => {
      if (!world.draft.onScreen || O.isNone(world.draft.held)) return
      // The person acts on what the region shows, and what is sent is what that action changed there.
      const before = regionShows(world)
      const after = over(before, change(command.row, command.to))
      if (Eq.equals(after, before)) return
      world.dirty[command.row] = command.to
      delete world.confirmed[command.row]
      // Deciding again lets go of the rows a refusal set aside: the person was told they were not saved.
      world.refused = {}
      world.region = O.some(after)
      return dispatch(world, DraftEvent.Decided({ changes: change(command.row, command.to) }))
    },
    SomeoneElse: (command) => {
      if (O.isSome(world.elsewhere)) return
      if (serverTakes(world, change(command.row, command.to))) {
        delete world.confirmed[command.row]
        // Decided after the server took the person's save of the same row: theirs is the later word.
        if (O.exists(world.save, (save) => O.isSome(save.answer) && A.contains(sentRows(save.delta), command.row))) {
          world.overtaken[command.row] = true
        }
      }
      return
    },
    // Somebody else confirms the import as the server holds it: it is closed, one revision on.
    SomeoneConfirms: () => {
      if (O.isSome(world.elsewhere) || O.exists(world.confirm, (confirm) => O.isSome(confirm.answer))) return
      world.server = { revision: world.server.revision + 1, decisions: world.server.decisions }
      world.history[world.server.revision] = world.server.decisions
      world.elsewhere = O.some(world.server.revision)
    },
    // The page is loaded again. What was on its way to the old page never arrives, and a request the server had not
    // taken is lost; what the browser kept is all the new page has of the person's.
    Reload: () => {
      world.save = O.none()
      world.confirm = O.none()
      world.read = O.none()
      world.late = []
      world.view = O.none()
      world.region = O.none()
      world.told = 0
      world.overtaken = {}
      // Rows the server refused while the import was open are not kept: the person was told when it refused them.
      // (The rows a closed import left over are kept until the result has named them.)
      if (!O.exists(world.kept, (kept) => kept.leftOver)) world.refused = {}
      const kept = world.kept
      world.draft = emptyDraft
      dispatch(world, DraftEvent.Opened({ kept }))
      world.read = O.some(O.none())
    },
    ServerTakesSave: () =>
      O.match(world.save, {
        onNone: () => {},
        onSome: (save) => {
          // A closed import takes no save: it refuses it (`SaveRefused`).
          if (O.isSome(save.answer) || O.isSome(world.elsewhere)) return
          const changed = serverTakes(world, {
            ...R.map(save.delta.set, (decision) => O.some(decision)),
            ...R.fromEntries(A.map(save.delta.clear, (row) => [row, O.none()] as const))
          })
          world.save = O.some({ delta: save.delta, answer: O.some({ revision: world.server.revision, changed }) })
        }
      }),
    SaveAnswers: () =>
      O.match(world.save, {
        onNone: () => {},
        onSome: (save) => {
          if (O.isNone(save.answer)) return
          world.save = O.none()
          // Confirmed, unless the person changed the row again since it was sent.
          for (const row of sentRows(save.delta)) {
            const chose = world.dirty[row]
            if (!R.has(world.draft.unsent, row) && chose !== undefined) {
              if (!R.has(world.overtaken, row)) world.confirmed[row] = chose
              delete world.dirty[row]
            }
          }
          world.overtaken = {}
          world.told = Math.max(world.told, save.answer.value.revision)
          dispatch(world, DraftEvent.SaveAnswered({ ...save.answer.value, notApplied: [] }))
        }
      }),
    SaveFails: () => {
      if (O.isNone(world.save)) return
      world.save = O.none()
      return dispatch(world, DraftEvent.SaveFailed())
    },
    SaveRefused: () => {
      if (!O.exists(world.save, (save) => O.isNone(save.answer))) return
      world.save = O.none()
      // The screen goes back to what is saved; the rows are set aside until the import's picture says what it is.
      world.refused = { ...world.refused, ...world.dirty }
      world.dirty = {}
      return dispatch(world, DraftEvent.SaveRefused({ reason: "The import was already imported." }))
    },
    SaveAgain: () => {
      if (world.draft.stalled) dispatch(world, DraftEvent.SaveAgain())
      return
    },
    ReturnToTab: () => {
      if (world.draft.onScreen) world.read = O.some(O.none())
      return
    },
    ServerTakesRead: () => {
      if (O.exists(world.read, O.isNone)) world.read = O.some(O.some(world.server))
      return
    },
    ReadArrives: () =>
      O.match(O.flatten(world.read), {
        onNone: () => {},
        onSome: (picture) => {
          world.read = O.none()
          put(world, picture)
        }
      }),
    OtherAnswerSent: () => {
      world.late.push(world.server)
      return
    },
    OtherAnswerArrives: () => {
      const picture = world.late.shift()
      if (picture !== undefined) put(world, picture)
      return
    },
    Leave: () => {
      if (world.draft.onScreen) dispatch(world, DraftEvent.Left())
      return
    },
    ComeBack: () => {
      if (world.draft.onScreen) return
      // Back after the idle time: the region's own state was let go.
      world.region = O.none()
      comeBack(world)
    },
    // Back within the idle time: the region's own state is still there.
    ComeBackQuickly: () => {
      if (!world.draft.onScreen) comeBack(world)
    }
  })
}

/** Holds after every step, whatever happened before it. */
const holds = (world: World): void => {
  // The screen never claims a revision the server has not reached.
  O.map(world.draft.held, (held) =>
    expect(held.revision, "the screen claims a revision the server has not reached").toBeLessThanOrEqual(
      world.server.revision
    )
  )
  // While the step is drawn, what it holds of the server is the view the tab holds: never ahead of it, never behind.
  // (A confirmed import keeps no draft: its screen is the result.)
  // (While this screen's own confirm is out, its answer says whether it is the one that closed the import.)
  if (world.draft.onScreen && toldClosed(world) && world.draft.confirm !== "out") return closedHolds(world)
  // A decision the person made is on the server, or it still waits on this screen (and so in the browser): never
  // neither, whatever was lost on the way and whatever page this is.
  // (Once the import was closed, the rows left over are kept the same way until the result has named them.)
  const held = { ...O.getOrElse(world.draft.leftOver, (): RowChanges => ({})), ...mine(world.draft) }
  for (const [row, chose] of R.toEntries(world.dirty)) {
    if (Eq.equals(R.get(world.server.decisions, row), valueOf(chose))) continue
    expect(R.get(held, row), "a decision the person made is neither on the server nor waiting").toEqual(
      O.some(valueOf(chose))
    )
  }
  if (world.draft.onScreen && O.isNone(world.closed) && !toldClosed(world)) {
    expect(
      O.map(world.draft.held, (held) => held.revision),
      "on screen, the draft holds another revision than the tab's view"
    ).toEqual(O.map(world.view, (view) => view.revision))
  }
  // What it holds is what the server held at that revision: a revision is never claimed for another picture.
  O.map(world.draft.held, (held) =>
    expect(held.decisions, "the picture held is not what the server held at that revision").toEqual(
      world.history[held.revision]
    )
  )
  // The person's own decision stays on screen: while it waits to be saved, and once the server has it, until
  // somebody else decides that row.
  if (O.isSome(world.draft.held)) {
    const onScreen = shown(world.draft)
    for (const [row, chose] of R.toEntries({ ...world.confirmed, ...world.dirty })) {
      expect(R.get(onScreen, row), "the person's own decision is not on screen").toEqual(valueOf(chose))
    }
  }
  if (!world.draft.onScreen || O.isNone(world.draft.held) || O.isSome(world.closed)) return
  // What the region shows is what the draft shows: the counts, the confirm button and the rows say one thing.
  expect(regionShows(world), "the region shows another thing than the draft").toEqual(shown(world.draft))
  if (!still(world)) return
  // With nothing on its way and nothing waiting to be sent, the screen waits for nothing: it holds no saved row over
  // a picture that lacks it (nobody would bring the newer one), it is not behind a revision it has been told of,
  // and when that revision is the server's latest, what it shows is what the server holds.
  expect(
    O.isNone(world.draft.landed),
    "nothing is on its way, and a saved row still waits for a picture nobody asked for"
  ).toBe(true)
  expect(
    O.getOrThrow(world.draft.held).revision,
    "nothing is on its way, and the screen is behind a revision it was told of"
  ).toBeGreaterThanOrEqual(world.told)
  if (world.told >= world.server.revision) {
    expect(
      shown(world.draft),
      "nothing is on its way, the screen was told of the server's latest revision, and shows another thing"
    ).toEqual(world.server.decisions)
  }
}

/**
 * What holds once this tab knows somebody else confirmed the import: the draft has ended, nothing of it is sent or
 * kept, and the rows left over are exactly the person's rows the server never took, each with what they had decided.
 */
const closedHolds = (world: World): void => {
  const draft = world.draft
  // The first time the draft is found ended: the person's rows the server never took are the ones to be named,
  // once, and from then on they are neither waiting nor expected.
  if (O.isNone(world.named)) {
    world.named = O.some(
      R.filter(
        { ...world.refused, ...world.dirty },
        (chose, row) => !Eq.equals(R.get(world.server.decisions, row), valueOf(chose))
      )
    )
    world.dirty = {}
    world.refused = {}
    world.confirmed = {}
  }
  expect(
    [O.isNone(draft.held), O.isNone(draft.flight), R.isEmptyReadonlyRecord(draft.unsent), draft.confirm],
    "the import is closed, and the draft has not ended"
  ).toEqual([true, true, true, "idle"])
  // What the browser keeps now is the rows left over, until the result has named them: nothing else, nothing sent.
  expect(
    O.map(world.kept, (kept) => kept.rows),
    "the import is closed, and the browser keeps something else than the rows left over"
  ).toEqual(draft.leftOver)
  const never = O.getOrElse(world.named, (): World["refused"] => ({}))
  expect(
    O.getOrElse(draft.leftOver, (): RowChanges => ({})),
    "the rows named as left over are not the person's rows the server never took"
  ).toEqual(R.map(never, valueOf))
}

/** Nothing is on its way between the screen and the server, and nothing of the person's waits to be sent. */
const still = (world: World): boolean =>
  O.isNone(world.save) &&
  O.isNone(world.read) &&
  O.isNone(world.confirm) &&
  world.late.length === 0 &&
  O.isNone(world.draft.flight) &&
  R.isEmptyReadonlyRecord(world.draft.unsent)

/** Everything on its way lands, and the person presses "Save again" where it is offered. */
const quiet = (world: World): void => {
  const then = (command: Command): void => {
    run(world, command)
    holds(world)
  }
  then({ _tag: "ComeBack" })
  for (let turn = 0; turn < 12; turn += 1) {
    then({ _tag: "SaveAgain" })
    then({ _tag: "ServerTakesSave" })
    then({ _tag: "SaveAnswers" })
    then({ _tag: "ServerTakesConfirm" })
    then({ _tag: "ConfirmAnswers" })
    // A closed import refuses what is still out.
    if (O.isSome(world.elsewhere)) {
      then({ _tag: "SaveRefused" })
      then({ _tag: "ConfirmFails" })
    }
    for (let left = world.late.length; left > 0; left -= 1) then({ _tag: "OtherAnswerArrives" })
    then({ _tag: "ServerTakesRead" })
    then({ _tag: "ReadArrives" })
  }
}

const rows = ["a", "b", "c"] as const
const tos = ["out", "kept", "nothing"] as const

/** What a run may include besides deciding, saving and reading. */
interface Play {
  /** The person presses the confirm button. */
  readonly confirms: boolean
  /** Somebody else confirms the import. */
  readonly elsewhere: boolean
  /** The page is loaded again. */
  readonly reloads: boolean
}

/**
 * What can happen next, by kind: only what would do something in the world as it stands, so a run of forty commands
 * is forty things that happened.
 */
const enabled = (world: World, may: Play): ReadonlyArray<ReadonlyArray<Command>> => {
  const { confirms, elsewhere, reloads } = may
  // A confirmed import is closed: all that is left to happen is the confirm's own answer.
  if (O.isSome(world.closed)) {
    return O.exists(world.confirm, (confirm) => O.isSome(confirm.answer)) ? [[{ _tag: "ConfirmAnswers" }]] : []
  }
  const draft = world.draft
  const reading = draft.onScreen && O.isSome(draft.held)
  const seen = regionShows(world)
  const pairs = A.flatMap(rows, (row) => A.map(tos, (to) => ({ row, to })))
  const decides = A.filter(pairs, (pair) => reading && !Eq.equals(over(seen, change(pair.row, pair.to)), seen))
  const others = A.filter(
    pairs,
    (pair) =>
      O.isNone(world.elsewhere) &&
      !Eq.equals(over(world.server.decisions, change(pair.row, pair.to)), world.server.decisions)
  )
  const saveOut = O.exists(world.save, (save) => O.isNone(save.answer))
  const confirmOut = O.exists(world.confirm, (confirm) => O.isNone(confirm.answer))
  const when = (condition: boolean, command: Command): ReadonlyArray<Command> => (condition ? [command] : [])
  const kinds: ReadonlyArray<ReadonlyArray<Command>> = [
    A.map(decides, (pair): Command => ({ _tag: "Decide", ...pair })),
    A.map(others, (pair): Command => ({ _tag: "SomeoneElse", ...pair })),
    when(saveOut && O.isNone(world.elsewhere), { _tag: "ServerTakesSave" }),
    when(
      O.exists(world.save, (save) => O.isSome(save.answer)),
      { _tag: "SaveAnswers" }
    ),
    when(O.isSome(world.save), { _tag: "SaveFails" }),
    when(saveOut, { _tag: "SaveRefused" }),
    when(draft.stalled, { _tag: "SaveAgain" }),
    when(draft.onScreen, { _tag: "ReturnToTab" }),
    when(O.exists(world.read, O.isNone), { _tag: "ServerTakesRead" }),
    when(O.exists(world.read, O.isSome), { _tag: "ReadArrives" }),
    when(world.late.length < 2, { _tag: "OtherAnswerSent" }),
    when(world.late.length > 0, { _tag: "OtherAnswerArrives" }),
    when(draft.onScreen, { _tag: "Leave" }),
    when(!draft.onScreen, { _tag: "ComeBack" }),
    when(!draft.onScreen, { _tag: "ComeBackQuickly" }),
    when(confirms && reading && draft.confirm === "idle", { _tag: "PressConfirm" }),
    when(confirmOut && O.isNone(world.elsewhere), { _tag: "ServerTakesConfirm" }),
    when(elsewhere && O.isNone(world.elsewhere) && !O.exists(world.confirm, (confirm) => O.isSome(confirm.answer)), {
      _tag: "SomeoneConfirms"
    }),
    when(reloads, { _tag: "Reload" }),
    when(
      O.exists(world.confirm, (confirm) => O.isSome(confirm.answer)),
      { _tag: "ConfirmAnswers" }
    ),
    when(confirmOut, { _tag: "ConfirmFails" })
  ]
  return A.filter(kinds, A.isReadonlyArrayNonEmpty)
}

/** A command as one word or three, for the ordering a failure prints. */
const said = (command: Command): string =>
  Command.guards.Decide(command) || Command.guards.SomeoneElse(command)
    ? `${command._tag} ${command.row} ${command.to}`
    : command._tag

const Pick = S.Int.check(S.isBetween({ minimum: 0, maximum: 999 }))
/** Which kind of thing happens next, and which of that kind: each drawn from what is enabled when its turn comes. */
const Picks = S.Array(S.Tuple([Pick, Pick])).check(S.isMinLength(30), S.isMaxLength(60))

const opened = (decisions: SavedDecisions = {}): World => {
  const world = start()
  world.server = { revision: 1, decisions }
  world.history[1] = decisions
  run(world, { _tag: "ComeBack" })
  run(world, { _tag: "ServerTakesRead" })
  run(world, { _tag: "ReadArrives" })
  return world
}

/** The first thing that does not hold when `commands` are played from an opened review, in words; none if all holds. */
const broken = (commands: ReadonlyArray<Command>): O.Option<string> => {
  const world = opened()
  const one = (command: Command): void => {
    run(world, command)
    holds(world)
  }
  try {
    for (const command of commands) one(command)
    // Everything on its way lands.
    quiet(world)
    expect(
      [O.isNone(world.save), O.isNone(world.confirm), world.draft.confirm],
      "after everything landed, a save or a confirm is still out"
    ).toEqual([true, true, "idle"])
    expect(settled(world.draft), "after everything landed, a row of the person's still waits").toBe(true)
    // A look at the server, as any return to the tab gives: an open import then shows what the server holds.
    one({ _tag: "ReturnToTab" })
    one({ _tag: "ServerTakesRead" })
    one({ _tag: "ReadArrives" })
    if (O.isNone(world.closed) && O.isNone(world.elsewhere)) {
      expect(shown(world.draft), "after a look at the server, the screen shows another thing than it holds").toEqual(
        world.server.decisions
      )
    }
    return O.none()
  } catch (error) {
    return O.some(error instanceof Error ? error.message : String(error))
  }
}

/** The ordering with every command left out that it still fails without: what a failure prints. */
const shortest = (commands: ReadonlyArray<Command>): ReadonlyArray<Command> => {
  const without = A.findFirst(
    A.map(commands, (_, n) => A.remove(commands, n)),
    (fewer) => O.isSome(broken(fewer))
  )
  return O.match(without, { onNone: () => commands, onSome: shortest })
}

/**
 * Draws each command from what is enabled when its turn comes, then checks the whole ordering. A failure is thrown
 * under its shortest ordering, as words, with what did not hold.
 */
const play = (picks: typeof Picks.Type, may: Play): void => {
  const world = opened()
  const commands: Array<Command> = []
  for (const [kind, which] of picks) {
    const kinds = enabled(world, may)
    const of = kinds[kind % Math.max(1, kinds.length)]
    const command = of?.[which % of.length]
    if (command === undefined) break
    commands.push(command)
    // The world moves on so the next draw is from what is enabled then; what must hold is checked by `broken`.
    try {
      run(world, command)
    } catch {
      break
    }
  }
  if (O.isNone(broken(commands))) return
  const ordering = shortest(commands)
  throw new Error(`${A.join(A.map(ordering, said), ", ")}\n${O.getOrElse(broken(ordering), () => "")}`)
}

// Thirty to sixty commands a run, each one enabled when it is drawn (`enabled`): the runner bounds a collection by
// its `size`, ten unless told, so both are given.
describe("the review's draft, whatever order things happen in", () => {
  it.prop(
    "sends only the person's own rows, never runs ahead of the server, never shows the region another thing than the draft, and waits for nothing it was not told is coming",
    { picks: Picks },
    ({ picks }) => play(picks, { confirms: false, elsewhere: false, reloads: false }),
    { timeout: 120_000, arbitrary: { runs: 1000, size: 60 } }
  )

  it.prop(
    "with the person confirming: a confirm the server makes writes what its screen showed, and nothing is sent beside it",
    { picks: Picks },
    ({ picks }) => play(picks, { confirms: true, elsewhere: false, reloads: false }),
    { timeout: 120_000, arbitrary: { runs: 1000, size: 60 } }
  )

  it.prop(
    "with the page loaded again at any moment: a decision the person made is on the server or still waiting, never neither",
    { picks: Picks },
    ({ picks }) => play(picks, { confirms: false, elsewhere: false, reloads: true }),
    { timeout: 120_000, arbitrary: { runs: 1000, size: 60 } }
  )

  it.prop(
    "with somebody else confirming the import: nothing more is sent to it, and the rows left over are the person's that it never took",
    { picks: Picks },
    ({ picks }) => play(picks, { confirms: true, elsewhere: true, reloads: true }),
    { timeout: 120_000, arbitrary: { runs: 1000, size: 60 } }
  )
})

describe("the orderings that lost or hid a decision", () => {
  it("back on Review with a decision unsaved, another person's rows are still followed and never sent over", () => {
    const world = opened()
    run(world, { _tag: "Decide", row: "a", to: "out" })
    run(world, { _tag: "SaveFails" })
    run(world, { _tag: "Leave" })
    run(world, { _tag: "SomeoneElse", row: "b", to: "kept" })
    run(world, { _tag: "ComeBack" })
    run(world, { _tag: "ServerTakesRead" })
    run(world, { _tag: "ReadArrives" })
    // Both are on screen: theirs from the server, the person's own still waiting.
    expect(shown(world.draft)).toEqual({ a: out, b: kept })
    run(world, { _tag: "SaveAgain" })
    expect(O.map(world.save, (save) => save.delta)).toEqual(O.some({ set: { a: out }, clear: [] }))
    quiet(world)
    expect(world.server.decisions).toEqual({ a: out, b: kept })
  })

  it("a quick return after the region was started again starts from what is shown, and the next decision clears nothing", () => {
    const world = opened({ a: out })
    run(world, { _tag: "SomeoneElse", row: "b", to: "kept" })
    run(world, { _tag: "ReturnToTab" })
    run(world, { _tag: "ServerTakesRead" })
    run(world, { _tag: "ReadArrives" })
    expect(world.restarts).toBe(1)
    run(world, { _tag: "Decide", row: "c", to: "out" })
    run(world, { _tag: "ServerTakesSave" })
    run(world, { _tag: "SaveAnswers" })
    run(world, { _tag: "Leave" })
    run(world, { _tag: "ComeBack" })
    expect(shown(world.draft)).toEqual({ a: out, b: kept, c: out })
    run(world, { _tag: "Decide", row: "a", to: "nothing" })
    expect(O.map(world.save, (save) => save.delta)).toEqual(O.some({ set: {}, clear: ["a"] }))
    quiet(world)
    expect(world.server.decisions).toEqual({ b: kept, c: out })
  })

  it("an answer from another request that lands after a later save keeps the decision just saved on screen", () => {
    const world = opened()
    // A match is taken by the server; its answer is slow.
    run(world, { _tag: "SomeoneElse", row: "b", to: "kept" })
    run(world, { _tag: "OtherAnswerSent" })
    run(world, { _tag: "Decide", row: "a", to: "out" })
    run(world, { _tag: "ServerTakesSave" })
    // The save's answer is two revisions on: the import is asked again.
    run(world, { _tag: "SaveAnswers" })
    expect(O.isSome(world.read)).toBe(true)
    // The match's answer lands now, without the person's row in it.
    run(world, { _tag: "OtherAnswerArrives" })
    expect(shown(world.draft)).toEqual({ a: out, b: kept })
    // The ask is still out, and its answer is the newer picture.
    expect(O.isSome(world.read)).toBe(true)
    quiet(world)
    expect(shown(world.draft)).toEqual({ a: out, b: kept })
  })

  it("a decision the server refused is not shown again on the next visit, and is not sent with the next one", () => {
    const world = opened()
    run(world, { _tag: "Decide", row: "a", to: "out" })
    run(world, { _tag: "SaveRefused" })
    run(world, { _tag: "Leave" })
    run(world, { _tag: "ComeBack" })
    expect(shown(world.draft)).toEqual({})
    run(world, { _tag: "Decide", row: "b", to: "kept" })
    expect(O.map(world.save, (save) => save.delta)).toEqual(O.some({ set: { b: kept }, clear: [] }))
  })

  it("a save waiting for Save again does not stop a newer draft from being followed", () => {
    const world = opened()
    run(world, { _tag: "Decide", row: "a", to: "out" })
    run(world, { _tag: "SaveFails" })
    run(world, { _tag: "SomeoneElse", row: "b", to: "kept" })
    run(world, { _tag: "ReturnToTab" })
    run(world, { _tag: "ServerTakesRead" })
    run(world, { _tag: "ReadArrives" })
    expect(shown(world.draft)).toEqual({ a: out, b: kept })
    expect(world.restarts).toBe(1)
  })

  it("a save answered after the person left is the person's own: the view moves on, and the return starts nothing again", () => {
    const world = opened()
    run(world, { _tag: "Decide", row: "a", to: "out" })
    run(world, { _tag: "Leave" })
    run(world, { _tag: "ServerTakesSave" })
    run(world, { _tag: "SaveAnswers" })
    expect(O.map(world.view, (view) => view.revision)).toEqual(O.some(2))
    run(world, { _tag: "ComeBack" })
    expect(shown(world.draft)).toEqual({ a: out })
    expect(world.restarts).toBe(0)
  })

  it("a save the server counts as no change is not taken for the person's own next revision", () => {
    const world = opened()
    // The person leaves a row out and takes that back while the save is out; the save fails and waits.
    run(world, { _tag: "Decide", row: "a", to: "out" })
    run(world, { _tag: "Decide", row: "a", to: "nothing" })
    run(world, { _tag: "SaveFails" })
    // A read is on its way, taken by the server before somebody else decides another row.
    run(world, { _tag: "ReturnToTab" })
    run(world, { _tag: "ServerTakesRead" })
    run(world, { _tag: "SomeoneElse", row: "b", to: "kept" })
    // "Save again" sends a clear of a row the server never had decided: no change, at the other person's revision.
    run(world, { _tag: "SaveAgain" })
    run(world, { _tag: "ServerTakesSave" })
    expect(O.flatMap(world.save, (save) => save.answer)).toEqual(O.some({ revision: 2, changed: false }))
    run(world, { _tag: "ReadArrives" })
    run(world, { _tag: "SaveAnswers" })
    // The screen does not claim revision 2 for a picture without the other person's row: it holds what it read,
    // and has asked for the import again, at once.
    holds(world)
    expect(O.map(world.draft.held, (held) => held.revision)).toEqual(O.some(1))
    expect(O.isSome(world.read)).toBe(true)
    run(world, { _tag: "ServerTakesRead" })
    run(world, { _tag: "ReadArrives" })
    expect(shown(world.draft)).toEqual({ b: kept })
  })
})

describe("a confirm", () => {
  const sent = (world: World) => O.map(world.confirm, (confirm) => [confirm.revision, confirm.delta] as const)

  it("made on a picture somebody has changed since is refused, writes nothing, and the next one is on their row too", () => {
    const world = opened({ a: out })
    run(world, { _tag: "SomeoneElse", row: "b", to: "kept" })
    run(world, { _tag: "PressConfirm" })
    expect(sent(world)).toEqual(O.some([1, { set: {}, clear: [] }]))
    run(world, { _tag: "ServerTakesConfirm" })
    expect([O.isNone(world.closed), world.server.decisions]).toEqual([true, { a: out, b: kept }])
    run(world, { _tag: "ConfirmAnswers" })
    // Not made, and said so; the newer picture is asked for.
    expect([world.draft.confirm, world.draft.heldBack, O.isSome(world.read)]).toEqual(["idle", O.some(0), true])
    run(world, { _tag: "ServerTakesRead" })
    run(world, { _tag: "ReadArrives" })
    // Their row is on screen now, counted, and the region was started again from it.
    expect([shown(world.draft), world.draft.heldBack, world.restarts]).toEqual([{ a: out, b: kept }, O.some(1), 1])
    run(world, { _tag: "PressConfirm" })
    expect([sent(world), world.draft.heldBack]).toEqual([O.some([2, { set: {}, clear: [] }]), O.none()])
    run(world, { _tag: "ServerTakesConfirm" })
    expect(world.closed).toEqual(O.some({ a: out, b: kept }))
  })

  it("waits for the save that is out, then carries only the rows not sent yet, with no save beside it", () => {
    const world = opened()
    run(world, { _tag: "Decide", row: "a", to: "out" })
    run(world, { _tag: "Decide", row: "b", to: "kept" })
    run(world, { _tag: "PressConfirm" })
    expect([world.draft.confirm, O.isNone(world.confirm)]).toEqual(["waiting", true])
    run(world, { _tag: "ServerTakesSave" })
    run(world, { _tag: "SaveAnswers" })
    // Row a is saved at revision 2; the confirm names that revision and carries row b alone.
    expect([sent(world), O.isNone(world.save)]).toEqual([O.some([2, { set: { b: kept }, clear: [] }]), true])
    run(world, { _tag: "ServerTakesConfirm" })
    expect(world.closed).toEqual(O.some({ a: out, b: kept }))
    run(world, { _tag: "ConfirmAnswers" })
    expect(world.draft).toEqual({ ...emptyDraft, onScreen: true })
  })

  it("that waits is held back when its save's answer says somebody else saved in between", () => {
    const world = opened()
    run(world, { _tag: "Decide", row: "a", to: "out" })
    run(world, { _tag: "SomeoneElse", row: "b", to: "kept" })
    run(world, { _tag: "PressConfirm" })
    run(world, { _tag: "ServerTakesSave" })
    run(world, { _tag: "SaveAnswers" })
    // Two revisions on from the picture held: no confirm goes, the newer picture is asked for.
    expect([world.draft.confirm, world.draft.heldBack, O.isNone(world.confirm), O.isSome(world.read)]).toEqual([
      "idle",
      O.some(0),
      true,
      true
    ])
    run(world, { _tag: "ServerTakesRead" })
    run(world, { _tag: "ReadArrives" })
    expect([shown(world.draft), world.draft.heldBack]).toEqual([{ a: out, b: kept }, O.some(1)])
  })

  it("that waits is held back by a newer picture that arrives before its save is answered", () => {
    const world = opened()
    run(world, { _tag: "SomeoneElse", row: "b", to: "kept" })
    run(world, { _tag: "ReturnToTab" })
    run(world, { _tag: "ServerTakesRead" })
    run(world, { _tag: "Decide", row: "a", to: "out" })
    run(world, { _tag: "PressConfirm" })
    run(world, { _tag: "ReadArrives" })
    expect([world.draft.confirm, world.draft.heldBack]).toEqual(["idle", O.some(1)])
    run(world, { _tag: "ServerTakesSave" })
    run(world, { _tag: "SaveAnswers" })
    expect(O.isNone(world.confirm)).toBe(true)
  })

  it("carries the clear of a decision the person took back and the server never heard of", () => {
    const world = opened({ a: out })
    run(world, { _tag: "Decide", row: "a", to: "nothing" })
    run(world, { _tag: "SaveFails" })
    run(world, { _tag: "PressConfirm" })
    expect(sent(world)).toEqual(O.some([1, { set: {}, clear: ["a"] }]))
    run(world, { _tag: "ServerTakesConfirm" })
    // Without the clear the import would be confirmed with row a left out, as nobody on this screen saw it.
    expect(world.closed).toEqual(O.some({}))
  })

  it("that did not get through leaves the rows it carried to be saved as any decision", () => {
    const world = opened()
    run(world, { _tag: "Decide", row: "a", to: "out" })
    run(world, { _tag: "SaveFails" })
    run(world, { _tag: "PressConfirm" })
    run(world, { _tag: "ConfirmFails" })
    expect([world.draft.confirm, O.map(world.save, (save) => save.delta)]).toEqual([
      "idle",
      O.some({ set: { a: out }, clear: [] })
    ])
    quiet(world)
    expect(world.server.decisions).toEqual({ a: out })
  })
})

describe("rows that wait, kept in the browser", () => {
  const waitingA = O.some({ rows: { a: O.some(out) }, madeOn: 4, leftOver: false })

  it("come back after a reload over what the server holds, and are sent again as made on the revision they were made on", () => {
    const back = step(emptyDraft, DraftEvent.Opened({ kept: waitingA }))
    // Nothing is sent before the import's picture has arrived: it says whether the import can still be decided.
    expect([back.effects, back.draft.stalled, back.draft.unsent]).toEqual([[], true, { a: O.some(out) }])
    const arrived = step(back.draft, DraftEvent.ViewArrived({ revision: 9, decisions: { b: kept }, open: true }))
    expect(shown(arrived.draft)).toEqual({ a: out, b: kept })
    expect(arrived.effects).toEqual([DraftEffect.Send({ delta: { set: { a: out }, clear: [] }, madeOn: 4 })])
  })

  it("are sent again when a picture arrives after a save that failed, and the failure is said once", () => {
    const world = opened()
    run(world, { _tag: "Decide", row: "a", to: "out" })
    run(world, { _tag: "SaveFails" })
    expect([world.said, world.draft.stalled, O.isNone(world.save)]).toEqual([1, true, true])
    // A save answer nobody waits for says nothing and changes nothing.
    const stray = step(world.draft, DraftEvent.SaveFailed())
    expect([stray.effects, stray.draft]).toEqual([[], world.draft])
    expect(step(world.draft, DraftEvent.SaveRefused({ reason: "No." })).draft).toEqual(world.draft)
    run(world, { _tag: "SomeoneElse", row: "b", to: "kept" })
    run(world, { _tag: "ReturnToTab" })
    run(world, { _tag: "ServerTakesRead" })
    run(world, { _tag: "ReadArrives" })
    expect(O.map(world.save, (save) => save.delta)).toEqual(O.some({ set: { a: out }, clear: [] }))
  })

  it("are named and never sent when somebody else confirms the import, and kept until the result has named them", () => {
    const world = opened()
    run(world, { _tag: "Decide", row: "a", to: "out" })
    run(world, { _tag: "SaveFails" })
    run(world, { _tag: "SomeoneConfirms" })
    run(world, { _tag: "ReturnToTab" })
    run(world, { _tag: "ServerTakesRead" })
    run(world, { _tag: "ReadArrives" })
    expect([world.draft.ended, world.draft.leftOver, O.isNone(world.save)]).toEqual([
      true,
      O.some({ a: O.some(out) }),
      true
    ])
    expect(world.kept).toEqual(O.some({ rows: { a: O.some(out) }, madeOn: 0, leftOver: true }))
    // A reload before the result was left: the rows come back as left over, and are named again, not sent.
    run(world, { _tag: "Reload" })
    run(world, { _tag: "ServerTakesRead" })
    run(world, { _tag: "ReadArrives" })
    expect([world.draft.leftOver, O.isNone(world.save)]).toEqual([O.some({ a: O.some(out) }), true])
    dispatch(world, DraftEvent.LeftOverNamed())
    expect([world.draft.leftOver, world.kept]).toEqual([O.none(), O.none()])
  })

  it("that the confirm already wrote are not named: only what the confirmed import does not say", () => {
    const world = opened({ a: out })
    run(world, { _tag: "Decide", row: "b", to: "kept" })
    run(world, { _tag: "ServerTakesSave" })
    // The server took row b; its answer is lost on the way, and somebody else confirms.
    run(world, { _tag: "SaveFails" })
    run(world, { _tag: "SomeoneConfirms" })
    run(world, { _tag: "ReturnToTab" })
    run(world, { _tag: "ServerTakesRead" })
    run(world, { _tag: "ReadArrives" })
    expect([world.draft.ended, world.draft.leftOver]).toEqual([true, O.none()])
  })
})

describe("a save that names what it was made on", () => {
  const accept = decisionFromFlags({ accepted: ["unitCost"], edits: { name: "Steel Tube 1in" } })
  // The Review step is drawn, and holds revision 5.
  const held = step(
    step(emptyDraft, DraftEvent.Opened({ kept: O.none() })).draft,
    DraftEvent.ViewArrived({ revision: 5, decisions: {}, open: true })
  ).draft

  it("names the revision the earliest waiting row was decided on, whatever was read since", () => {
    const first = step(held, DraftEvent.Decided({ changes: { a: O.some(out) } }))
    expect(first.effects).toEqual([DraftEffect.Send({ delta: { set: { a: out }, clear: [] }, madeOn: 5 })])
    // The save fails; a newer picture arrives (somebody matched a column): the row is sent again as made on 5.
    const failed = step(first.draft, DraftEvent.SaveFailed()).draft
    const newer = step(failed, DraftEvent.ViewArrived({ revision: 8, decisions: {}, open: true }))
    expect(newer.effects).toEqual([DraftEffect.Send({ delta: { set: { a: out }, clear: [] }, madeOn: 5 })])
  })

  it("takes out the accepts the server did not apply, keeps the rest of the row, and says which", () => {
    const sent = step(held, DraftEvent.Decided({ changes: { a: O.some(accept) } })).draft
    const stale = [{ rowId: "a", field: "unitCost" }]
    const answered = step(sent, DraftEvent.SaveAnswered({ revision: 6, changed: true, notApplied: stale }))
    const saved = decisionFromFlags({ edits: { name: "Steel Tube 1in" } })
    expect(shown(answered.draft)).toEqual({ a: saved })
    expect(answered.effects).toEqual([
      DraftEffect.Put({ revision: 6, decisions: { a: saved } }),
      DraftEffect.Say({ what: Said.AcceptsTakenBack({ accepts: stale }) }),
      // The region is drawn again from the row as it was saved, and not told of "another screen".
      DraftEffect.Restart({ announce: false })
    ])
  })

  it("asks which items are already there only once the server has the SKU that was typed", () => {
    const sku = decisionFromFlags({ edits: { sku: "X-1" } })
    const first = step(held, DraftEvent.Decided({ changes: { a: O.some(out) } })).draft
    // Typed while the first save is out: it waits behind it.
    const typed = step(first, DraftEvent.Decided({ changes: { b: O.some(sku) } })).draft
    const one = step(typed, DraftEvent.SaveAnswered({ revision: 6, changed: true, notApplied: [] }))
    // The first save's answer sends the SKU, and asks nothing yet: the server does not have it.
    expect(A.map(one.effects, (effect) => effect._tag)).toEqual(["Put", "Send"])
    const two = step(one.draft, DraftEvent.SaveAnswered({ revision: 7, changed: true, notApplied: [] }))
    expect(A.map(two.effects, (effect) => effect._tag)).toEqual(["Put", "Ask"])
  })
})
