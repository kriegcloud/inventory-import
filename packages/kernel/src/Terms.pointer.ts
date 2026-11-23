/**
 * The marks a record of this repository uses to say which term of the thread's vocabulary it stands for: the generic
 * makers of `@beep/vocabulary/Pointer`, bound to the registries derived from `Terms.vocab.ts`.
 *
 * Do not break: the vocabulary module is imported for its types only, so the value is erased from every file that
 * marks a record (decision 9). A name outside the registry a helper is bound to is a type error.
 *
 * @packageDocumentation
 */
import type { Curie } from "@beep/identity/Vocab"
import { noTermFor, pathFor, pointerFor } from "@beep/vocabulary/Pointer"
import type { InvClassVocab, InvConceptCurie, InvPropertyVocab, InvSchemeVocab } from "./Terms.vocab.ts"

/**
 * Points a record, or its subject's id field, at one class of the thread.
 *
 * @example aboutClass("inv:Member") // { term: "inv:Member" }
 */
export const aboutClass = pointerFor<InvClassVocab>()

/**
 * Points a field at one property of the thread: one triple, the subject, the property, the value.
 *
 * @example aboutProperty("inv:membershipIn") // { term: "inv:membershipIn" }
 */
export const aboutProperty = pointerFor<InvPropertyVocab>()

/**
 * Points a union of literals at one concept scheme of the thread: each literal is a notation of it.
 *
 * @example aboutScheme("inv:MemberRoleScheme") // { term: "inv:MemberRoleScheme" }
 */
export const aboutScheme = pointerFor<InvSchemeVocab>()

/**
 * Marks a field whose value is reached by a lift: node steps, then one value step, naming only the thread's classes,
 * properties and concepts.
 *
 * @example
 * aboutPath([
 *   { property: "inv:grantedTo", reverse: true, node: "inv:Grant",
 *     fixed: [{ property: "inv:grantScope", concept: "inv:GrantScopeKindScheme-organization" }] },
 *   { property: "inv:grantsRole" }
 * ])
 */
export const aboutPath = pathFor<Curie<InvClassVocab>, Curie<InvPropertyVocab>, InvConceptCurie>()

/**
 * Marks a position that stands for no term, for one of the closed reasons, or that the `party` slice will place.
 *
 * @example noTerm("deferred", "party") // { noTerm: { reason: "deferred", slice: "party" } }
 */
export const noTerm = noTermFor<"party">()
