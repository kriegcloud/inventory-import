// Optimistic writes as atoms, one way for all of them. The rules this file protects: the screen changes the moment the
// person acts; the request goes once per press (retried only for a failure that may pass, with the press's own key, so
// a repeat is the same write); a second press never interrupts the first; when the last write in flight has answered,
// what it changed is read again once, so the screen ends at the server's word; a failure is said in a sentence with
// what to do. A write whose outcome only the server knows (lines it checks one by one, a take-back, a model's answer) is
// not written here: it shows its progress instead.
//
// Built on `Atom.optimistic` and `Atom.optimisticFn`, measured with two writes in flight before this was written
// (goals/atoms/PLAN.md): every press makes its own chain of `optimisticFn`s, one per atom it changes, because one chain
// shared by every press either interrupts the first write or, when the first fails while the second is on its way,
// puts the screen back to before both and never reads again.
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import { dual } from "effect/Function"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import * as Atom from "effect/reactivity/Atom"
import * as AtomRegistry from "effect/reactivity/AtomRegistry"
import type * as Reactivity from "effect/reactivity/Reactivity"
import { apiRuntime, invalidate } from "@inventory/client/Api"
import { toastError } from "@inventory/client/SayError"

/**
 * A read the screen shows through optimistic writes: the read's own value, with each write's change on top while it
 * is on its way. Screens read this atom; writes name it in `optimisticChange`.
 */
export type Shown<S, E> = Atom.Writable<
  AsyncResult.AsyncResult<S, E>,
  Atom.Atom<AsyncResult.AsyncResult<AsyncResult.AsyncResult<S, E>, unknown>>
>

/** Wraps a read so optimistic writes can show their change on it (`Atom.optimistic`). */
export const shown = <S, E>(read: Atom.Atom<AsyncResult.AsyncResult<S, E>>): Shown<S, E> => Atom.optimistic(read)

/** What one write does to one shown read before the server answers: wraps the press's write in its change. */
export type OptimisticChange<Input> = <X, XE>(write: Atom.AtomResultFn<Input, X, XE>) => Atom.AtomResultFn<Input, X, XE>

/**
 * One shown read and how a write changes it at once. Nothing is written to take the change back: a failure puts the
 * read's own value back once no write on it is in flight, and a success reads it again.
 */
export const optimisticChange: {
  <S, Input>(apply: (value: S, input: Input) => S): <E>(target: Shown<S, E>) => OptimisticChange<Input>
  <S, E, Input>(target: Shown<S, E>, apply: (value: S, input: Input) => S): OptimisticChange<Input>
} = dual(
  2,
  <S, E, Input>(target: Shown<S, E>, apply: (value: S, input: Input) => S): OptimisticChange<Input> =>
    (write) =>
      Atom.optimisticFn(target, {
        reducer: (current, input: Input) => AsyncResult.map(current, (value) => apply(value, input)),
        fn: write
      })
)

/**
 * What one optimistic write is. `send` is the request, from the package's `send` (it carries the write retries, and
 * requires the client's tag, which `apiRuntime` provides);
 * `changes` say what the screen shows at once; `failed` is the sentence put before the reason when the server refuses
 * ("Your line was not recorded."); `retry` offers the person's own input again instead of making them repeat it;
 * `settled` names what else to read again once the last write of this kind has answered; `onRefused` handles a
 * refusal the screen says in its own place (it returns true, and no toast is shown).
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

/**
 * One optimistic write as an atom: set it to the input. Its value is the latest press's result; every press runs to
 * its end on its own.
 */
export const optimisticWrite = <Input, A, E, R>(
  spec: OptimisticWrite<Input, A, E, R>
): Atom.AtomResultFn<Input, A, E> => {
  // How many writes of this kind are on their way, in the registry, so a new registry (another person) starts at 0.
  const inFlight = Atom.keepAlive(Atom.make(0))
  return apiRuntime.fn<Input>()(
    Effect.fnUntraced(function* (input: Input) {
      const registry = yield* AtomRegistry.AtomRegistry
      registry.update(inFlight, (n) => n + 1)
      const request = apiRuntime.fn<Input>()(spec.send)
      const press = A.reduce(spec.changes, request, (write, change) => change(write))
      yield* Atom.mount(press)
      registry.set(press, input)
      const answer = yield* Atom.getResult(press, { suspendOnWaiting: true }).pipe(
        Effect.tapError((error) =>
          Effect.sync(() => {
            if (spec.onRefused?.(error, input) === true) return
            const retry = spec.retry?.(input)
            toastError(error, { lead: spec.failed(input), ...(retry === undefined ? {} : { action: retry }) })
          })
        ),
        Effect.ensuring(
          Effect.sync(() => {
            registry.update(inFlight, (n) => n - 1)
            if (registry.get(inFlight) === 0 && spec.settled !== undefined) invalidate(spec.settled)
          })
        )
      )
      spec.onAnswer?.(answer, input)
      return answer
    }, Effect.scoped),
    { concurrent: true }
  )
}
