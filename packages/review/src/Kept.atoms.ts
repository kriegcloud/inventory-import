// A value this browser keeps between visits, as an atom: for a screen's own small records beside the saved progress.
import type * as S from "effect/Schema"
import * as Atom from "effect/reactivity/Atom"
import { keptRuntime } from "./internal/keptStore.ts"

/**
 * One value kept in this browser under `key`, as its own record: read from storage when first read, written there
 * with every write, held for the visit where the browser keeps nothing. A value that is none is no entry at all.
 *
 * @example kept({ key: progressKey(scope), schema: S.OptionFromNullOr(Waiting), defaultValue: () => O.none() })
 */
export const kept = <Kept extends S.ConstraintCodec<any, any>>(options: {
  readonly key: string
  readonly schema: Kept
  readonly defaultValue: () => Kept["Type"]
}): Atom.Writable<Kept["Type"], Kept["Type"]> => Atom.kvs({ runtime: keptRuntime, ...options })
