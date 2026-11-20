// Who is signed in, for the screens of every web package, as an atom: the app reads the session once (the access
// screens' session atom) and points `memberSource` at it at the root, so a screen mirrors the server's role rule with
// `useAtomValue(member)` without knowing how the session is read. The server enforces the rule; this only keeps a
// refused button off the screen.
import * as O from "effect/Option"
import * as Atom from "effect/reactivity/Atom"
import type * as AtomRegistry from "effect/reactivity/AtomRegistry"
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

/** The signed-in member of the active organization; none while that is not known yet. */
export const member: Atom.Atom<O.Option<Member>> = Atom.readable((get) => get(get(memberSource)))

/**
 * Asks who is signed in again, as the member's source asks it (the app's asks the session): a write the server refused
 * because nobody is signed in means the page's idea of who is signed in is out of date, and the tab then shows the
 * sign-in page, or the member signed in now. Until the answer comes, `whoIsSignedInAsked` is true.
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
 * True while who is signed in is being asked (again) and has not answered: `member` then says what the page last
 * knew, which may not be who the session's cookie is now. A write made for one member waits for the answer, and goes
 * only if that member is the one it names.
 */
export const whoIsSignedInAsked: Atom.Atom<boolean> = Atom.readable((get) => get(get(whoIsSignedInAskedSource)))

/**
 * Who the API is being asked for, as one string ("member/organization", empty when nobody is known): a read is kept per
 * key (`@inventory/client/Api`), so signing in as someone else or switching organization starts every read afresh.
 */
export const memberKey: Atom.Atom<string> = Atom.map(
  member,
  O.match({ onNone: () => "", onSome: (who) => `${who.id}/${who.organizationId}` })
)
