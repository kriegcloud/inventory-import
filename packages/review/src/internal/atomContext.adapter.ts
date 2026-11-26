import type * as Atom from "effect/reactivity/Atom"
import * as O from "effect/Option"

/** AtomContext has no previous value on its first read; subsequent reads retain that exact value. */
export const AtomContext = {
  previous: <T>(get: Atom.AtomContext, initial: () => T): T => O.getOrElse(get.self<T>(), initial)
}
