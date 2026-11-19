// The browser's seam to the API as atoms, with no contract in it. One runtime for every web package: the app gives it
// its layer once, at the root (`provideApi`), and each package makes its query and write atoms against the client tag it
// declares (`makeApiAtoms`), so a screen reads `useAtomValue(people)` and never runs an Effect itself. The rules this
// file protects: a failure stays typed (a refusal is the endpoint's own error, never a defect); a read is asked again
// once, and a write twice, only for a failure that may pass, never for a refusal; an answer equal to the one held keeps
// the object held, so nothing derived from it is rebuilt.
import type * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Eq from "effect/Equal"
import { dual } from "effect/Function"
import * as Layer from "effect/Layer"
import * as O from "effect/Option"
import * as Schedule from "effect/Schedule"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import * as Atom from "effect/reactivity/Atom"
import type * as Reactivity from "effect/reactivity/Reactivity"
import { isTransient } from "@inventory/client/SayError"

/** How long an answer nobody is looking at is kept: a screen opened again within it shows it without asking again. */
export const freshFor = 30_000

/**
 * The app's one runtime, for the screens of every web package. Its layer is the app's to give (`provideApi`); until it
 * does, every API atom fails with a defect naming the omission, which no screen should ever show.
 */
export const apiRuntime: Atom.AtomRuntime<unknown> = Effect.die(
  "The app did not provide the API's layer to the atom registry (provideApi)."
).pipe(Layer.effectContext, Atom.runtime)

/**
 * The initial value that gives the runtime its layer, for `RegistryProvider`'s `initialValues` (or a test's registry).
 * The app passes the layer that provides the client tag of every web package it mounts; that is its promise, as with
 * the tag each package declares, and it is not checked here.
 */
export const provideApi = <R>(layer: Layer.Layer<R>): readonly [Atom.Atom<unknown>, unknown] =>
  // The runtime holds the layer as one that provides anything: what it provides is the app's promise (above).
  Atom.initialValue(apiRuntime.layer, layer as Layer.Layer<never> as Layer.Layer<unknown>)

/** A read is asked again once for a failure that may pass (the network, a server error), never for a refusal. */
const readRetry = { times: 1, while: isTransient } as const

/** A write is sent again twice at most, waiting longer each time, only for a failure that may pass. */
const writeRetry = {
  schedule: Schedule.exponential("400 millis").pipe(Schedule.jittered),
  times: 2,
  while: isTransient
} as const

/** The answer held when the new one says the same thing, Effect values included; otherwise the new one. */
export const keepWhenEqual: {
  <A>(answered: A): (held: O.Option<A>) => A
  <A>(held: O.Option<A>, answered: A): A
} = dual(2, <A>(held: O.Option<A>, answered: A): A =>
  O.isSome(held) && Eq.equals(held.value, answered) ? held.value : answered
)

const heldSuccess = <A, E>(previous: O.Option<AsyncResult.AsyncResult<A, E>>): O.Option<A> =>
  O.flatMap(previous, AsyncResult.value)

/** The atoms one web package makes against its client. */
export interface ApiAtoms<Id, Client> {
  /**
   * A read: its value is the answer as an `AsyncResult` with the endpoint's own failures. `reactivityKeys` names what
   * it shows, so a write that names one of them reads it again. A read whose arguments come from another atom reads
   * them with `get`: when they change it asks again and keeps the previous answer, marked waiting, until the new one
   * comes (the Items table's paging).
   */
  readonly query: <A, E>(
    use: (client: Client, get: Atom.AtomContext) => Effect.Effect<A, E>,
    options?: { readonly reactivityKeys?: Reactivity.KeysInput }
  ) => Atom.Atom<AsyncResult.AsyncResult<A, E>>
  /**
   * A write, made by setting the atom to its input. Every press runs on its own (a second press does not interrupt
   * the first); when it succeeds the reads under `reactivityKeys` are asked again.
   */
  readonly write: <Input>() => <A, E>(
    use: (client: Client, input: Input) => Effect.Effect<A, E>,
    options?: { readonly reactivityKeys?: Reactivity.KeysInput }
  ) => Atom.AtomResultFn<Input, A, E>
  /**
   * One program against the API with the write retries, to run on `apiRuntime`: for a write built of several steps
   * (the optimistic write). It requires the client's tag, which the runtime provides.
   */
  readonly send: <A, E>(use: (client: Client) => Effect.Effect<A, E>) => Effect.Effect<A, E, Id>
}

/**
 * The query and write atoms for one client tag, run on `apiRuntime`. A web package calls it once, at module level,
 * with the tag the app's layer provides.
 */
export const makeApiAtoms = <Id, Client>(tag: Context.Key<Id, Client>): ApiAtoms<Id, Client> => {
  const client = Effect.service(tag)
  function query<A, E>(
    use: (client: Client, get: Atom.AtomContext) => Effect.Effect<A, E>,
    options?: { readonly reactivityKeys?: Reactivity.KeysInput }
  ): Atom.Atom<AsyncResult.AsyncResult<A, E>> {
    const read = Atom.setIdleTTL(
      apiRuntime.atom((get) =>
        Effect.flatMap(client, (c) => use(c, get)).pipe(
          Effect.retry(readRetry),
          Effect.map((answer) => keepWhenEqual(heldSuccess(get.self<AsyncResult.AsyncResult<A, E>>()), answer))
        )
      ),
      freshFor
    )
    return options?.reactivityKeys === undefined
      ? read
      : read.pipe(apiRuntime.factory.withReactivity(options.reactivityKeys))
  }
  function send<A, E>(use: (client: Client) => Effect.Effect<A, E>): Effect.Effect<A, E, Id> {
    return Effect.flatMap(client, use).pipe(Effect.retry(writeRetry))
  }
  const write =
    <Input>() =>
    <A, E>(
      use: (client: Client, input: Input) => Effect.Effect<A, E>,
      options?: { readonly reactivityKeys?: Reactivity.KeysInput }
    ): Atom.AtomResultFn<Input, A, E> =>
      apiRuntime.fn<Input>()((input) => send((c) => use(c, input)), {
        concurrent: true,
        ...(options?.reactivityKeys === undefined ? {} : { reactivityKeys: options.reactivityKeys })
      })
  return { query, write, send }
}
