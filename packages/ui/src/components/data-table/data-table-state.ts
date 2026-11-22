// Local change: moved from React's hooks to atoms (goals/atoms, "The kit on atoms", batch 1); no longer as its registry has it.
// Replaces the part of nuqs the Dice UI data table used. Not part of the upstream component.
// The parsers keep nuqs's names and shapes, so data-table-config.ts and data-table-parsers.ts only change their
// import line, and `config.parse(search)` still reads a query string for a server that wants one. The table state
// lives in an atom of the table's own by default. Given `urlKeys` it lives in the address instead, as it does
// upstream, through the app's own router (`@inventory/ui/Route`): a refresh, a copied link or the back button then
// land on the same page, order and filters, and a server-side table can read its query from the same address.
//
// The rule this file protects: a value worked out from the state keeps its identity while what it was worked out from
// does (the table compares its state by identity, and a new array for an unchanged sort would read as a change), and
// a handler reads the state as it is now, not as the last draw saw it, so two changes in one tick both land.
import { useAtom, useAtomValue } from "@effect/atom-react"
import * as MutableHashMap from "effect/MutableHashMap"
import * as O from "effect/Option"
import * as Atom from "effect/reactivity/Atom"
import type * as AtomRegistry from "effect/reactivity/AtomRegistry"
import { useId } from "react"

import { stringify } from "@inventory/ui/Json"
import { location, navigate } from "@inventory/ui/Route"

interface ParserBase<T> {
  readonly serialize: (value: T) => string | string[]
  readonly eq: (a: T, b: T) => boolean
}

export interface SingleParser<T> extends ParserBase<T> {
  readonly type: "single"
  readonly parse: (value: string) => T | null
  readonly serialize: (value: T) => string
  withDefault(defaultValue: NonNullable<T>): SingleParser<T> & { readonly defaultValue: NonNullable<T> }
}

export interface MultiParser<T> extends ParserBase<T> {
  readonly type: "multi"
  readonly parse: (values: readonly string[]) => T | null
  readonly serialize: (value: T) => string[]
  withDefault(defaultValue: NonNullable<T>): MultiParser<T> & { readonly defaultValue: NonNullable<T> }
}

type AnyParser = SingleParser<any> | MultiParser<any>

type ParserValue<P> = P extends { readonly defaultValue: infer D }
  ? D
  : P extends SingleParser<infer T> | MultiParser<infer T>
    ? T | null
    : never

export type ParserValues<P extends Record<string, AnyParser>> = { [K in keyof P]: ParserValue<P[K]> }

export type ParserUpdate<P extends Record<string, AnyParser>> = {
  [K in keyof P]?: ParserValue<P[K]> | null
}

export type LoaderInput = string | URL | URLSearchParams | Record<string, string | string[] | undefined>

const sameValue = <T>(a: T, b: T) => a === b

export function createParser<T>(options: {
  parse: (value: string) => T | null
  serialize: (value: T) => string
  eq?: (a: T, b: T) => boolean
}): SingleParser<T> {
  const parser: SingleParser<T> = {
    type: "single",
    parse: options.parse,
    serialize: options.serialize,
    eq: options.eq ?? sameValue,
    withDefault: (defaultValue) => ({ ...parser, defaultValue })
  }
  return parser
}

export const parseAsString = createParser<string>({ parse: (value) => value, serialize: String })

export const parseAsInteger = createParser<number>({
  parse: (value) => {
    const number = Number.parseInt(value, 10)
    return Number.isNaN(number) ? null : number
  },
  serialize: (value) => Math.round(value).toFixed()
})

export function parseAsStringEnum<const T extends string>(values: readonly T[]) {
  return createParser<T>({
    parse: (value) => values.find((item) => item === value) ?? null,
    serialize: String
  })
}

/**
 * One query key repeated (`?status=a&status=b`), defaulting to `[]` as nuqs does. Items that parse to null are
 * dropped, and `?status=` alone reads as `[]`.
 */
export function parseAsNativeArrayOf<T>(item: SingleParser<T>) {
  const eq = (a: T[], b: T[]) => a.length === b.length && a.every((value, index) => item.eq(value, b[index] as T))
  const parser: MultiParser<T[]> = {
    type: "multi",
    parse: (values) => {
      const items = values.flatMap((value) => {
        const parsed = item.parse(value)
        return parsed === null ? [] : [parsed]
      })
      if (items.length > 0) return items
      return values.length === 1 && values[0] === "" ? [] : null
    },
    serialize: (value) => value.map(item.serialize),
    eq,
    withDefault: (defaultValue) => ({ ...parser, defaultValue })
  }
  return parser.withDefault([])
}

function toSearchParams(input: LoaderInput) {
  if (typeof input === "string") return new URLSearchParams(input.startsWith("?") ? input.slice(1) : input)
  if (input instanceof URL) return input.searchParams
  if (input instanceof URLSearchParams) return input
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(input)) {
    for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) params.append(key, item)
  }
  return params
}

function readValue(parser: AnyParser, params: URLSearchParams, key: string): unknown {
  const parsed =
    parser.type === "multi"
      ? parser.parse(params.getAll(key))
      : params.has(key)
        ? parser.parse(params.get(key) ?? "")
        : null
  return parsed ?? ("defaultValue" in parser ? parser.defaultValue : null)
}

/** Reads a query string with the same parsers, for a server that filters and sorts. */
export function createLoader<P extends Record<string, AnyParser>>(
  parsers: P,
  options: { urlKeys?: Partial<Record<keyof P, string>> } = {}
) {
  return (input: LoaderInput): ParserValues<P> => {
    const params = toSearchParams(input)
    const values: Record<string, unknown> = {}
    for (const key of Object.keys(parsers)) {
      const parser = parsers[key] as AnyParser
      values[key] = readValue(parser, params, options.urlKeys?.[key] ?? key)
    }
    return values as ParserValues<P>
  }
}

/** The state as it is kept: the keys that are set, in the order they were first set, with their parsed values. */
export type TableStateRecord = Readonly<Record<string, unknown>>

const nothingSet: TableStateRecord = {}

/**
 * The registry the table's atoms live in, read as an atom: a handler reads what is there now through it, where a draw
 * only has what was there when it was drawn.
 */
export const atomRegistry: Atom.Atom<AtomRegistry.AtomRegistry> = Atom.readable((get) => get.registry)

/** The state of one table on screen that is not kept in the address, made for each instance (its `useId`). */
export const localTableState = Atom.family((_instance: string) => Atom.make<TableStateRecord>(nothingSet))

/**
 * One pending timer for one component on screen: starting it again replaces the one waiting, and it is cleared when
 * the component leaves the screen (the atom's finalizer), so nothing fires for a component that is gone.
 */
export interface OneTimer {
  readonly start: (run: () => void, ms: number) => void
  readonly cancel: () => void
}

/**
 * A component's `OneTimer`, made for each instance (its `useId`); read it with `useAtomValue` to keep it mounted. It is
 * let go the moment nobody reads it, whatever time the registry keeps an unread atom for: what waits is cancelled when
 * the component leaves the screen. While the component is still drawn it runs, also after the address has changed: a
 * page whose code is still loading keeps the one before it drawn (DECISIONS.md, "Known wrong or missing").
 */
export const oneTimer = Atom.family((_instance: string) =>
  Atom.readable((get): OneTimer => {
    let waiting: ReturnType<typeof setTimeout> | undefined
    const cancel = () => {
      if (waiting !== undefined) clearTimeout(waiting)
      waiting = undefined
    }
    get.addFinalizer(cancel)
    return {
      start: (run, ms) => {
        cancel()
        waiting = setTimeout(() => {
          waiting = undefined
          run()
        }, ms)
      },
      cancel
    }
  }).pipe(Atom.setIdleTTL(0))
)

/** What two number boxes hold while typed into: each box's text, or null for the value it shows from the filter. */
export interface BoundsDraft {
  readonly drafts: readonly [string | null, string | null]
  readonly showInvalid: boolean
}

const noBoundsDraft: BoundsDraft = { drafts: [null, null], showInvalid: false }

/** The two number boxes of one range filter on screen, made for each instance (its `useId`). */
export const boundsDraft = Atom.family((_instance: string) => Atom.make<BoundsDraft>(noBoundsDraft))

// A value parsed from the address keeps its identity while its text is the same: the last text and value per parser.
const lastParsed = new WeakMap<AnyParser, { readonly raw: string; readonly value: unknown }>()

function parseKept(parser: AnyParser, texts: readonly string[]): unknown {
  const raw = stringify(texts)
  const known = lastParsed.get(parser)
  if (known !== undefined && known.raw === raw) return known.value
  const value = parser.type === "multi" ? parser.parse(texts) : parser.parse(texts[0] ?? "")
  lastParsed.set(parser, { raw, value })
  return value
}

// The state read from one address with one set of parsers, kept while the address is the same object.
const fromAddress = new WeakMap<URLSearchParams, WeakMap<object, WeakMap<object, TableStateRecord>>>()

/** The keys of `parsers` that are set in the address, in the address's order, with their parsed values. */
export function tableStateFromAddress(
  parsers: Record<string, AnyParser>,
  urlKeys: Partial<Record<string, string>>,
  params: URLSearchParams
): TableStateRecord {
  const byParsers = fromAddress.get(params) ?? new WeakMap<object, WeakMap<object, TableStateRecord>>()
  fromAddress.set(params, byParsers)
  const byKeys = byParsers.get(parsers) ?? new WeakMap<object, TableStateRecord>()
  byParsers.set(parsers, byKeys)
  const kept = byKeys.get(urlKeys)
  if (kept !== undefined) return kept

  const keyOf = MutableHashMap.empty<string, string>()
  for (const key of Object.keys(parsers)) MutableHashMap.set(keyOf, urlKeys[key] ?? key, key)
  const next: Record<string, unknown> = {}
  for (const name of params.keys()) {
    const key = O.getOrUndefined(MutableHashMap.get(keyOf, name))
    if (key === undefined || Object.hasOwn(next, key)) continue
    const value = parseKept(parsers[key] as AnyParser, params.getAll(name))
    // Text the parser cannot read is as good as absent: the default stands.
    if (value !== null) next[key] = value
  }
  byKeys.set(urlKeys, next)
  return next
}

const valuesKept = new WeakMap<TableStateRecord, WeakMap<object, unknown>>()

/** Every key of `parsers`: its value where it is set, its parser's default (or null) where it is not. */
export function tableStateValues<P extends Record<string, AnyParser>>(
  parsers: P,
  state: TableStateRecord
): ParserValues<P> {
  const byParsers = valuesKept.get(state) ?? new WeakMap<object, unknown>()
  valuesKept.set(state, byParsers)
  const kept = byParsers.get(parsers)
  if (kept !== undefined) return kept as ParserValues<P>
  const next: Record<string, unknown> = {}
  for (const key of Object.keys(parsers)) {
    const parser = parsers[key] as AnyParser
    next[key] = Object.hasOwn(state, key) ? state[key] : "defaultValue" in parser ? parser.defaultValue : null
  }
  byParsers.set(parsers, next)
  return next as ParserValues<P>
}

const keysKept = new WeakMap<TableStateRecord, string[]>()

/** The keys that are set, in the order they were first set. */
export function tableStateKeys(state: TableStateRecord): string[] {
  const kept = keysKept.get(state)
  if (kept !== undefined) return kept
  const keys = Object.keys(state)
  keysKept.set(state, keys)
  return keys
}

function isUnset(parser: AnyParser, value: unknown) {
  return value === null || value === undefined || ("defaultValue" in parser && parser.eq(value, parser.defaultValue))
}

/** The state kept here after `update`: `null`, or a parser's default, takes a key out. */
export function updateTableState<P extends Record<string, AnyParser>>(
  parsers: P,
  previous: TableStateRecord,
  update: ParserUpdate<P>
): TableStateRecord {
  const next: Record<string, unknown> = { ...previous }
  for (const [key, value] of Object.entries(update)) {
    const parser = parsers[key] as AnyParser | undefined
    if (parser === undefined) continue
    if (isUnset(parser, value)) {
      delete next[key]
    } else {
      next[key] = value
    }
  }
  return next
}

/**
 * Writes `update` into the address under the names `urlKeys` gives, replacing the address in place so a change of
 * page or sort does not pile up in the back button. It reads the address as it is now, not as it was at the last
 * draw: two updates in one tick (the filters, then the page) both land.
 */
export function writeTableState<P extends Record<string, AnyParser>>(
  parsers: P,
  urlKeys: Partial<Record<string, string>>,
  update: ParserUpdate<P>
): void {
  const next = new URLSearchParams(window.location.search)
  for (const [key, value] of Object.entries(update)) {
    const parser = parsers[key] as AnyParser | undefined
    if (parser === undefined) continue
    const name = urlKeys[key] ?? key
    next.delete(name)
    if (isUnset(parser, value)) continue
    const text = parser.serialize(value) as string | string[]
    for (const item of Array.isArray(text) ? text : [text]) next.append(name, item)
  }
  const query = next.toString()
  navigate(`${window.location.pathname}${query === "" ? "" : `?${query}`}`, { replace: true })
}

/**
 * The table's state, shaped like nuqs's `useQueryStates`: each key reads its parser's default until set, `null`
 * sets it back to the default. The third value lists the keys that are set, in the order they were first set (the
 * order of the keys in the address, when the state is kept there). The fourth reads the first and third as they are
 * now, for a handler that runs before the next draw.
 *
 * Without `urlKeys` the state is an atom of this instance's own. With them, each key is read from and written to the
 * query string under the name `urlKeys` gives it (the key itself when it gives none).
 */
export function useTableStates<P extends Record<string, AnyParser>>(
  parsers: P,
  options: { urlKeys?: Partial<Record<string, string>> | undefined } = {}
) {
  const { urlKeys } = options
  const local = localTableState(useId())
  const registry = useAtomValue(atomRegistry)
  const [kept, setKept] = useAtom(local)
  const { params } = useAtomValue(location)

  const stateOf = (keptNow: TableStateRecord, paramsNow: URLSearchParams) =>
    urlKeys === undefined ? keptNow : tableStateFromAddress(parsers, urlKeys, paramsNow)
  const state = stateOf(kept, params)

  const setValues = (update: ParserUpdate<P>) => {
    if (urlKeys !== undefined) {
      writeTableState(parsers, urlKeys, update)
      return
    }
    setKept((previous) => updateTableState(parsers, previous, update))
  }

  const now = () => {
    const current = stateOf(registry.get(local), registry.get(location).params)
    return { values: tableStateValues(parsers, current), setKeys: tableStateKeys(current) }
  }

  return [tableStateValues(parsers, state), setValues, tableStateKeys(state), now] as const
}
