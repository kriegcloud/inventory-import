// Who is signed in, as a test's page has it: one session atom that everything derives from, by the app's own rules
// (`@inventory/client/MemberAtoms`), so a test is never on a page the app cannot be on. Asked again, the member stays
// and nobody is certain until the test answers; the same member goes on; anybody else, another organization or nobody
// leaves the page, which never becomes theirs (`left`); another organization the person chose (`choose`) is the one
// change a page lives through. And what is drawn while there is a member, as the app's sign-in gate draws it.
import * as Deferred from "effect/Deferred"
import * as Effect from "effect/Effect"
import { identity } from "effect/Function"
import * as O from "effect/Option"
import * as S from "effect/Schema"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import * as Atom from "effect/reactivity/Atom"
import type * as AtomRegistry from "effect/reactivity/AtomRegistry"
import { answeredFor, askedOfAnswer, keyOfMember, memberKey, memberOfAnswer } from "@inventory/client/MemberAtoms"
import { MemberId, OrganizationId } from "@inventory/kernel/Ids"
import { Member } from "@inventory/kernel/Member"
import { DisplayName } from "@inventory/kernel/Text"

/** Who is signed in: a member, or nobody. */
type Who = O.Option<Member>

/** The session could not be read. */
class Unread extends S.TaggedError<Unread, { readonly brand: unique symbol }>()("Unread", {}) {}

/** A member, by id, in an organization (Prairie unless the test says otherwise). */
export const memberOf = (who: { readonly id: string; readonly organization?: string }): Who => {
  const organization = who.organization ?? "org_prairie"
  return O.some(
    Member.make({
      id: MemberId.make(who.id),
      name: DisplayName.make(who.id),
      role: "admin",
      organizationId: OrganizationId.make(organization),
      organizationName: DisplayName.make(organization)
    })
  )
}

/**
 * A page's session: `first` is who it is for. Its `signedIn` and `asked` are what `registryFor` takes. Each time it is
 * asked again is counted (`times`) and stays out until `answer` or `fail`.
 *
 * @example const s = sessionStandIn(memberOf({ id: "mem_dana" }))
 *          const registry = registryFor({ endpoints, signedIn: s.signedIn, asked: s.asked })
 */
export const sessionStandIn = (first: Who) => {
  const out: Array<Deferred.Deferred<Who, Unread>> = []
  const left = { times: 0 }
  const chosen: { organization: string | undefined } = { organization: undefined }
  const session: Atom.Atom<AsyncResult.AsyncResult<Who, Unread>> = Atom.make((get): Effect.Effect<Who, Unread> => {
    const before = get.self<AsyncResult.AsyncResult<Who, Unread>>()
    if (O.isNone(before)) return Effect.succeed(first)
    return Effect.suspend(() => {
      const question = Deferred.makeUnsafe<Who, Unread>()
      out.push(question)
      return Deferred.await(question)
    }).pipe(
      Effect.flatMap((answer) =>
        answeredFor({
          answer,
          before: O.flatten(O.flatMap(before, AsyncResult.value)),
          after: answer,
          chosen: O.exists(answer, (one) => one.organizationId === chosen.organization),
          leave: () => {
            left.times += 1
          }
        })
      )
    )
  }).pipe(Atom.keepAlive)
  /** The question that is out: the last one asked. */
  const question = () => O.getOrThrow(O.fromUndefinedOr(out[out.length - 1]))
  return {
    signedIn: Atom.readable(
      (get) => memberOfAnswer({ session: get(session), memberOf: identity<Who> }),
      (refresh) => refresh(session)
    ),
    asked: Atom.map(session, askedOfAnswer),
    /** How many times it was asked again. */
    times: () => out.length,
    /** How many times the page was left. */
    left,
    answer: (who: Who) => Deferred.succeed(question(), who),
    /** The question gets no answer (the network). */
    fail: () => Deferred.fail(question(), Unread.make({})),
    /** The person chooses another of their organizations here: the next answer in it is their own switch. */
    choose: (organization: string) => {
      chosen.organization = organization
    },
    /**
     * Draws `what` while the page has a member, as the sign-in gate does: let go with nobody, and drawn anew for
     * another organization.
     */
    drawn: (registry: AtomRegistry.AtomRegistry, what: (registry: AtomRegistry.AtomRegistry) => () => void) => {
      const on: { for: string; stop: (() => void) | undefined } = { for: keyOfMember(O.none()), stop: undefined }
      return registry.subscribe(
        memberKey,
        (now) => {
          if (now === on.for) return
          on.stop?.()
          on.for = now
          on.stop = now === "" ? undefined : what(registry)
        },
        { immediate: true }
      )
    }
  }
}
