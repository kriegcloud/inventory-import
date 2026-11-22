// Who is signed in, for the screens of every web package, as an atom: the app reads the session once (the access
// screens' session atom) and points `memberSource` at it at the root, so a screen mirrors the server's role rule with
// `useAtomValue(member)` without knowing how the session is read. The server enforces the rule; this only keeps a
// refused button off the screen.
//
// The one thing not to break: one page is one member's. While who is signed in is asked again, the page keeps the
// member it had, and nothing is written until the answer comes; an answer that is somebody else, another organization
// or nobody is never given to the page at all: the page is left, with a full page load (`answeredFor`), so nothing a
// person typed, chose or read is there for whoever is next. The one exception is the person's own switch of
// organization, which keeps their reads (Benjamin, 2026-11-19): what a screen holds beside its reads is then started
// again (`ofMember`).
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as S from "effect/Schema"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import * as Atom from "effect/reactivity/Atom"
import * as AtomRegistry from "effect/reactivity/AtomRegistry"
import type { Member } from "@inventory/kernel/Member"

const nobody: Atom.Atom<O.Option<Member>> = Atom.make(O.none<Member>())

/**
 * Where the member is read from. The app gives it the atom of its session at the root (`provideMember`); until then,
 * and in a test that gives none, nobody is known.
 */
export const memberSource: Atom.Atom<Atom.Atom<O.Option<Member>>> = Atom.make<Atom.Atom<O.Option<Member>>>(nobody).pipe(
  Atom.keepAlive
)

/** The atom's initial value, for `RegistryProvider`'s `initialValues`: the member is read from `from`. */
export const provideMember = (from: Atom.Atom<O.Option<Member>>): readonly [Atom.Atom<unknown>, unknown] =>
  Atom.initialValue(memberSource, from)

/**
 * The signed-in member of the active organization; none while that is not known yet. While it is asked again, the
 * member the page has.
 */
export const member: Atom.Atom<O.Option<Member>> = Atom.readable((get) => get(get(memberSource)))

/**
 * Asks who is signed in again, as the member's source asks it (the app's asks the session): a write the server refused
 * because nobody is signed in means the page's idea of who is signed in is out of date. Until the answer comes,
 * `whoIsSignedInAsked` is true and the page stays as it is. The same member: it goes on. Anybody else, or nobody: the
 * page is left for a fresh one.
 */
export const askWhoIsSignedIn = (registry: AtomRegistry.AtomRegistry): void =>
  registry.refresh(registry.get(memberSource))

const neverAsked: Atom.Atom<boolean> = Atom.make(false)

/**
 * Where the page reads whether who is signed in is being asked (again). The app gives it its session's own word at the
 * root (`provideWhoIsSignedInAsked`); until then, and in a test that gives none, it is never being asked.
 */
export const whoIsSignedInAskedSource: Atom.Atom<Atom.Atom<boolean>> = Atom.make<Atom.Atom<boolean>>(neverAsked).pipe(
  Atom.keepAlive
)

/** The atom's initial value, for `RegistryProvider`'s `initialValues`: whether it is being asked is read from `from`. */
export const provideWhoIsSignedInAsked = (from: Atom.Atom<boolean>): readonly [Atom.Atom<unknown>, unknown] =>
  Atom.initialValue(whoIsSignedInAskedSource, from)

/**
 * True while who is signed in is being asked (again) and is not known: until the answer comes, and after one that
 * could not be read. `member` then says who the page has, which may not be who the session's cookie is now. A write
 * made for one member waits for the answer, and goes only if that member is the one it names.
 */
export const whoIsSignedInAsked: Atom.Atom<boolean> = Atom.readable((get) => get(get(whoIsSignedInAskedSource)))

/** One member as a string ("member/organization"), empty for nobody: what a read and a page are kept under. */
export const keyOfMember = (who: O.Option<Member>): string =>
  O.match(who, { onNone: () => "", onSome: (one) => `${one.id}/${one.organizationId}` })

/**
 * Who the API is being asked for, as one string ("member/organization", empty when nobody is known): a read is kept per
 * key (`@inventory/client/Api`), so signing in as someone else or switching organization starts every read afresh.
 */
export const memberKey: Atom.Atom<string> = Atom.map(member, keyOfMember)

/**
 * The member a page has by its session's answers: the last one's, also while the session is asked again and when it
 * could not be read. None before the first answer, and where the answer is no member.
 */
export const memberOfAnswer = <Answer, Failed>(input: {
  readonly session: AsyncResult.AsyncResult<Answer, Failed>
  readonly memberOf: (answer: Answer) => O.Option<Member>
}): O.Option<Member> => O.flatMap(AsyncResult.value(input.session), input.memberOf)

/** True while a session has no answer that stands: being asked (again), or asked and not read. */
export const askedOfAnswer = (session: AsyncResult.AsyncResult<unknown, unknown>): boolean =>
  session.waiting || AsyncResult.isFailure(session)

/**
 * A session's answer, as the page takes it. The member the page has (`before`) is still who is signed in, or the page
 * had nobody yet, or the person chose the organization it names (`chosen`): the answer, and the page goes on. Anybody
 * else, another organization or nobody: the page is left (`leave`, a full page load), and it never hears the answer.
 * Until it has gone it keeps asking, so it shows nothing as, and writes nothing as, whoever is signed in now.
 */
export const answeredFor = <Answer>(input: {
  readonly answer: Answer
  readonly before: O.Option<Member>
  readonly after: O.Option<Member>
  readonly chosen: boolean
  readonly leave: () => void
}): Effect.Effect<Answer> =>
  O.isNone(input.before) || input.chosen || keyOfMember(input.before) === keyOfMember(input.after)
    ? Effect.succeed(input.answer)
    : Effect.sync(input.leave).pipe(Effect.andThen(Effect.never))

/** A state with whose it is. */
interface Owned<A> {
  readonly of: string
  readonly value: A
}

/** A member's state, held in an atom made by `as`: `ofMember` and `keptOfMember`. */
const followingMember = <A>(
  initial: () => A,
  as: (state: Atom.Writable<Owned<A>, A>) => Atom.Writable<Owned<A>, A>
): Atom.Writable<A> => {
  const held: Atom.Writable<Owned<A>, A> = as(
    Atom.writable(
      (get): Owned<A> => {
        const of = get(memberKey)
        // Built again for the same member (the session was asked again, and answered the same): what it holds stays.
        return O.getOrElse(
          O.filter(get.self<Owned<A>>(), (before) => before.of === of),
          () => ({ of, value: initial() })
        )
      },
      // Read first: one that is written before anything read it would not follow the member, and outlive them.
      (ctx, next: A) => ctx.setSelf({ of: ctx.get(held).of, value: next })
    )
  )
  return Atom.writable(
    (get) => get(held).value,
    (ctx, next: A) => ctx.set(held, next)
  )
}

/**
 * State a screen holds that belongs to whoever is signed in and is not a read (what is typed, chosen or open): it
 * starts again from `initial` for another member or another organization, and stays for the same one.
 *
 * @example const addEmail = ofMember(() => "")
 */
export const ofMember = <A>(initial: () => A): Atom.Writable<A> => followingMember(initial, (held) => held)

/**
 * The same, held for the page's life and not only while a screen reads it. It is let go the moment the member or the
 * organization changes, read or not (not lazy): nothing of it waits in memory for a screen to look.
 */
export const keptOfMember = <A>(initial: () => A): Atom.Writable<A> =>
  followingMember(initial, (held) => held.pipe(Atom.keepAlive, Atom.setLazy(false)))

/** Done once who is signed in is known: at once, or when the session that is being asked (again) has answered. */
export const onceSignedInKnown = (registry: AtomRegistry.AtomRegistry): Effect.Effect<void> =>
  Effect.callback<void>((resume) => {
    if (!registry.get(whoIsSignedInAsked)) return resume(Effect.void)
    const stop = registry.subscribe(whoIsSignedInAsked, (asked) => {
      if (asked) return
      stop()
      resume(Effect.void)
    })
    return Effect.sync(stop)
  })

/** A write was not sent: the person changed organization before it was, and it was made for the one they left. */
export class NotSentElsewhere extends S.TaggedError<NotSentElsewhere, { readonly brand: unique symbol }>()(
  "NotSentElsewhere",
  { reason: S.String }
) {}

/**
 * The write not sent, as the person reads it (`sayError` says its `reason`, under "That did not work"): what happened,
 * that nothing changed, and where to do it.
 */
export const notSentElsewhere = (): NotSentElsewhere =>
  NotSentElsewhere.make({
    reason:
      "You opened another organization before it was sent, so it was not sent and nothing was changed. Switch back to do it there."
  })

/**
 * A write as the member who pressed it, or not at all: held while who is signed in is being asked (again), and sent
 * once the answer is that member. An answer that is somebody else leaves the page, and the write is never sent; after
 * the person's own switch of organization it fails, since it was made for the organization they left. Only a request
 * made from an atom knows its registry; any other goes as it is (the review's draft and the upload hold their own).
 */
export const asPressed = <A, E, R>(send: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> =>
  Effect.flatMap(
    Effect.serviceOption(AtomRegistry.AtomRegistry),
    O.match({
      onNone: () => send,
      onSome: (registry) => {
        const pressedAs = registry.get(memberKey)
        return onceSignedInKnown(registry).pipe(
          Effect.andThen(() => (registry.get(memberKey) === pressedAs ? send : Effect.die(notSentElsewhere())))
        )
      }
    })
  )

/**
 * What must end before the person's own switch of organization is sent, while the session is still the one they are
 * leaving: each is work of that organization that can only be finished or cleaned up as its member (an upload's last
 * request, or the rows it already sent). A screen adds its work while it runs and takes it out when it ends.
 */
export const beforeOwnSwitch: Atom.Writable<ReadonlyArray<Effect.Effect<void>>> = Atom.make<
  ReadonlyArray<Effect.Effect<void>>
>([]).pipe(Atom.keepAlive)

/** Ends everything `beforeOwnSwitch` holds, all at once; done when each is. */
export const settledBeforeOwnSwitch = (registry: AtomRegistry.AtomRegistry): Effect.Effect<void> =>
  Effect.forEach(registry.get(beforeOwnSwitch), (work) => work, { concurrency: "unbounded", discard: true })
