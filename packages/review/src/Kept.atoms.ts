// A value this browser keeps between visits, as an atom: for a screen's own small records beside the saved progress.
import * as HashSet from "effect/HashSet"
import type * as S from "effect/Schema"
import * as Atom from "effect/reactivity/Atom"
import { keptRuntime, refusedKeys } from "./internal/keptStore.ts"

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

/**
 * True while the browser refused the last write of `key` (a private window that keeps nothing, a full disk): what was
 * written is held for this visit only, and is lost once the page is closed or loaded again. A screen that would say a
 * value is kept in this browser says this instead.
 */
export const keptRefused = Atom.family((key: string) => Atom.map(refusedKeys, (refused) => HashSet.has(refused, key)))
