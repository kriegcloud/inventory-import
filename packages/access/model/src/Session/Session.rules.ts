/**
 * The session as the browser is told it, and the two sentences for a request that acts as nobody.
 *
 * @packageDocumentation
 */
import {
  type AccountEmail,
  NoOrganization,
  type OrganizationChoice,
  Ready,
  type SessionState,
  SignedOut,
  type SignInFeatures
} from "@inventory/access-contract/SessionState"
import type { Member } from "@inventory/kernel/Member"
import type { Sentence } from "@inventory/kernel/Text"
import * as O from "effect/Option"

/** What is known of the person behind a request, for the session answer. */
export type SessionFacts = {
  /** The email of the signed-in account. None: nobody is signed in. */
  readonly email: O.Option<AccountEmail>
  /** The member they act as. None: in no organization yet, or no longer in the one they chose. */
  readonly actor: O.Option<Member>
  readonly organizations: ReadonlyArray<OrganizationChoice>
  readonly features: SignInFeatures
}

/**
 * The session answer: signed out with no email; signed in with no actor is "no-organization"; otherwise ready.
 *
 * @category rules
 */
export const sessionStateOf = (facts: SessionFacts): SessionState =>
  O.match(facts.email, {
    onNone: (): SessionState => SignedOut.make({ features: facts.features }),
    onSome: (email) =>
      O.match(facts.actor, {
        onNone: (): SessionState =>
          NoOrganization.make({ email, organizations: facts.organizations, features: facts.features }),
        onSome: (actor): SessionState =>
          Ready.make({ email, actor, organizations: facts.organizations, features: facts.features })
      })
  })

/** The sentence for a request with no session. */
export const signInSentence: Sentence = "Sign in to continue."

/**
 * Why a signed-in person acts as nobody: they chose no organization yet, or they were removed from the one they
 * chose. It never repeats a value the request sent.
 *
 * @category sentences
 */
export const noActorSentence = (choseAnOrganization: boolean): Sentence =>
  choseAnOrganization
    ? "You are no longer a member of that organization."
    : "You are signed in but not part of an organization yet."
