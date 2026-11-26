// The browser's seam to the API as atoms, with no contract in it. One runtime for every web package: the app gives it
// its layer once, at the root (`provideApi`), and each package makes its query and write atoms against the client tag it
// declares (`makeApiAtoms`), so a screen reads `useAtomValue(people)` and never runs an Effect itself. The rules this
// file protects: a failure stays typed (a refusal is the endpoint's own error, never a defect); a read is asked again
// once, and a write twice, only for a failure that may pass, never for a refusal; an answer equal to the one held keeps
// the object held, so nothing derived from it is rebuilt; a read belongs to the member who asked, so another member or
// another organization starts from nothing instead of seeing the last one's answer.
import * as A from "effect/Array"
import * as Cause from "effect/Cause"
import * as DateTime from "effect/DateTime"
import * as Duration from "effect/Duration"
import type * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Eq from "effect/Equal"
import * as Exit from "effect/Exit"
import * as Fiber from "effect/Fiber"
import { dual } from "effect/Function"
import * as HashMap from "effect/HashMap"
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
 * What a read knows beside its request: the answer a screen gave it since the request last answered, and how many
 * times something newer than a request that is out was learned (an answer given, a write the server took). A request
 * that lands after `newer` went up may bring an older answer than the tab has seen, so the server is asked once more.
 */
interface Beside<A> {
  readonly newer: number
  readonly given: O.Option<Given<A>>
}

/** A request that is out, and when it started. */
interface Out {
  readonly at: DateTime.Utc
}

/**
 * How old an answer may be and still count as the server's word: under a second. A read answered before its first
 * look would otherwise be asked twice; anything older is shown at once and asked again behind it.
 */
const freshEnough = Duration.seconds(1)

/** After everything that is running now: a write to an atom is never made from inside another atom's read. */
const later = (act: () => void): void => {
  Effect.runFork(Effect.sync(act).pipe(Effect.delay(Duration.zero)))
}

/** The registry an atom is read in, for a write that has to hold something in it. */
const registryOf = Atom.readable((get) => get.registry)

/**
 * One member's read: the request (`asked`), what a screen gave it (`beside`), the two as one answer (`held`, which is
 * what is kept) and what a screen reads (`read`). An answer a screen gives is shown at once and never ends a request
 * that is out: that request lands, and the server is asked once more because the given answer may be the newer one.
 * A given answer is let go when a request answers after it; one given to a read nobody opens stays until the read is
 * let go or the person signs out.
 */
interface PerMember<A, E> {
  readonly asked: Atom.Atom<AsyncResult.AsyncResult<A, E>>
  readonly beside: Atom.Writable<Beside<A>>
  readonly out: Atom.Writable<O.Option<Out>>
  readonly held: Atom.Atom<AsyncResult.AsyncResult<A, E>>
  readonly read: Atom.Atom<AsyncResult.AsyncResult<A, E>>
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

/** What a sign-out names, so each registry lets go of what it holds for the person (`givenHeld`). */
const everyRead: Reactivity.KeysInput = ["every read held, for anyone"]

/** A registry's hold on an answer given to a read nobody shows, and the read it holds. */
interface GivenHold {
  readonly beside: Atom.Atom<unknown>
  readonly release: () => void
}

/** Every query's held reads, so a sign-out can let them all go at once. */
const heldByQueries: Array<{ readonly forget: () => void; readonly members: () => ReadonlyArray<string> }> = []

/**
 * Lets go of every read held for anyone, at once: on sign-out the previous person's rows leave memory (Benjamin:
 * "Keyed reads, and drop them on sign-out"), and whoever signs in next starts from the skeleton. A switch of
 * organization does not call this: the person's reads for the organization they left are kept for `keepUnwatched`.
 */
export const forgetReads = (): void => {
  invalidate(everyRead)
  for (const query of heldByQueries) query.forget()
}

/** The members some read is held for, across every query: for the tests that hold `forgetReads` to its word. */
export const heldReadMembers = (): ReadonlyArray<string> => A.flatMap(heldByQueries, (query) => query.members())

/** How a read behaves beyond its request. */
export interface QueryOptions {
  /** What it shows, so a write that names one of these keys reads it again. */
  readonly reactivityKeys: O.Option<Reactivity.KeysInput>
  /**
   * "page": the answer never changes once given (a staged file's rows), so it is kept for the page's life and not
   * asked again on a return. Otherwise kept for `keepUnwatched` and asked again behind it on every return.
   */
  readonly keep: Keeping
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
  /**
   * Asks the server again without ending a request that is out, for an answer no older than `since` (when the server
   * answered a write the answer must include: a request that left after that answer was served after the write). With no request out it is asked now. A request that started after `since` is
   * the answer wanted: nothing is asked. An earlier one, or any one when no `since` is given, is left to land, and
   * the read is asked once more when it does.
   */
  readonly askAgain: (registry: AtomRegistry.AtomRegistry, since: O.Option<DateTime.Utc>) => void
}

/**
 * Only a read's answer: None until there is one, and the same object for as long as the server answers the same.
 * What is built from a read's data (a table's columns, a review of every row) is built from this, never from the read
 * itself: the read's `AsyncResult` is a new object every time it is asked again (waiting, then answered), and
 * everything built on it would be built again, twice per refresh, for an answer that did not change.
 *
 * Made once, beside the read, not inside another atom's read (each call makes a new atom).
 *
 * @example const facetValues = answerOf(itemFacets) // then: Atom.readable((get) => buildColumns(get(facetValues)))
 */
export const answerOf = <A, E>(read: Atom.Atom<AsyncResult.AsyncResult<A, E>>): Atom.Atom<O.Option<A>> =>
  Atom.withEquality(
    Atom.readable((get) => AsyncResult.value(get(read))),
    O.makeEquivalence((a, b) => a === b)
  )

/**
 * One atom per key, made on first use and held with an ordinary reference (`Atom.family` holds them weakly, and a
 * read made anew after a garbage collection starts empty). For reads per import: a tab opens a handful.
 */
export const perKey = <K, A>(make: (key: K) => A): ((key: K) => A) => {
  const made = MutableHashMap.empty<K, A>()
  return (key) =>
    O.match(MutableHashMap.get(made, key), {
      onSome: (made) => made,
      onNone: () => {
        const atom = make(key)
        MutableHashMap.set(made, key, atom)
        return atom
      }
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
    options: QueryOptions
  ) => Query<A, E>
  /**
   * A write, made by setting the atom to its input. Every press runs on its own (a second press does not interrupt
   * the first); when it succeeds the reads under `reactivityKeys` are asked again.
   */
  readonly write: <Input>() => <A, E>(
    use: (client: Client, input: Input) => Effect.Effect<A, E>,
    options: { readonly reactivityKeys: O.Option<Reactivity.KeysInput> }
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
    options: QueryOptions
  ): Query<A, E> {
    const keeping = options.keep
    // One read per member: when the person or the organization changes, the screen shows its skeleton, never the
    // previous organization's rows marked as waiting. Held with ordinary references, not `Atom.family`'s weak ones: a
    // collected one would be made anew on a return, empty (measured: after 35 s away).
    const reads = MutableHashMap.empty<string, PerMember<A, E>>()
    // An answer given to a read nobody shows is held in its registry, by member, until the read takes it, is let go, or
    // the person signs out. Each hold names the read it holds: a request of a read already let go that lands late lets
    // go of its own hold only, never the one of the read made since for the same member.
    const givenHeld: Atom.Writable<HashMap.HashMap<string, GivenHold>> = Atom.writable(
      (get): HashMap.HashMap<string, GivenHold> => {
        get.addFinalizer(
          reactivity.registerUnsafe(everyRead, () => {
            const held = get.registry.get(givenHeld)
            get.registry.set(givenHeld, HashMap.empty())
            HashMap.forEach(held, (hold) => hold.release())
          })
        )
        return HashMap.empty()
      },
      (ctx, held: HashMap.HashMap<string, GivenHold>) => ctx.setSelf(held)
    ).pipe(Atom.keepAlive)
    const letGiven = (registry: AtomRegistry.AtomRegistry, member: string, of: O.Option<Atom.Atom<unknown>>): void =>
      O.match(HashMap.get(registry.get(givenHeld), member), {
        onNone: () => {},
        onSome: (hold) => {
          if (O.exists(of, (of) => hold.beside !== of)) return
          registry.update(givenHeld, HashMap.remove(member))
          hold.release()
        }
      })
    const make = (member: string): PerMember<A, E> => {
      const beside = Atom.make<Beside<A>>({ newer: 0, given: O.none() })
      // Kept for the page: it holds a time and nothing of a person's, and a request can outlive the screen's look.
      const out = Atom.make<O.Option<Out>>(O.none()).pipe(Atom.keepAlive)
      /** Lets `taken` go if it is still the answer given: a later one stays. */
      const takenUp = (registry: AtomRegistry.AtomRegistry, taken: Given<A>): void => {
        if (!registry.getNodes().has(beside)) return
        const now = registry.get(beside)
        if (O.exists(now.given, (given) => given === taken)) {
          registry.set(beside, { ...now, given: O.none() })
          letGiven(registry, member, O.some(beside))
        }
      }
      /** Asks once more, unless a request already left since: one that left after what was learned includes it. */
      const onceMore = (registry: AtomRegistry.AtomRegistry): void => {
        if (O.isNone(registry.get(out))) registry.refresh(asked)
      }
      const asked: Atom.Atom<AsyncResult.AsyncResult<A, E>> = apiRuntime.atom((get) => {
        const registry = get.registry
        // Looked at without following it: an answer given later must not start this read again.
        const start = get.once(beside)
        const first = O.isNone(get.self<AsyncResult.AsyncResult<A, E>>()) ? start.given : O.none()
        if (O.isSome(first)) {
          // A screen gave the answer before anything was asked: that answer, and no request. Given a while ago (an
          // upload that landed while the person was elsewhere), it is shown at once and asked again behind, as any
          // answer of that age is.
          const taken = first.value
          const age = DateTime.distance(taken.at, DateTime.nowUnsafe())
          later(() => {
            takenUp(registry, taken)
            if (keeping !== "page" && Duration.isGreaterThan(age, freshEnough) && registry.getNodes().has(asked)) {
              onceMore(registry)
            }
          })
          return Effect.succeed(taken.answer)
        }
        const mine: Out = { at: DateTime.nowUnsafe() }
        return Effect.sync(() => registry.set(out, O.some(mine))).pipe(
          Effect.andThen(Effect.flatMap(client, (c) => use(c, get)).pipe(Effect.retry(readRetry))),
          Effect.map((answer) => {
            // The same answer as the one on screen keeps the object on screen, whether the request or a screen gave it.
            const shown = O.orElse(
              O.map(registry.get(beside).given, (given) => given.answer),
              () => heldSuccess(get.self<AsyncResult.AsyncResult<A, E>>())
            )
            const landedAt = registry.get(beside)
            // Something newer was learned while it was out (an answer a screen gave, or a write this answer may not
            // include): asked once more, and what the screen gave stays on screen until that answer lands, so the
            // screen never steps back to what the server held when this request left.
            const again = keeping !== "page" && landedAt.newer !== start.newer
            later(() => {
              if (!registry.getNodes().has(asked)) return
              if (again) return onceMore(registry)
              // Nothing was given while it was out: an answer given before it left is older than its answer, and is
              // let go. One given after it landed stays.
              O.map(landedAt.given, (given) => takenUp(registry, given))
            })
            return keepWhenEqual(shown, answer)
          }),
          Effect.onExit((exit) =>
            Effect.sync(() => {
              if (O.exists(registry.get(out), (now) => now === mine)) registry.set(out, O.none())
              // The server said no (the import is gone, the role was taken away) or could not be reached: that is
              // what the screen shows, never an answer a screen gave, which would hide it. Ended to be asked again
              // is not an answer, and changes nothing.
              if (Exit.isFailure(exit) && !Cause.hasInterruptsOnly(exit.cause)) {
                const failedAt = registry.get(beside)
                later(() => O.map(failedAt.given, (given) => takenUp(registry, given)))
              }
            })
          )
        )
      })
      // What the screen shows: the answer a screen gave since the request last answered, else the request's. A given
      // answer carries the time it was given, so it grows stale as any answer does. Asking again asks the request.
      const held: Atom.Atom<AsyncResult.AsyncResult<A, E>> = Atom.readable(
        (get) => {
          const result = get(asked)
          return O.match(get(beside).given, {
            onNone: () => result,
            onSome: (given) =>
              AsyncResult.success<A, E>(given.answer, {
                waiting: result.waiting,
                timestamp: DateTime.toEpochMillis(given.at)
              })
          })
        },
        (refresh) => refresh(asked)
      )
      // Every return to a screen asks again behind the answer it shows: `held` outlives the screen by
      // `keepUnwatched` (kept below), this wrapper does not, so a screen that mounts it again starts a new look. An
      // answer under a second old counts as fresh, or a read answered before its first look would be asked twice. An
      // answer kept for the page is never asked again.
      const fresh = keeping === "page" ? held : Atom.swr(held, { staleTime: freshEnough })
      return {
        asked,
        beside,
        out,
        held,
        read: O.match(options.reactivityKeys, { onNone: () => fresh, onSome: (keys) => fresh.pipe(followKeys(keys)) })
      }
    }
    const forMember = (member: string): PerMember<A, E> =>
      O.match(MutableHashMap.get(reads, member), {
        onSome: (read) => read,
        onNone: () => {
          const made = make(member)
          MutableHashMap.set(reads, member, made)
          return made
        }
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
    const startKeeping = (registry: AtomRegistry.AtomRegistry, member: string, entry: PerMember<A, E>): void => {
      stopKeeping(member)
      MutableHashMap.set(
        kept,
        member,
        keepFor(registry, entry.held, keeping, () => {
          MutableHashMap.remove(kept, member)
          // Kept as long as the read was, and no longer: an answer a screen gave it goes with it.
          if (registry.getNodes().has(entry.beside)) {
            registry.update(entry.beside, (now) => ({ ...now, given: O.none() }))
          }
          letGiven(registry, member, O.some(entry.beside))
        })
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
    // Goes up when the read is let go (`letGo`): a screen that still shows it reads anew, from the server.
    const letGoes = Atom.make(0)
    const atom = Atom.writable(
      (get) => {
        get(letGoes)
        const member = get(memberKey)
        shown = member
        const entry = forMember(member)
        const { read } = entry
        // Shown again: the screen holds it now. When it is let go (the screen left, or another member), it is kept,
        // unless the read itself was let go meanwhile (what it showed is gone on the server): then nothing is.
        stopKeeping(member)
        get.addFinalizer(() => {
          if (O.exists(MutableHashMap.get(reads, member), (now) => now === entry)) {
            startKeeping(get.registry, member, entry)
          }
        })
        get.subscribe(read, (value) => get.setSelf(value))
        return get.once(read)
      },
      // An answer put in place for whoever is signed in now, whether or not a screen shows this read yet.
      (ctx, answer: A) => {
        const member = ctx.get(memberKey)
        const { beside } = forMember(member)
        const registry = ctx.get(registryOf)
        if (!O.exists(HashMap.get(registry.get(givenHeld), member), (hold) => hold.beside === beside)) {
          letGiven(registry, member, O.none())
          const release = registry.mount(beside)
          const hold: GivenHold = { beside, release }
          registry.update(givenHeld, HashMap.set(member, hold))
        }
        ctx.set(beside, { newer: ctx.get(beside).newer + 1, given: O.some({ answer, at: DateTime.nowUnsafe() }) })
      },
      (refresh) => refresh(forMember(shown).read)
    )
    return Object.assign(atom, {
      letGo: (registry: AtomRegistry.AtomRegistry) => {
        const member = registry.get(memberKey)
        stopKeeping(member)
        letGiven(registry, member, O.none())
        MutableHashMap.remove(reads, member)
        // A screen that still shows it is not left on an answer nothing refreshes: it asks the server now.
        registry.update(letGoes, (count) => count + 1)
      },
      peek: (registry: AtomRegistry.AtomRegistry): O.Option<A> =>
        O.flatMap(MutableHashMap.get(reads, registry.get(memberKey)), (per) => {
          // Only what the registry already holds is looked at: looking at a read it does not hold would ask the server.
          const nodes = registry.getNodes()
          return O.orElse(
            nodes.has(per.beside) ? O.map(registry.get(per.beside).given, (given) => given.answer) : O.none(),
            () => (nodes.has(per.held) ? AsyncResult.value(registry.get(per.held)) : O.none())
          )
        }),
      askAgain: (registry: AtomRegistry.AtomRegistry, since: O.Option<DateTime.Utc>) => {
        O.map(MutableHashMap.get(reads, registry.get(memberKey)), (per) =>
          O.match(registry.get(per.out), {
            onNone: () => registry.refresh(per.read),
            onSome: (request) => {
              if (O.exists(since, (since) => DateTime.isGreaterThan(request.at, since))) return
              if (registry.getNodes().has(per.beside)) {
                registry.update(per.beside, (now) => ({ ...now, newer: now.newer + 1 }))
              }
            }
          })
        )
      }
    })
  }
  function send<A, E>(use: (client: Client) => Effect.Effect<A, E>): Effect.Effect<A, E, Id> {
    return Effect.flatMap(client, use).pipe(Effect.retry(writeRetry))
  }
  const write =
    <Input>() =>
    <A, E>(
      use: (client: Client, input: Input) => Effect.Effect<A, E>,
      options: { readonly reactivityKeys: O.Option<Reactivity.KeysInput> }
    ): Atom.AtomResultFn<Input, A, E> =>
      apiRuntime.fn<Input>()(
        (input) => {
          const keys = options.reactivityKeys
          const sent = send((c) => use(c, input))
          return O.match(keys, {
            onNone: () => sent,
            onSome: (keys) => Effect.tap(sent, () => Effect.sync(() => invalidate(keys)))
          })
        },
        { concurrent: true }
      )
  function ask<A, E>(use: (client: Client) => Effect.Effect<A, E>): Effect.Effect<A, E, Id> {
    return Effect.flatMap(client, use)
  }
  return { query, write, send, ask }
}
