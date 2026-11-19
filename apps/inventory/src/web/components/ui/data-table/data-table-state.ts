// Replaces the part of nuqs the Dice UI data table used. Not part of the upstream component.
// The parsers keep nuqs's names and shapes, so data-table-config.ts and data-table-parsers.ts only change their
// import line, and `config.parse(search)` still reads a query string for a server that wants one. The table state
// lives in React state by default. Given `urlKeys` it lives in the address instead, as it does upstream, through
// the app's own router (`@/ui-kit/Route.hook`): a refresh, a copied link or the back button then land on the same page,
// order and filters, and a server-side table can read its query from the same address.
import * as React from "react";

import { navigate, useLocation } from "@/ui-kit/Route.hook";

interface ParserBase<T> {
  readonly serialize: (value: T) => string | string[];
  readonly eq: (a: T, b: T) => boolean;
}

export interface SingleParser<T> extends ParserBase<T> {
  readonly type: "single";
  readonly parse: (value: string) => T | null;
  readonly serialize: (value: T) => string;
  withDefault(defaultValue: NonNullable<T>): SingleParser<T> & { readonly defaultValue: NonNullable<T> };
}

export interface MultiParser<T> extends ParserBase<T> {
  readonly type: "multi";
  readonly parse: (values: readonly string[]) => T | null;
  readonly serialize: (value: T) => string[];
  withDefault(defaultValue: NonNullable<T>): MultiParser<T> & { readonly defaultValue: NonNullable<T> };
}

type AnyParser = SingleParser<any> | MultiParser<any>;

type ParserValue<P> = P extends { readonly defaultValue: infer D }
  ? D
  : P extends SingleParser<infer T> | MultiParser<infer T>
    ? T | null
    : never;

export type ParserValues<P extends Record<string, AnyParser>> = { [K in keyof P]: ParserValue<P[K]> };

type ParserUpdate<P extends Record<string, AnyParser>> = {
  [K in keyof P]?: ParserValue<P[K]> | null;
};

export type LoaderInput = string | URL | URLSearchParams | Record<string, string | string[] | undefined>;

const sameValue = <T>(a: T, b: T) => a === b;

export function createParser<T>(options: {
  parse: (value: string) => T | null;
  serialize: (value: T) => string;
  eq?: (a: T, b: T) => boolean;
}): SingleParser<T> {
  const parser: SingleParser<T> = {
    type: "single",
    parse: options.parse,
    serialize: options.serialize,
    eq: options.eq ?? sameValue,
    withDefault: (defaultValue) => ({ ...parser, defaultValue }),
  };
  return parser;
}

export const parseAsString = createParser<string>({ parse: (value) => value, serialize: String });

export const parseAsInteger = createParser<number>({
  parse: (value) => {
    const number = Number.parseInt(value, 10);
    return Number.isNaN(number) ? null : number;
  },
  serialize: (value) => Math.round(value).toFixed(),
});

export function parseAsStringEnum<const T extends string>(values: readonly T[]) {
  return createParser<T>({
    parse: (value) => values.find((item) => item === value) ?? null,
    serialize: String,
  });
}

/**
 * One query key repeated (`?status=a&status=b`), defaulting to `[]` as nuqs does. Items that parse to null are
 * dropped, and `?status=` alone reads as `[]`.
 */
export function parseAsNativeArrayOf<T>(item: SingleParser<T>) {
  const eq = (a: T[], b: T[]) => a.length === b.length && a.every((value, index) => item.eq(value, b[index] as T));
  const parser: MultiParser<T[]> = {
    type: "multi",
    parse: (values) => {
      const items = values.flatMap((value) => {
        const parsed = item.parse(value);
        return parsed === null ? [] : [parsed];
      });
      if (items.length > 0) return items;
      return values.length === 1 && values[0] === "" ? [] : null;
    },
    serialize: (value) => value.map(item.serialize),
    eq,
    withDefault: (defaultValue) => ({ ...parser, defaultValue }),
  };
  return parser.withDefault([]);
}

function toSearchParams(input: LoaderInput) {
  if (typeof input === "string") return new URLSearchParams(input.startsWith("?") ? input.slice(1) : input);
  if (input instanceof URL) return input.searchParams;
  if (input instanceof URLSearchParams) return input;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) {
    for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) params.append(key, item);
  }
  return params;
}

function readValue(parser: AnyParser, params: URLSearchParams, key: string): unknown {
  const parsed =
    parser.type === "multi"
      ? parser.parse(params.getAll(key))
      : params.has(key)
        ? parser.parse(params.get(key) ?? "")
        : null;
  return parsed ?? ("defaultValue" in parser ? parser.defaultValue : null);
}

/** Reads a query string with the same parsers, for a server that filters and sorts. */
export function createLoader<P extends Record<string, AnyParser>>(
  parsers: P,
  options: { urlKeys?: Partial<Record<keyof P, string>> } = {},
) {
  return (input: LoaderInput): ParserValues<P> => {
    const params = toSearchParams(input);
    const values: Record<string, unknown> = {};
    for (const key of Object.keys(parsers)) {
      const parser = parsers[key] as AnyParser;
      values[key] = readValue(parser, params, options.urlKeys?.[key] ?? key);
    }
    return values as ParserValues<P>;
  };
}

/**
 * The table's state, shaped like nuqs's `useQueryStates`: each key reads its parser's default until set, `null`
 * sets it back to the default. The third value lists the keys that are set, in the order they were first set (the
 * order of the keys in the address, when the state is kept there).
 *
 * Without `urlKeys` the state is React state. With them, each key is read from and written to the query string
 * under the name `urlKeys` gives it (the key itself when it gives none), replacing the address in place so a
 * change of page or sort does not pile up in the back button.
 */
export function useTableStates<P extends Record<string, AnyParser>>(
  parsers: P,
  options: { urlKeys?: Partial<Record<string, string>> | undefined } = {},
) {
  const { urlKeys } = options;
  const inUrl = urlKeys !== undefined;
  const { params } = useLocation();
  const [local, setLocal] = React.useState<Record<string, unknown>>({});
  // A value parsed from the address keeps its identity while its text is the same: the table compares state by
  // identity, and a new array for an unchanged sort would read as a change.
  const parsed = React.useRef(new Map<string, { raw: string; value: unknown }>());

  const state = React.useMemo(() => {
    if (!inUrl) return local;
    const keyOf = new Map(Object.keys(parsers).map((key) => [urlKeys[key] ?? key, key]));
    const next: Record<string, unknown> = {};
    for (const name of params.keys()) {
      const key = keyOf.get(name);
      if (key === undefined || Object.hasOwn(next, key)) continue;
      const parser = parsers[key] as AnyParser;
      const texts = params.getAll(name);
      const raw = JSON.stringify(texts);
      const known = parsed.current.get(key);
      const value =
        known?.raw === raw ? known.value : parser.type === "multi" ? parser.parse(texts) : parser.parse(texts[0] ?? "");
      parsed.current.set(key, { raw, value });
      // Text the parser cannot read is as good as absent: the default stands.
      if (value !== null) next[key] = value;
    }
    return next;
  }, [inUrl, local, params, parsers, urlKeys]);

  const setKeys = React.useMemo(() => Object.keys(state), [state]);

  const values = React.useMemo(() => {
    const next: Record<string, unknown> = {};
    for (const key of Object.keys(parsers)) {
      const parser = parsers[key] as AnyParser;
      next[key] = Object.hasOwn(state, key) ? state[key] : "defaultValue" in parser ? parser.defaultValue : null;
    }
    return next as ParserValues<P>;
  }, [parsers, state]);

  const setValues = React.useCallback(
    (update: ParserUpdate<P>) => {
      const isUnset = (parser: AnyParser, value: unknown) =>
        value === null || value === undefined || ("defaultValue" in parser && parser.eq(value, parser.defaultValue));

      if (urlKeys !== undefined) {
        // Read the address as it is now, not as it was at the last render: two updates in one tick (the filters,
        // then the page) must both land.
        const next = new URLSearchParams(window.location.search);
        for (const [key, value] of Object.entries(update)) {
          const parser = parsers[key] as AnyParser | undefined;
          if (parser === undefined) continue;
          const name = urlKeys[key] ?? key;
          next.delete(name);
          if (isUnset(parser, value)) continue;
          const text = parser.serialize(value) as string | string[];
          for (const item of Array.isArray(text) ? text : [text]) next.append(name, item);
        }
        const query = next.toString();
        navigate(`${window.location.pathname}${query === "" ? "" : `?${query}`}`, { replace: true });
        return;
      }

      setLocal((previous) => {
        const next = { ...previous };
        for (const [key, value] of Object.entries(update)) {
          const parser = parsers[key] as AnyParser | undefined;
          if (parser === undefined) continue;
          if (isUnset(parser, value)) {
            delete next[key];
          } else {
            next[key] = value;
          }
        }
        return next;
      });
    },
    [parsers, urlKeys],
  );

  return [values, setValues, setKeys] as const;
}
