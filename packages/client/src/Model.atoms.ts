// The browser's seam to a model's Api (`@alchemy.run/domain`) as atoms, with no model in it: a web package passes the
// key of the client the app's layer provides (`UsageApi.Client`), as it passes its HTTP client's key to `makeApiAtoms`,
// and gets back that kit's reads and writes over it plus the two a model adds. The rules this file protects: one press
// is one command, with one command id made at the press and sent again unchanged on every resend of it, so a resend
// after a lost answer is given the first receipt and decides nothing twice (node_modules/@alchemy.run/domain/src/Api.ts,
// `CommandOptions.commandId`); and a watched key is one member's: it is opened on a client made for the page's member
// alone (`LiveReads`), which the app builds with the member's id in the socket's address, and closed the moment the
// page's member changes, so no socket stays open for an account the page left and the new member starts from nothing
// instead of seeing the last one's state. Its pushed changes reach the screen with nothing asked again.
import type * as Cause from "effect/Cause"
import * as A from "effect/Array"
import type * as Context from "effect/Context"
import * as Duration from "effect/Duration"
import * as Effect from "effect/Effect"
import { dual } from "effect/Function"
import * as Layer from "effect/Layer"
import * as MutableHashMap from "effect/MutableHashMap"
import * as MutableHashSet from "effect/MutableHashSet"
import * as O from "effect/Option"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import * as Atom from "effect/reactivity/Atom"
import type * as Reactivity from "effect/reactivity/Reactivity"
import * as Stream from "effect/Stream"
import type { RequestId } from "@inventory/kernel/Ids"
import {
  type ApiAtoms,
  apiRuntime,
  invalidate,
  makeApiAtoms,
  makeHolds,
  perKey,
  type Query,
  type QueryOptions
} from "@inventory/client/Api"
import { newRequestId } from "@inventory/client/ApiRuntime"
import {
  member as memberAtom,
  memberKey,
  readAsPageMember,
  refusedForWantOfAMember,
  sentAsPageMember
} from "@inventory/client/MemberAtoms"
import type { Member } from "@inventory/kernel/Member"

/**
 * What a press sends beside its input: the command's id, made once at the press. The library takes it as
 * `commandId`; it is the kernel's `RequestId`, the key the kit already makes once per action a person takes.
 */
export interface Sent {
  readonly commandId: RequestId
}

/**
 * How a model's live reads reach it: `liveClient` is the client one member's live read is opened on (none: nobody is
 * signed in), made for that read alone when it opens and closed with it, never the page's client its commands go
 * through. The app builds it on its model's Api with the member's id in the socket's address (Benjamin, 2026-11-26:
 * "Member id in the socket's address"), for example `(member) => UsageApi.layerClientWebSocket(addressOf(member))`,
 * and what it needs besides (the HTTP client, the WebSocket constructor) comes from the app's layer (`provideApi`).
 * The library puts the read in the address's query (`?read=`), so the member's id goes in its path. The member never
 * changes for an open read: when the page's member changes the read is closed and another is opened.
 */
export interface LiveReads<Id, R> {
  readonly liveClient: (member: O.Option<Member>) => Layer.Layer<Id, never, R>
}

/** A watched key's state as the screen reads it: the view's snapshots as they are pushed. */
export type Watched<A, E> = Atom.Atom<AsyncResult.AsyncResult<A, E | Cause.NoSuchElementError>>

/**
 * The atoms one web package makes against a model's client: the HTTP kit's, its `query` asking a read the model
 * refused for want of a member again as the page's member (`readAsPageMember`), and a model's command and watch.
 */
export interface ModelAtoms<Id, Client> extends ApiAtoms<Id, Client> {
  /**
   * A command, sent by setting the atom to its input. Every press runs on its own with its own command id (`Sent`),
   * made before the send and kept for it: a failure that may pass is sent again, twice at most, with that same id, so
   * the model gives the first receipt instead of deciding again. A refusal is never sent again, except one for want of
   * a member, which is sent again as the page's member or not at all (`sentAsPageMember`). When it succeeds the
   * reads under `reactivityKeys` (the HTTP reads that show what it changed) are asked again.
   */
  readonly command: <Input>() => {
    (options: {
      readonly reactivityKeys: O.Option<Reactivity.KeysInput>
    }): <A, E>(
      self: (client: Client, input: Input, sent: Sent) => Effect.Effect<A, E>
    ) => Atom.AtomResultFn<Input, A, E>
    <A, E>(
      self: (client: Client, input: Input, sent: Sent) => Effect.Effect<A, E>,
      options: { readonly reactivityKeys: O.Option<Reactivity.KeysInput> }
    ): Atom.AtomResultFn<Input, A, E>
  }
  /**
   * One key of a view, followed: `self` opens the view's `watch` for the key (`(api, key) => api.Allowance.watch(key)`),
   * which sends the key's state with its cursor first and then every change, and resumes after the last one by itself
   * when its socket drops or the server judges it again. Called once per view, at module level; the atom per key is
   * then made once. It is one member's: `client` is the one `LiveReads` made for that member, and the moment the page's
   * member changes (another member, another organization, nobody) the watch is closed, looked at or not, and the new
   * member's starts from nothing (waiting, with no state). For the same member, a watch nobody looks at is kept open
   * for `keepUnwatched` from when the screen left it, so a return shows its state at once; then it is closed, and
   * `forgetReads` closes every one, shown or not, and opens none: a screen showing one waits until the page's member
   * changes or it is refreshed. Refreshing it opens the watch again.
   */
  readonly watched: <K, A, E>(self: (client: Client, key: K) => Stream.Stream<A, E>) => (key: K) => Watched<A, E>
}

/**
 * The HTTP kit's atoms and a model's command and watch, for the key of one model's client, run on `apiRuntime`. A web
 * package calls it once, at module level, with the client's key the app's layer provides (`SomeApi.Client`) and how
 * a member's live reads reach the model (`LiveReads`). That layer gives the model's protocol the kit's
 * `modelHttpClient` (`@inventory/client/Http`), so a 503, a 502 or a 429 from the edge fails as its status, which a
 * command sends again, and not as an unreadable answer.
 */
export const makeModelAtoms: {
  <Id, R>(live: LiveReads<Id, R>): <Client>(tag: Context.Key<Id, Client>) => ModelAtoms<Id, Client>
  <Id, Client, R>(tag: Context.Key<Id, Client>, live: LiveReads<Id, R>): ModelAtoms<Id, Client>
} = dual(2, <Id, Client, R>(tag: Context.Key<Id, Client>, live: LiveReads<Id, R>): ModelAtoms<Id, Client> => {
  const api = makeApiAtoms(tag)
  const client = Effect.service(tag)
  const command = <Input>() =>
    dual<
      (options: {
        readonly reactivityKeys: O.Option<Reactivity.KeysInput>
      }) => <A, E>(
        self: (client: Client, input: Input, sent: Sent) => Effect.Effect<A, E>
      ) => Atom.AtomResultFn<Input, A, E>,
      <A, E>(
        self: (client: Client, input: Input, sent: Sent) => Effect.Effect<A, E>,
        options: { readonly reactivityKeys: O.Option<Reactivity.KeysInput> }
      ) => Atom.AtomResultFn<Input, A, E>
    >(
      2,
      <A, E>(
        self: (client: Client, input: Input, sent: Sent) => Effect.Effect<A, E>,
        options: { readonly reactivityKeys: O.Option<Reactivity.KeysInput> }
      ): Atom.AtomResultFn<Input, A, E> =>
        apiRuntime.fn<Input>()(
          (input) => {
            // The id is made here, once per press, outside what `send` sends again.
            // Refused for want of a member, sent again as the page's member or not at all (`sentAsPageMember`).
            const sent = Effect.sync(newRequestId).pipe(
              Effect.flatMap((commandId) => api.send((c) => sentAsPageMember(self(c, input, { commandId }))))
            )
            return O.match(options.reactivityKeys, {
              onNone: () => sent,
              onSome: (keys) => Effect.tap(sent, () => Effect.sync(() => invalidate(keys)))
            })
          },
          { concurrent: true }
        )
    )
  const watched = <K, A, E>(self: (client: Client, key: K) => Stream.Stream<A, E>): ((key: K) => Watched<A, E>) =>
    perKey((key: K) =>
      watchOne((who) =>
        // Fresh, built for this read: without it the stream keeps the client the page's layer built, at the address
        // every member shares.
        // A read refused for want of a member asks who is signed in, once (`refusedForWantOfAMember`).
        Stream.unwrap(Effect.map(client, (c) => self(c, key))).pipe(
          Stream.tapError(refusedForWantOfAMember),
          Stream.provide(Layer.fresh(live.liveClient(who)))
        )
      )
    )
  // A read of the model refused for want of a member is asked again as the page's member (`readAsPageMember`).
  const query = dual<
    (
      options: QueryOptions
    ) => <A, E>(self: (client: Client, get: Atom.AtomContext) => Effect.Effect<A, E>) => Query<A, E>,
    <A, E>(self: (client: Client, get: Atom.AtomContext) => Effect.Effect<A, E>, options: QueryOptions) => Query<A, E>
  >(2, <A, E>(self: (client: Client, get: Atom.AtomContext) => Effect.Effect<A, E>, options: QueryOptions) =>
    api.query((c, get) => readAsPageMember(self(c, get)), options)
  )
  return { ...api, query, command, watched }
})

/**
 * One key's watch, per member: each member's is an atom over the stream, made on first use and held with an ordinary
 * reference; what a screen reads follows the member who is signed in now and the pushes of that member's stream. A
 * member's atom is let go by the registry as soon as nothing reads or holds it (no idle time of its own), which closes
 * its stream: the screen stops reading it when the member changes, and its hold ends then too (`makeHolds`). A
 * member's atom is forgotten whenever nothing holds it any more, so a later look opens a new one for the member as
 * the page knows them then. `forgetReads` forgets every member's, and a screen that still shows this key lets go of
 * the watch it followed, which closes it, and opens none: it shows nothing (waiting) until the page's member changes
 * or the key is refreshed, so no watch is opened again for the person the page is leaving.
 */
const watchOne = <A, E, R>(open: (who: O.Option<Member>) => Stream.Stream<A, E, R>): Watched<A, E> => {
  const perMember = MutableHashMap.empty<string, Watched<A, E>>()
  // How each screen that shows this key now is told that `forgetReads` let go of its watch.
  const showing = MutableHashSet.empty<() => void>()
  // In each registry, whether `forgetReads` let go of the watch a screen showed: until the member changes or the key
  // is refreshed (which reads it again as false), the screen opens no watch.
  const forgotten = Atom.make(false)
  const holds = makeHolds({
    forget: () => {
      MutableHashMap.clear(perMember)
      const told = A.fromIterable(showing)
      MutableHashSet.clear(showing)
      for (const forgetShown of told) forgetShown()
    },
    leave: (member) => MutableHashMap.remove(perMember, member),
    members: () => perMember.pipe(MutableHashMap.keys, A.fromIterable)
  })
  const forMember = (member: string, who: O.Option<Member>): Watched<A, E> =>
    O.match(MutableHashMap.get(perMember, member), {
      onSome: (made) => made,
      onNone: () => {
        const made: Watched<A, E> = apiRuntime.atom(open(who)).pipe(Atom.setIdleTTL(Duration.zero))
        MutableHashMap.set(perMember, member, made)
        return made
      }
    })
  // The member it last read for, so a refresh of this atom reaches the watch it shows.
  let shown = { member: "", who: O.none<Member>() }
  return Atom.readable(
    (get) => {
      if (get(forgotten)) {
        // Let go by `forgetReads`: nothing is opened, not even for the same member, until the page's member changes.
        get.subscribe(memberKey, () => get.set(forgotten, false))
        return AsyncResult.initial()
      }
      const member = get(memberKey)
      const who = get.once(memberAtom)
      shown = { member, who }
      const read = forMember(member, who)
      // When this is let go (the screen left, or the member changed), it is kept for the same member and let go for
      // another, unless `forgetReads` or a change of member let it go meanwhile: then nothing is.
      get.addFinalizer(() => {
        if (O.exists(MutableHashMap.get(perMember, member), (now) => now === read))
          holds.left(get.registry, member, read)
      })
      get.subscribe(read, (value) => get.setSelf(value))
      const forgetShown = () => get.set(forgotten, true)
      MutableHashSet.add(showing, forgetShown)
      get.addFinalizer(() => MutableHashSet.remove(showing, forgetShown))
      // Looked at again: the hold an earlier leave took ends, now that the screen keeps it mounted.
      holds.looked(member)
      return get.once(read)
    },
    (refresh) => {
      // The watch it shows, if it has one: none after `forgetReads`, and a refresh then opens one for the member.
      const read = MutableHashMap.get(perMember, shown.member)
      refresh(forgotten)
      O.map(read, refresh)
    }
  )
}
