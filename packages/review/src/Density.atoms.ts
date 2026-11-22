// The table's row height, kept in this browser. Its own file, with no screen in it, so the rule is tested without one.
import * as S from "effect/Schema"
import * as Atom from "effect/reactivity/Atom"
import { keptRuntime } from "./internal/keptStore.ts"

/** 36 px rows, or 44 px with more air between them. */
export const Density = S.Literals(["compact", "comfortable"]).annotate({
  description: "The table's row height: compact (36 px) or comfortable (44 px)"
})
/** The decoded value of `Density`. */
export type Density = typeof Density.Type

/**
 * Compact (36 px rows) or comfortable (44 px), remembered in this browser: a preference, not progress. The atom is
 * the browser's own record of it (`Atom.kvs`): read from storage when first read, written there with every choice,
 * and held for the visit where the browser keeps nothing.
 */
export const density = Atom.kvs({
  runtime: keptRuntime,
  key: "review-density",
  schema: Density,
  defaultValue: (): Density => "compact"
})
