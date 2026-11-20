// The browser's seam to the API as atoms, with no contract in it. One runtime for every web package: the app gives it
// its layer once, at the root (`provideApi`), and each package makes its query and write atoms against the client tag it
// declares (`makeApiAtoms`), so a screen reads `useAtomValue(people)` and never runs an Effect itself. The rules this
// file protects: a failure stays typed (a refusal is the endpoint's own error, never a defect); a read is asked again
// once, and a write twice, only for a failure that may pass, never for a refusal; an answer equal to the one held keeps
// the object held, so nothing derived from it is rebuilt; a read belongs to the member who asked, so another member or
// another organization starts from nothing instead of seeing the last one's answer.
import * as A from "effect/Array"
import * as DateTime from "effect/DateTime"
import * as Duration from "effect/Duration"
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
 * its skeleton. Five minutes. A sign-out lets every one go at once (`forgetReads`).
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
 * One instance for the tab, not one per registry, so code that is not an atom (an upload when it lands, a confirm or a
 * take-back once the server has answered) can say what it changed with `invalidate`.
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

/** An answer a screen gave a read, and when: one given a while before it is first shown is asked again behind it. */
interface Given<A> {
  readonly answer: A
  readonly at: DateTime.Utc
}

/**
 * How old an answer may be and still count as the server's word: under a second. A read answered before its first
 * look would otherwise be asked twice; anything older is shown at once and asked again behind it.
 */
const freshEnough = Duration.seconds(1)

/**
 * One member's read: the answer itself (`held`, which is what is kept), what a screen reads (`read`), and how a
 * screen puts an answer in place of a request (`give`, which answers the atom to nudge so a read on screen takes it).
 * The given answer is a plain value the read takes once. One that is taken is not kept past the read; one given to a
 * read nobody opens stays until the read is let go or the person signs out.
 */
interface PerMember<A, E> {
  readonly held: Atom.Atom<AsyncResult.AsyncResult<A, E>>
  readonly read: Atom.Atom<AsyncResult.AsyncResult<A, E>>
  readonly give: (answer: A) => Atom.Writable<number>
  /** An answer given that the read has not taken yet. */
  readonly waiting: () => O.Option<A>
}

/** How long a read nobody looks at is kept: `keepUnwatched`, or the page's life for an answer that never changes. */
export type Keeping = "unwatched" | "page"

/** A hold on a read nobody looks at, and how to let it go before its time. */
interface Keep {
  readonly letGo: () => void
}

/**
 * Holds `held` in `registry` for `keepUnwatched`, then lets it go and calls `done`. Letting go early stops the timer.
 * Once nothing holds a read, the registry lets it go after its own idle time (400 ms in the app).
 */
const keepFor = (
  registry: AtomRegistry.AtomRegistry,
  held: Atom.Atom<unknown>,
  keeping: Keeping,
  done: () => void
): Keep => {
  const release = registry.mount(held)
  const timer = Effect.runFork(
    Effect.sleep(keeping === "page" ? Duration.infinity : keepUnwatched).pipe(
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

/** How a read behaves beyond its request. */
export interface QueryOptions {
  /** What it shows, so a write that names one of these keys reads it again. */
  readonly reactivityKeys?: Reactivity.KeysInput
  /**
   * "page": the answer never changes once given (a staged file's rows), so it is kept for the page's life and not
   * asked again on a return. Otherwise kept for `keepUnwatched` and asked again behind it on every return.
   */
  readonly keep?: Keeping
}

/**
 * A read. Its value is the answer as an `AsyncResult`; setting it to an answer puts that answer in place without a
 * request (a staged file's view, a draft's new revision), until the read is asked again.
 */
export interface Query<A, E> extends Atom.Writable<AsyncResult.AsyncResult<A, E>, A> {
  /**
   * Lets go of what this read holds for whoever is signed in: its answer, the hold that keeps it while nobody looks,
   * and an answer a screen gave it. For something that is gone on the server (a removed import): nothing of it stays
   * in the tab, and the next look asks the server. A screen that still shows the read asks at once, and learns what
   * the server says now.
   */
  readonly letGo: (registry: AtomRegistry.AtomRegistry) => void
  /**
   * The answer the tab holds for whoever is signed in, or none, without asking the server: looking at a read with the
   * registry starts a request when nothing is held. For code that puts an answer in place only if it is not older
   * than the one held.
   */
  readonly peek: (registry: AtomRegistry.AtomRegistry) => O.Option<A>
}

/**
 * Only a read's answer: undefined until there is one, and the same object for as long as the server answers the same.
 * What is built from a read's data (a table's columns, a review of every row) is built from this, never from the read
 * itself: the read's `AsyncResult` is a new object every time it is asked again (waiting, then answered), and
 * everything built on it would be built again, twice per refresh, for an answer that did not change.
 *
 * Made once, beside the read, not inside another atom's read (each call makes a new atom).
 *
 * @example const facetValues = answerOf(itemFacets) // then: Atom.readable((get) => buildColumns(get(facetValues)))
 */
export const answerOf = <A, E>(read: Atom.Atom<AsyncResult.AsyncResult<A, E>>): Atom.Atom<A | undefined> =>
  Atom.readable((get) => get(read).pipe(AsyncResult.value, O.getOrUndefined))

/**
 * One atom per key, made on first use and held with an ordinary reference (`Atom.family` holds them weakly, and a
 * read made anew after a garbage collection starts empty). For reads per import: a tab opens a handful.
 */
export const perKey = <K, A>(make: (key: K) => A): ((key: K) => A) => {
  const made = MutableHashMap.empty<K, A>()
  return (key) =>
    O.getOrElse(MutableHashMap.get(made, key), () => {
      const atom = make(key)
      MutableHashMap.set(made, key, atom)
      return atom
    })
}

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
    options?: QueryOptions
  ) => Query<A, E>
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
  /**
   * One program against the API, sent once and never again: for a write that names nothing a retry could match (a
   * confirm, a take-back), where a second send after a lost answer would be refused as already done.
   */
  readonly ask: <A, E>(use: (client: Client) => Effect.Effect<A, E>) => Effect.Effect<A, E, Id>
}

/**
 * The query and write atoms for one client tag, run on `apiRuntime`. A web package calls it once, at module level,
 * with the tag the app's layer provides.
 */
export const makeApiAtoms = <Id, Client>(tag: Context.Key<Id, Client>): ApiAtoms<Id, Client> => {
  const client = Effect.service(tag)
  function query<A, E>(
    use: (client: Client, get: Atom.AtomContext) => Effect.Effect<A, E>,
    options?: QueryOptions
  ): Query<A, E> {
    const keeping = options?.keep ?? "unwatched"
    // One read per member: when the person or the organization changes, the screen shows its skeleton, never the
    // previous organization's rows marked as waiting. Held with ordinary references, not `Atom.family`'s weak ones: a
    // collected one would be made anew on a return, empty (measured: after 35 s away).
    const reads = MutableHashMap.empty<string, PerMember<A, E>>()
    const make = (): PerMember<A, E> => {
      // An answer a screen gave, until the read takes it; `nudge` only tells a read on screen that there is one.
      let given: O.Option<Given<A>> = O.none()
      const nudge = Atom.make(0)
      const held: Atom.Atom<AsyncResult.AsyncResult<A, E>> = apiRuntime.atom((get) => {
        get(nudge)
        const taken = given
        given = O.none()
        if (O.isSome(taken)) {
          // The answer once: a later refresh asks the server. Given a while ago (an upload that landed while the
          // person was elsewhere), it is shown at once and asked again behind, as any answer of that age is.
          //
          // And never at the cost of a request that was out: taking the answer ends that request, whose answer may
          // have been newer than the one given (a re-read asked for after a save, cut off by the next save's
          // answer). So the server is asked again behind the answer shown.
          const age = DateTime.distance(taken.value.at, DateTime.nowUnsafe())
          const wasAsking = O.exists(get.self<AsyncResult.AsyncResult<A, E>>(), (before) => before.waiting)
          if (keeping !== "page" && (wasAsking || Duration.isGreaterThan(age, freshEnough))) {
            const registry = get.registry
            Effect.runFork(Effect.sync(() => registry.refresh(held)).pipe(Effect.delay(Duration.zero)))
          }
          return Effect.succeed(taken.value.answer)
        }
        return Effect.flatMap(client, (c) => use(c, get)).pipe(
          Effect.retry(readRetry),
          Effect.map((answer) => keepWhenEqual(heldSuccess(get.self<AsyncResult.AsyncResult<A, E>>()), answer))
        )
      })
      // Every return to a screen asks again behind the answer it shows: `held` outlives the screen by
      // `keepUnwatched` (kept below), this wrapper does not, so a screen that mounts it again starts a new look. An
      // answer under a second old counts as fresh, or a read answered before its first look would be asked twice. An
      // answer kept for the page is never asked again.
      const fresh = keeping === "page" ? held : Atom.swr(held, { staleTime: freshEnough })
      return {
        held,
        give: (answer) => {
          given = O.some({ answer, at: DateTime.nowUnsafe() })
          return nudge
        },
        waiting: () => O.map(given, (taken) => taken.answer),
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
        keepFor(registry, held, keeping, () => MutableHashMap.remove(kept, member))
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
    // Numbers each answer given to this read, so each one nudges.
    let gives = 0
    // The member it last read for, so a refresh of this atom (an optimistic write's, when the last one has answered)
    // reaches the read it shows. One registry holds it in the app; a test that makes several shares the key "".
    let shown = ""
    // Goes up when the read is let go (`letGo`): a screen that still shows it reads anew, from the server.
    const letGoes = Atom.make(0)
    const atom = Atom.writable(
      (get) => {
        get(letGoes)
        const member = get(memberKey)
        shown = member
        const entry = forMember(member)
        const { held, read } = entry
        // Shown again: the screen holds it now. When it is let go (the screen left, or another member), it is kept,
        // unless the read itself was let go meanwhile (what it showed is gone on the server): then nothing is.
        stopKeeping(member)
        get.addFinalizer(() => {
          if (O.exists(MutableHashMap.get(reads, member), (now) => now === entry)) {
            startKeeping(get.registry, member, held)
          }
        })
        get.subscribe(read, (value) => get.setSelf(value))
        return get.once(read)
      },
      // An answer put in place for whoever is signed in now, whether or not a screen shows this read yet.
      (ctx, answer: A) => {
        gives += 1
        ctx.set(forMember(ctx.get(memberKey)).give(answer), gives)
      },
      (refresh) => refresh(forMember(shown).read)
    )
    return Object.assign(atom, {
      letGo: (registry: AtomRegistry.AtomRegistry) => {
        const member = registry.get(memberKey)
        stopKeeping(member)
        MutableHashMap.remove(reads, member)
        // A screen that still shows it is not left on an answer nothing refreshes: it asks the server now.
        registry.update(letGoes, (count) => count + 1)
      },
      peek: (registry: AtomRegistry.AtomRegistry): O.Option<A> =>
        O.flatMap(MutableHashMap.get(reads, registry.get(memberKey)), (per) =>
          O.orElse(per.waiting(), () =>
            // Only a read the registry already holds is looked at: looking at any other would ask the server.
            registry.getNodes().has(per.held) ? AsyncResult.value(registry.get(per.held)) : O.none()
          )
        )
    })
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
  function ask<A, E>(use: (client: Client) => Effect.Effect<A, E>): Effect.Effect<A, E, Id> {
    return Effect.flatMap(client, use)
  }
  return { query, write, send, ask }
}
