// The browser's seam to the API as atoms, with no contract in it. One runtime for every web package: the app gives it
// its layer once, at the root (`provideApi`), and each package makes its query and write atoms against the client tag it
// declares (`makeApiAtoms`), so a screen reads `useAtomValue(people)` and never runs an Effect itself. The rules this
// file protects: a failure stays typed (a refusal is the endpoint's own error, never a defect); a read is asked again
// once, and a write twice, only for a failure that may pass, never for a refusal; an answer equal to the one held keeps
// the object held, so nothing derived from it is rebuilt; a read belongs to the member who asked, so another member or
// another organization starts from nothing instead of seeing the last one's answer.
import * as A from "effect/Array"
import type * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Eq from "effect/Equal"
import * as Fiber from "effect/Fiber"
import { dual } from "effect/Function"
import * as Layer from "effect/Layer"
import * as MutableHashMap from "effect/MutableHashMap"
import * as O from "effect/Option"
import * as Schedule from "effect/Schedule"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import * as Atom from "effect/reactivity/Atom"
import type * as AtomRegistry from "effect/reactivity/AtomRegistry"
import * as Reactivity from "effect/reactivity/Reactivity"
import { memberKey } from "@inventory/client/MemberAtoms"
import { isTransient } from "@inventory/client/SayError"

/**
 * How long an answer nobody is looking at is kept. A screen opened again within it shows that answer at once, marked
 * waiting, and asks again behind it (Benjamin: "Old rows at once, refreshed behind"); after it, the screen starts from
 * its skeleton. Five minutes, TanStack Query's own keep. A sign-out lets every one go at once (`forgetReads`).
 */
export const keepUnwatched = 5 * 60_000

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

/**
 * The tab's one record of what changed: a write names its keys here and every read that shows one of them asks again.
 * One instance for the tab, not one per registry, so code that is not an atom yet (the catalog screens on TanStack
 * Query, through `@inventory/client/QueryClient`) can say what it changed with `invalidate`.
 */
const reactivity: Reactivity.Reactivity = Effect.runSync(Reactivity.make)

/** Says that what `keys` name has changed: every read registered under one of them asks again. */
export const invalidate = (keys: Reactivity.KeysInput): void => reactivity.invalidateUnsafe(keys)

/** A read that asks again whenever one of `keys` is invalidated (Effect's `withReactivity`, on the tab's instance). */
const followKeys =
  (keys: Reactivity.KeysInput) =>
  <A>(atom: Atom.Atom<A>): Atom.Atom<A> =>
    Atom.transform(
      atom,
      (get) => {
        get.addFinalizer(reactivity.registerUnsafe(keys, () => get.refresh(atom)))
        get.subscribe(atom, (value) => get.setSelf(value))
        return get.once(atom)
      },
      { initialValueTarget: atom }
    )

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

/** One member's read: the answer itself (`held`, which is what is kept) and what a screen reads (`read`). */
interface PerMember<A, E> {
  readonly held: Atom.Atom<AsyncResult.AsyncResult<A, E>>
  readonly read: Atom.Atom<AsyncResult.AsyncResult<A, E>>
}

/** A hold on a read nobody looks at, and how to let it go before its time. */
interface Keep {
  readonly letGo: () => void
}

/**
 * Holds `held` in `registry` for `keepUnwatched`, then lets it go and calls `done`. Letting go early stops the timer.
 * Once nothing holds a read, the registry lets it go after its own idle time (400 ms in the app).
 */
const keepFor = (registry: AtomRegistry.AtomRegistry, held: Atom.Atom<unknown>, done: () => void): Keep => {
  const release = registry.mount(held)
  const timer = Effect.runFork(
    Effect.sleep(keepUnwatched).pipe(
      Effect.andThen(
        Effect.sync(() => {
          release()
          done()
        })
      )
    )
  )
  return {
    letGo: () => {
      Effect.runFork(timer.pipe(Fiber.interrupt))
      release()
    }
  }
}

/** Every query's held reads, so a sign-out can let them all go at once. */
const heldByQueries: Array<{ readonly forget: () => void; readonly members: () => ReadonlyArray<string> }> = []

/**
 * Lets go of every read held for anyone, at once: on sign-out the previous person's rows leave memory (Benjamin:
 * "Keyed reads, and drop them on sign-out"), and whoever signs in next starts from the skeleton. A switch of
 * organization does not call this: the person's reads for the organization they left are kept for `keepUnwatched`.
 */
export const forgetReads = (): void => {
  for (const query of heldByQueries) query.forget()
}

/** The members some read is held for, across every query: for the tests that hold `forgetReads` to its word. */
export const heldReadMembers = (): ReadonlyArray<string> => A.flatMap(heldByQueries, (query) => query.members())

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
    // One read per member: when the person or the organization changes, the screen shows its skeleton, never the
    // previous organization's rows marked as waiting. Held with ordinary references, not `Atom.family`'s weak ones: a
    // collected one would be made anew on a return, empty (measured: after 35 s away).
    const reads = MutableHashMap.empty<string, PerMember<A, E>>()
    const make = (): PerMember<A, E> => {
      const held = apiRuntime.atom((get) =>
        Effect.flatMap(client, (c) => use(c, get)).pipe(
          Effect.retry(readRetry),
          Effect.map((answer) => keepWhenEqual(heldSuccess(get.self<AsyncResult.AsyncResult<A, E>>()), answer))
        )
      )
      // Every return to a screen asks again behind the answer it shows: `held` outlives the screen by
      // `keepUnwatched` (kept below), this wrapper does not, so a screen that mounts it again starts a new look. An
      // answer under a second old counts as fresh, or a read answered before its first look would be asked twice.
      const fresh = Atom.swr(held, { staleTime: "1 second" })
      return {
        held,
        read: options?.reactivityKeys === undefined ? fresh : fresh.pipe(followKeys(options.reactivityKeys))
      }
    }
    const forMember = (member: string): PerMember<A, E> =>
      O.getOrElse(MutableHashMap.get(reads, member), () => {
        const made = make()
        MutableHashMap.set(reads, member, made)
        return made
      })
    // The reads nobody looks at, each kept by a hold this module has on it for `keepUnwatched`.
    const kept = MutableHashMap.empty<string, Keep>()
    const stopKeeping = (member: string): void =>
      O.match(MutableHashMap.get(kept, member), {
        onNone: () => {},
        onSome: (keep) => {
          MutableHashMap.remove(kept, member)
          keep.letGo()
        }
      })
    const startKeeping = (registry: AtomRegistry.AtomRegistry, member: string, held: Atom.Atom<unknown>): void => {
      stopKeeping(member)
      MutableHashMap.set(
        kept,
        member,
        keepFor(registry, held, () => MutableHashMap.remove(kept, member))
      )
    }
    heldByQueries.push({
      forget: () => {
        MutableHashMap.forEach(kept, (keep) => keep.letGo())
        MutableHashMap.clear(kept)
        MutableHashMap.clear(reads)
      },
      members: () => reads.pipe(MutableHashMap.keys, A.fromIterable)
    })
    // The member it last read for, so a refresh of this atom (an optimistic write's, when the last one has answered)
    // reaches the read it shows. One registry holds it in the app; a test that makes several shares the key "".
    let shown = ""
    return Atom.readable(
      (get) => {
        const member = get(memberKey)
        shown = member
        const { held, read } = forMember(member)
        // Shown again: the screen holds it now. When it is let go (the screen left, or another member), it is kept.
        stopKeeping(member)
        get.addFinalizer(() => startKeeping(get.registry, member, held))
        get.subscribe(read, (value) => get.setSelf(value))
        return get.once(read)
      },
      (refresh) => refresh(forMember(shown).read)
    )
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
      apiRuntime.fn<Input>()(
        (input) => {
          const keys = options?.reactivityKeys
          const sent = send((c) => use(c, input))
          return keys === undefined ? sent : Effect.tap(sent, () => Effect.sync(() => invalidate(keys)))
        },
        { concurrent: true }
      )
  return { query, write, send }
}
