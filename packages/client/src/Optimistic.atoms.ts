// Optimistic writes as atoms, one way for all of them. The rules this file protects: the screen changes the moment the
// person acts; the request goes once per press (retried only for a failure that may pass, with the press's own key, so
// a repeat is the same write); a second press never interrupts the first; a refused change is taken back the moment
// it is refused, beside the sentence that says why, while any other change still on its way keeps showing; when the
// last write in flight has answered, what they changed is read again once, so the screen ends at the server's word.
// A write whose outcome only the server knows (lines it checks one by one, a take-back, a model's answer) is not
// written here: it shows its progress instead.
//
// Not `Atom.optimistic`: measured with two writes in flight (goals/atoms/PLAN.md), it keeps a refused change on screen
// until the last write has answered, and Benjamin chose "Take it back at once" (explorations/ideal-architecture/
// DECISIONS.md, "atoms, a refused edit beside another in flight"). Here the screen shows the read's own value with each
// change still on its way applied on top, in the order they were made; a refused one leaves that list at once.
import * as A from "effect/Array"
import * as Cause from "effect/Cause"
import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import { dual } from "effect/Function"
import * as O from "effect/Option"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import * as Atom from "effect/reactivity/Atom"
import * as AtomRegistry from "effect/reactivity/AtomRegistry"
import type * as Reactivity from "effect/reactivity/Reactivity"
import { apiRuntime, invalidate } from "@inventory/client/Api"
import { toastError } from "@inventory/client/SayError"

/** One change on its way to the server, as it shows on a read: which press made it, and what it does to the value. */
interface Pending<S> {
  readonly press: number
  readonly apply: (value: S) => S
}

/**
 * A read the screen shows through optimistic writes: the read's own value with every change still on its way applied
 * on top, marked waiting while there is one. Screens read this atom; a refresh of it asks the read again.
 */
export interface Shown<S, E> extends Atom.Atom<AsyncResult.AsyncResult<S, E>> {
  /** The read underneath, which a write reads again once its last change has been answered. */
  readonly source: Atom.Atom<AsyncResult.AsyncResult<S, E>>
  /** The changes on their way, oldest first. */
  readonly pending: Atom.Writable<ReadonlyArray<Pending<S>>>
}

/** Wraps a read so optimistic writes can show their changes on it. */
export const shown = <S, E>(read: Atom.Atom<AsyncResult.AsyncResult<S, E>>): Shown<S, E> => {
  const pending = Atom.make<ReadonlyArray<Pending<S>>>([]).pipe(Atom.keepAlive)
  const atom = Atom.readable(
    (get) => {
      const changes = get(pending)
      const value = get(read)
      if (changes.length === 0) return value
      return value.pipe(
        AsyncResult.map((held) => A.reduce(changes, held, (now, change) => change.apply(now))),
        AsyncResult.waiting
      )
    },
    (refresh) => refresh(read)
  )
  return Object.assign(atom, { source: read, pending })
}

/** What one write does to one shown read before the server answers. */
export interface OptimisticChange<Input> {
  /** Puts this press's change on its read. */
  readonly put: (registry: AtomRegistry.AtomRegistry, press: number, input: Input) => void
  /** Takes the changes of these presses off its read. */
  readonly takeOff: (registry: AtomRegistry.AtomRegistry, presses: ReadonlyArray<number>) => void
  /** The read underneath, read again once the last write has answered. */
  readonly source: Atom.Atom<AsyncResult.AsyncResult<unknown, unknown>>
}

/** One shown read and how a write changes it at once. */
export const optimisticChange: {
  <S, Input>(apply: (value: S, input: Input) => S): <E>(target: Shown<S, E>) => OptimisticChange<Input>
  <S, E, Input>(target: Shown<S, E>, apply: (value: S, input: Input) => S): OptimisticChange<Input>
} = dual(2, <S, E, Input>(target: Shown<S, E>, apply: (value: S, input: Input) => S): OptimisticChange<Input> => ({
  put: (registry, press, input) =>
    registry.update(target.pending, A.append({ press, apply: (value: S) => apply(value, input) })),
  takeOff: (registry, presses) =>
    registry.update(
      target.pending,
      A.filter((change) => !presses.includes(change.press))
    ),
  source: target.source
}))

/**
 * What one optimistic write is. `send` is the request, from the package's `send` (it carries the write retries, and
 * requires the client's tag, which `apiRuntime` provides); `changes` say what the screen shows at once; `failed` is
 * the sentence put before the reason when the server refuses ("Your line was not recorded."); `retry` offers the
 * person's own input again instead of making them repeat it; `settled` names what else to read again once the last
 * write of this kind has answered; `onRefused` handles a refusal the screen says in its own place (it returns true,
 * and no toast is shown).
 */
export interface OptimisticWrite<Input, A, E, R> {
  readonly send: (input: Input) => Effect.Effect<A, E, R>
  readonly changes: ReadonlyArray<OptimisticChange<Input>>
  readonly failed: (input: Input) => string
  readonly retry?: (input: Input) => { readonly label: string; readonly onClick: () => void } | undefined
  readonly settled?: Reactivity.KeysInput
  readonly onAnswer?: (answer: A, input: Input) => void
  readonly onRefused?: (error: E, input: Input) => boolean
}

/** Numbers each press of every write, so a change can be found again on the read it was put on. */
const pressCount = Atom.make(0).pipe(Atom.keepAlive)

/** Reads one changed read again and waits until it has answered; a failure to read is the read's own to show. */
const readAgain = (
  registry: AtomRegistry.AtomRegistry,
  read: Atom.Atom<AsyncResult.AsyncResult<unknown, unknown>>
): Effect.Effect<void> =>
  Effect.callback<void>((resume) => {
    registry.refresh(read)
    let answered = false
    let stop: (() => void) | undefined
    stop = registry.subscribe(
      read,
      (result) => {
        if (result.waiting || answered) return
        answered = true
        stop?.()
        resume(Effect.void)
      },
      { immediate: true }
    )
    // Answered before the subscription was returned (a read already held): let it go now.
    if (answered) stop()
    return Effect.sync(() => stop?.())
  })

/**
 * One optimistic write as an atom: set it to the input. Its value is the latest press's result; every press runs to
 * its end on its own.
 */
export const optimisticWrite = <Input, A, E, R>(
  spec: OptimisticWrite<Input, A, E, R>
): Atom.AtomResultFn<Input, A, E> => {
  // The presses of this write on their way, and those already saved, in the registry: a new registry starts empty.
  const inFlight = Atom.make(0).pipe(Atom.keepAlive)
  const saved = Atom.make<ReadonlyArray<number>>([]).pipe(Atom.keepAlive)
  return apiRuntime.fn<Input>()(
    Effect.fnUntraced(function* (input: Input) {
      const registry = yield* AtomRegistry.AtomRegistry
      registry.update(pressCount, (n) => n + 1)
      const press = registry.get(pressCount)
      registry.update(inFlight, (n) => n + 1)
      for (const change of spec.changes) change.put(registry, press, input)
      const exit = yield* Effect.exit(spec.send(input))
      registry.update(inFlight, (n) => n - 1)
      if (Exit.isSuccess(exit)) {
        registry.update(saved, A.append(press))
        spec.onAnswer?.(exit.value, input)
      } else {
        // Taken back at once: the other changes still on their way keep showing.
        for (const change of spec.changes) change.takeOff(registry, [press])
        const error = Cause.findErrorOption(exit.cause)
        if (!(O.isSome(error) && spec.onRefused?.(error.value, input) === true)) {
          const retry = spec.retry?.(input)
          toastError(
            O.getOrElse(error, () => Cause.squash(exit.cause)),
            {
              lead: spec.failed(input),
              ...(retry === undefined ? {} : { action: retry })
            }
          )
        }
      }
      if (registry.get(inFlight) === 0) {
        // The last write has answered: read what they changed again once, then drop the saved changes, which the
        // fresh read now holds.
        const done = registry.get(saved)
        registry.set(saved, [])
        if (done.length > 0) {
          yield* Effect.forEach(spec.changes, (change) => readAgain(registry, change.source), {
            concurrency: "unbounded",
            discard: true
          })
          for (const change of spec.changes) change.takeOff(registry, done)
        }
        if (spec.settled !== undefined) invalidate(spec.settled)
      }
      return yield* exit
    }),
    { concurrent: true }
  )
}
