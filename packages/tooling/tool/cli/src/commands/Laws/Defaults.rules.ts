/**
 * Absence, starting values and clean-ups are settled by a schema, where a value enters or where its type is declared,
 * never by the code that uses it (Benjamin's standing rule; `docs/standards/schema-first.md`, SF-3 to SF-5). A
 * fallback written at a call site is a rule nobody can find, and two call sites can disagree about it.
 *
 * What is counted, each by how it is written and by nothing else (`internal/defaultsCode.ts`): a fallback (`??`, `??=`,
 * `||` and `||=` before a value written out, `getOrElse`, and outside a `.tsx` file a default given to a parameter or
 * a destructured name, an `onNone` arrow returning a number, empty string/array/object, null or undefined in
 * contract/model/host, and direct or piped `Result.getOrThrow`/`Effect.runSync` calls in src outside tests), a comparison
 * with `null` or `undefined`,
 * a test if/ternary guarded by Option/Result/Exit, an unwrapped `S.optionalKey` in contract/model/host, an Option turned
 * back into a missing value (`getOrUndefined`, `getOrNull`), and a trim or a change of case that is not
 * `SchemaGetter`'s or `SchemaTransformation`'s. The law does not judge whether a place is "really" a default: a law
 * that judges is argued with, and one that reads types costs the whole program on every run.
 *
 * The tree had about 2,000 such places when the law was written (`getOrElse` and `||` were counted a commit later, with
 * a baseline written anew, since without them a refused `x ?? 0` was written again as `O.getOrElse(x, () => 0)`), so it
 * holds a baseline (`defaults-baseline.json` at the root): for each file, how many of each kind it may hold. A file
 * with more than its baseline fails, and a file the baseline does not name may hold none. A file with fewer never
 * fails: `--write` lowers the baseline to what the tree holds, and never raises it (the first one, with no baseline
 * file yet, records the tree as it stands, and so does the first after the reader counts more: the baseline says in
 * `reads` what it was written for). So nobody is asked to clean a file to finish other work, nobody can add a place,
 * and the numbers only fall. A run over the whole tree also holds the baseline against main's, as the bans hold their
 * ledgers (`internal/ledger.ts`): a file main's does not name, or a count above main's, is refused, so a commit that
 * raises the baseline beside the code cannot pass. Main's baseline written for a reader that counted less says nothing
 * of what this one counts, so then each line is held to what this reader finds in the file's code on main instead:
 * code nobody changed passes, and a place written since is still refused. The law is done when the baseline is empty
 * and is deleted.
 *
 * Given files, it parses only those and leaves the baseline's comparison to the run over the whole tree: git's lists
 * still cover the tree, but the run takes under half a second, most of it starting bun, so the same law can answer the
 * moment a file is edited (`.claude/hooks/defaults.sh`) as well as before a commit. Where a file is over, the places
 * said are the ones its committed version does not have, so the line just written is the line named.
 *
 * A place that is where the rule wants it is not left in the baseline to be argued over: its file is named in
 * `exemptions` with the kinds and the reason, and those kinds are not counted there. So the baseline can still reach
 * empty, what stays on purpose is read in one list, and the same code in any other file is still refused. A file an
 * exemption names that is not there fails the run over the whole tree.
 *
 * Left alone: the vendored kit and components, `.agents`, the scratchpad and `packages/tooling` (this package reads
 * arguments and files, not the business's data).
 */
import { $RepoCliId } from "@beep/identity/packages"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import { identity } from "effect/Function"
import * as O from "effect/Option"
import * as Order from "effect/Order"
import * as R from "effect/Record"
import * as Result from "effect/Result"
import * as S from "effect/Schema"
import * as Str from "effect/String"
import { Repo } from "../../Repo.service.ts"
import { scratchpadFolder } from "../../Repo.schema.ts"
import { err, type Line, out } from "../../Report.schema.ts"
import { DefaultsKind, type DefaultsPlace, readDefaults, whatIsCounted } from "./internal/defaultsCode.ts"
import { type AtBase, atBase } from "./internal/ledger.ts"

const $I = $RepoCliId.create("commands/Laws/Defaults.rules")

/** The file the baseline is kept in, from the root. */
export const baselineFile = "defaults-baseline.json"

/** The order the baseline writes a file's four counts in. */
const kinds: ReadonlyArray<DefaultsKind> = ["fallback", "absence", "unwrap", "normalise"]

/** One file whose places of some kinds are where the rule wants them, and why. */
export interface DefaultsExemption {
  readonly file: string
  readonly kinds: ReadonlyArray<DefaultsKind>
  readonly why: string
}

/**
 * The files that keep places on purpose. A cell of a file the person reviews is read by a small function that returns
 * a value or a reason, and its trim or change of case is a proposal shown as before and after, never a silent decode
 * (Benjamin, 2026-11-23: cells keep their readers; no schema decodes a cell to a clean value). Code that reads a cell
 * lives in a file named here, and nowhere else.
 */
export const exemptions: ReadonlyArray<DefaultsExemption> = [
  {
    file: "packages/ui/src/Json.codec.ts",
    kinds: ["fallback"],
    why: "stringify is the synchronous edge a component's draw needs; its Effect.runSync encodes a value the codec cannot refuse (Benjamin, 2026-11-26)"
  },
  {
    file: "packages/client/src/Api.atoms.ts",
    kinds: ["fallback"],
    why: "The one Reactivity is made at module level, where atoms are made; its Effect.runSync runs an Effect that cannot fail (Benjamin, 2026-11-26)"
  },
  {
    file: "packages/foundation/modeling/xlsx/src/Xlsx.codec.ts",
    kinds: ["fallback"],
    why: "The workbook writer is the synchronous edge a download needs; its Effect.runSync is the codec's own run (Benjamin, 2026-11-26)"
  },
  {
    file: "packages/review/src/internal/atomContext.adapter.ts",
    kinds: ["fallback"],
    why: "AtomContext.get.self has no prior value on its first read; each owner supplies the exact original initial value (Benjamin, 2026-11-26)"
  },
  {
    file: "packages/review/src/internal/tanstackTable.adapter.ts",
    kinds: ["fallback"],
    why: "TanStack leaf columns can be empty; the hook copy then retains the supplied table as its owner (Benjamin, 2026-11-26)"
  },
  {
    file: "packages/review/src/internal/tanstackVirtual.adapter.ts",
    kinds: ["fallback", "unwrap"],
    why: "TanStack virtual items may be empty while counts catch up, and getScrollElement explicitly requires a nullable DOM element (Benjamin, 2026-11-26)"
  },
  {
    file: "packages/catalog/web/src/internal/dataTable.adapter.ts",
    kinds: ["fallback"],
    why: "The vendored table hook requires numeric pageCount zero until the server supplies its first answer (Benjamin, 2026-11-26)"
  },
  {
    file: "packages/catalog/web/test/support/webLocks.adapter.ts",
    kinds: ["fallback"],
    why: "The browser Web Locks API specifies exclusive mode when request options omit mode (Benjamin, 2026-11-26)"
  },

  {
    file: "packages/ui/test/support/Storage.twin.ts",
    kinds: ["fallback"],
    why: "Browser Storage.getItem returns null for any missing key; this test twin shares that browser API boundary across all test pages (Benjamin, 2026-11-26)"
  },
  {
    file: "packages/access/host/src/internal/authOptions.ts",
    kinds: ["absence"],
    why: "Better Auth's own API: its session hook passes a null context and wants undefined back when there is nothing to change (Benjamin, 2026-11-26)"
  },
  {
    file: "packages/access/web/src/Session.atoms.ts",
    kinds: ["absence"],
    why: "the browser's own API: window and document are undefined where no page is (Benjamin, 2026-11-26)"
  },
  {
    file: "packages/foundation/modeling/csv/src/internal/encoding.ts",
    kinds: ["fallback"],
    why: "a reader of a file's bytes and markup: an Option for each byte, capture or position would cost the loop that reads every cell (Benjamin, 2026-11-26)"
  },
  {
    file: "packages/foundation/modeling/csv/src/internal/header.ts",
    kinds: ["fallback"],
    why: "a reader of a file's bytes and markup: an Option for each byte, capture or position would cost the loop that reads every cell (Benjamin, 2026-11-26)"
  },
  {
    file: "packages/foundation/modeling/csv/src/internal/machine.ts",
    kinds: ["absence", "normalise"],
    why: "a reader of a file's bytes and markup: an Option for each byte, capture or position would cost the loop that reads every cell (Benjamin, 2026-11-26)"
  },
  {
    file: "packages/foundation/modeling/csv/src/internal/sniff.ts",
    kinds: ["absence"],
    why: "a reader of a file's bytes and markup: an Option for each byte, capture or position would cost the loop that reads every cell (Benjamin, 2026-11-26)"
  },
  {
    file: "packages/foundation/modeling/xlsx/src/internal/container.ts",
    kinds: ["fallback"],
    why: "a reader of a file's bytes and markup: an Option for each byte, capture or position would cost the loop that reads every cell (Benjamin, 2026-11-26)"
  },
  {
    file: "packages/foundation/modeling/xlsx/src/internal/formula.ts",
    kinds: ["fallback"],
    why: "a reader of a file's bytes and markup: an Option for each byte, capture or position would cost the loop that reads every cell (Benjamin, 2026-11-26)"
  },
  {
    file: "packages/foundation/modeling/xlsx/src/internal/numberFormat.ts",
    kinds: ["fallback", "absence", "normalise"],
    why: "a reader of a file's bytes and markup: an Option for each byte, capture or position would cost the loop that reads every cell (Benjamin, 2026-11-26)"
  },
  {
    file: "packages/foundation/modeling/xlsx/src/internal/ooxml.ts",
    kinds: ["fallback", "absence"],
    why: "a reader of a file's bytes and markup: an Option for each byte, capture or position would cost the loop that reads every cell (Benjamin, 2026-11-26)"
  },
  {
    file: "packages/foundation/modeling/xlsx/src/internal/sheet.ts",
    kinds: ["fallback", "absence", "normalise"],
    why: "a reader of a file's bytes and markup: an Option for each byte, capture or position would cost the loop that reads every cell (Benjamin, 2026-11-26)"
  },
  {
    file: "packages/foundation/modeling/xlsx/src/internal/workbookPart.ts",
    kinds: ["fallback", "absence", "normalise"],
    why: "a reader of a file's bytes and markup: an Option for each byte, capture or position would cost the loop that reads every cell (Benjamin, 2026-11-26)"
  },
  {
    file: "packages/foundation/modeling/xlsx/src/internal/writer.ts",
    kinds: ["fallback", "absence", "normalise"],
    why: "a reader of a file's bytes and markup: an Option for each byte, capture or position would cost the loop that reads every cell (Benjamin, 2026-11-26)"
  },
  {
    file: "packages/catalog/model/src/Reading/Spreadsheet.rules.ts",
    kinds: ["absence"],
    why: "Cell.shown and Cell.formula stay keys left out because the table crosses the worker by postMessage, where an Option loses its prototype; shownOf and formulaOf read them as Options (Benjamin, 2026-11-25)"
  },
  {
    file: "packages/catalog/model/src/Review/CellReading.rules.ts",
    kinds: ["normalise"],
    why: "a file cell's reader: its clean-up is a proposal the person sees as before and after"
  },
  {
    file: "packages/catalog/model/src/Review/CellRules.rules.ts",
    kinds: ["normalise"],
    why: "the text a file cell gives the review: its trim is a proposal the person sees as before and after (Benjamin, 2026-11-23)"
  },
  {
    file: "packages/catalog/web/src/internal/CellForms.tsx",
    kinds: ["normalise"],
    why: "the repair box of a reviewed cell: the trim reads what the person typed over the file's value, shown as before and after (Benjamin, 2026-11-26)"
  },
  {
    file: "packages/catalog/web/src/internal/itemText.ts",
    kinds: ["normalise"],
    why: "how a reviewed cell's number, vendors and tags are shown: the trim is for display of the file's own text (Benjamin, 2026-11-26)"
  },
  {
    file: "packages/catalog/web/src/internal/WhyFlagged.tsx",
    kinds: ["normalise"],
    why: "the file's own name and SKU shown beside why a row was flagged: the trim is for display of a reviewed cell (Benjamin, 2026-11-26)"
  },
  {
    file: "packages/catalog/web/src/internal/cellDrafts.ts",
    kinds: ["normalise"],
    why: "the reader of what the person typed into a reviewed cell's repair box (Benjamin, 2026-11-26)"
  },
  {
    file: "packages/catalog/web/src/internal/format.tsx",
    kinds: ["normalise"],
    why: "a reviewed cell's whitespace made visible: the trim tells a value with spaces from one without (Benjamin, 2026-11-26)"
  },
  {
    file: "packages/client/src/Storage.browser.ts",
    kinds: ["absence"],
    why: "the browser's edge for client: Storage, the window and Web Locks hand back null or undefined, read here once and passed on as Options (Benjamin, 2026-11-26)"
  },
  {
    file: "packages/catalog/web/src/internal/browser.ts",
    kinds: ["absence"],
    why: "the browser's edge for catalog/web: DOM queries, a ref's current, a dataset, URL parameters and dropped files, read here once and passed on as Options (Benjamin, 2026-11-26)"
  },
  {
    file: "packages/review/src/internal/browser.ts",
    kinds: ["absence"],
    why: "the browser's edge for the review region, which may not import client: Storage, IndexedDB and DOM queries, read here once and passed on as Options (Benjamin, 2026-11-26)"
  },
  {
    file: "packages/ui/src/internal/browser.ts",
    kinds: ["absence"],
    why: "the browser's edge for ui: whether a dialog owns a keyboard event, read from the DOM here once (Benjamin, 2026-11-26)"
  },
  {
    file: "packages/catalog/contract/src/Item/SkuKey.rules.ts",
    kinds: ["normalise"],
    why: "the key two rows are compared by, never shown as a fix; pure callers need it at once, and a schema decode would need S.decodeSync (Benjamin, 2026-11-23)"
  },
  {
    file: "packages/catalog/model/src/Assistant/TableView.rules.ts",
    kinds: ["normalise"],
    why: "the table assistant's words: compares words or headings the person typed or the file holds, never storing the cleaned text; a decode would leave an Option with no meaning to fall back from (Benjamin, 2026-11-23)"
  },
  {
    file: "packages/catalog/model/src/Item/ItemSearch.rules.ts",
    kinds: ["normalise"],
    why: "the search's words: compares words or headings the person typed or the file holds, never storing the cleaned text; a decode would leave an Option with no meaning to fall back from (Benjamin, 2026-11-23)"
  },
  {
    file: "packages/catalog/model/src/Catalog.memory.ts",
    kinds: ["normalise"],
    why: "the in-memory twin's search and filters, as the D1 adapter reads them: compares words or headings the person typed or the file holds, never storing the cleaned text; a decode would leave an Option with no meaning to fall back from (Benjamin, 2026-11-23)"
  },
  {
    file: "packages/catalog/model/src/Reading/SheetLayout.rules.ts",
    kinds: ["normalise"],
    why: "a sheet's header cells, read to find the header row: compares words or headings the person typed or the file holds, never storing the cleaned text; a decode would leave an Option with no meaning to fall back from (Benjamin, 2026-11-23)"
  },
  {
    file: "packages/catalog/model/src/Review/Mapping.rules.ts",
    kinds: ["normalise"],
    why: "a heading's key, matched to a field ignoring case, spaces and punctuation: compares words or headings the person typed or the file holds, never storing the cleaned text; a decode would leave an Option with no meaning to fall back from (Benjamin, 2026-11-23)"
  }
]

const Count = S.Int.check(S.isGreaterThanOrEqualTo(0))

/** How many places of each kind one file may hold, in the order of `counts`. */
const Held = S.Tuple([Count, Count, Count, Count])
type Held = typeof Held.Type
const none: Held = [0, 0, 0, 0]

/**
 * The baseline as it is stored. A file it does not name holds nothing, which is the state every file ends in.
 */
export const DefaultsBaseline = S.Struct({
  counts: S.Tuple([S.tag("fallback"), S.tag("absence"), S.tag("unwrap"), S.tag("normalise")]).pipe(
    S.annotateKey({ description: "What the four numbers of a file count, in order" })
  ),
  reads: S.Array(S.String).pipe(
    S.annotateKey({
      description: "What the reader counted when this was written. One written for less is written anew, not raised"
    }),
    S.withDecodingDefaultTypeKey(Effect.succeed([]))
  ),
  files: S.Record(S.String, Held).pipe(
    S.annotateKey({ description: "Each file that still holds a place, from the root, with its four counts" }),
    S.withDecodingDefaultTypeKey(Effect.succeed({}))
  )
}).pipe(
  $I.annoteSchema("DefaultsBaseline", {
    description: "For each file, how many fallbacks, absence checks, unwraps and clean-ups it may still hold"
  })
)

/** The decoded value of `DefaultsBaseline`. */
export type DefaultsBaseline = typeof DefaultsBaseline.Type

// Whether a baseline was written for what the reader counts now.
const readsAsNow = (reads: ReadonlyArray<string>): boolean => A.join(reads, "\n") === A.join(whatIsCounted, "\n")

const ownCode = A.appendAll(
  A.map(
    [
      "apps/*/src/**/*.ts",
      "apps/*/src/**/*.tsx",
      "apps/*/test/**/*.ts",
      "apps/*/test/**/*.tsx",
      "packages/**/src/**/*.ts",
      "packages/**/src/**/*.tsx",
      "packages/**/test/**/*.ts",
      "packages/**/test/**/*.tsx",
      "packages/client/**/*.ts",
      "packages/client/**/*.tsx",
      "packages/review/**/*.ts",
      "packages/review/**/*.tsx",
      "packages/ui/**/*.ts",
      "packages/ui/**/*.tsx"
    ],
    (pattern) => `:(glob)${pattern}`
  ),
  [
    ":!packages/ui/src/components",
    ":!packages/ui/src/hooks",
    ":!packages/tooling",
    ":!.agents",
    `:!${scratchpadFolder}`
  ]
)

/**
 * What the law says: the tree holds to the baseline, the baseline was lowered, or each file that holds more than it
 * may with the places to change.
 */
export const DefaultsFinding = S.TaggedUnion({
  Clean: {
    files: S.Int.pipe(S.annotateKey({ description: "How many files were read" })),
    held: Held.pipe(S.annotateKey({ description: "The places the files read still hold, by kind" }))
  },
  Below: { files: S.Int.pipe(S.annotateKey({ description: "How many files hold fewer places than their baseline" })) },
  Wrote: { files: S.Int.pipe(S.annotateKey({ description: "How many files the baseline names now" })) },
  NoWrite: {},
  Refused: {
    broken: S.Boolean.pipe(
      S.annotateKey({ description: "Whether a file holds too many places, or only the baseline or git's list fails" })
    )
  },
  Ledger: {
    said: S.String.pipe(S.annotateKey({ description: "What the baseline says against the files and against main's" })),
    grew: S.Boolean.pipe(
      S.annotateKey({ description: "Whether a count rose or a file was added, which is code that breaks the rule" })
    )
  },
  Unlisted: { why: S.String.pipe(S.annotateKey({ description: "What git said when it could not list the files" })) },
  Unread: {
    file: S.String.pipe(S.annotateKey({ description: "The file the parser refused" })),
    why: S.String.pipe(S.annotateKey({ description: "What the parser said" }))
  },
  Over: {
    file: S.String.pipe(S.annotateKey({ description: "The file, from the root" })),
    kind: DefaultsKind.pipe(S.annotateKey({ description: "The kind it holds too many of" })),
    now: S.Int.pipe(S.annotateKey({ description: "How many it holds" })),
    may: S.Int.pipe(S.annotateKey({ description: "How many its baseline allows" })),
    test: S.Boolean.pipe(S.annotateKey({ description: "Whether the file is a test, which is told another remedy" }))
  },
  At: {
    place: S.String.pipe(S.annotateKey({ description: "The file and line, as file:line" })),
    code: S.String.pipe(S.annotateKey({ description: "The code at that place" }))
  }
}).pipe(
  $I.annoteSchema("DefaultsFinding", {
    description: "The tree holds to the defaults baseline, or each file over it and the places to change"
  })
)

/** The decoded value of `DefaultsFinding`. */
export type DefaultsFinding = typeof DefaultsFinding.Type

/** What to write instead, for each kind: the line an agent reads the moment it wrote the place. */
const remedy: Readonly<Record<DefaultsKind, string>> = {
  fallback:
    "a `??`, a `||` before a value, a getOrElse, a zero-argument synchronous onNone expression arrow returning a number, empty string/array/object, null or undefined in contract/model/host, a Result.getOrThrow or Effect.runSync call in src outside tests, or a default on a parameter or a destructured name supplies a value the type should already hold. Put the starting value on the schema (S.withConstructorDefault, S.withDecodingDefaultTypeKey), or decode the absence to an Option where the value enters and O.match it where it is drawn, both cases said (SF-5)",
  absence:
    "a comparison with null or undefined, or an unwrapped S.optionalKey in contract/model/host. Give the optional key an OptionFrom*, a decoding default, absentAsNone or emptyWhenLeftOut wrapper. Decode the value where it enters (S.OptionFromOptionalKey, S.OptionFromNullOr, S.OptionFromNullishOr), then O.match, O.map or O.isSome; if it tells two cases apart, the type is a tagged union (SF-4, SF-6)",
  unwrap:
    "O.getOrUndefined or O.getOrNull turns an Option back into a missing value. Keep the Option and O.match it where it is used",
  normalise:
    "a trim or a change of case in code. Make it a transformation on the schema (S.decodeTo with SchemaTransformation.trim(), SchemaGetter.toUpperCase()), so the decoded type is already clean (SF-3)"
}
const testRemedy: Readonly<Record<DefaultsKind, string>> = {
  ...remedy,
  fallback:
    "a `??` or a getOrElse in a test hides a value that is missing. Narrow with assertSome, assertDefined or assertSuccess from @effect/vitest/utils, which fail with the value",
  absence:
    "a comparison with null or undefined, an unwrapped optionalKey, or an Option/Result/Exit guard in a test if or ternary. Narrow with assertSome, assertNone or assertDefined from @effect/vitest/utils; for Result use assertSuccess/assertFailure, and for Exit use assertExitSuccess/assertExitFailure"
}

/** One line of the code at a place: its first line, cut where a longer one would fill the screen. */
const shown = (code: string): string => {
  const first = A.headNonEmpty(Str.split("\n")(code))
  return first.length > 80 ? `${Str.slice(0, 77)(first)}...` : first
}

/**
 * The line each finding prints.
 */
export const defaultsSentence: (finding: DefaultsFinding) => Line = DefaultsFinding.match({
  Clean: ({ files, held }) =>
    files === 0
      ? out("defaults:check OK  no file named is one the law reads")
      : out(
          `defaults:check OK  ${files} files hold to the baseline (still held: ${A.join(
            A.map(A.zip(kinds, held), ([kind, count]) => `${count} ${kind}`),
            ", "
          )})`
        ),
  Below: ({ files }) =>
    out(`${files} files hold fewer places than their baseline: bun run beep laws defaults --write lowers it`),
  Wrote: ({ files }) => out(`defaults:check OK  ${baselineFile} lowered: it names ${files} files`),
  NoWrite: () =>
    err(`--write lowers the baseline for the whole tree and takes no file, and never raises it: nothing was written`),
  Refused: ({ broken }) =>
    broken
      ? err(
          `defaults:check FAIL  code that settles absence, a starting value or a clean-up by itself. A schema settles it, where the value enters (docs/standards/schema-first.md):`
        )
      : err(`defaults:check FAIL  ${baselineFile}, or what the law reads, does not hold:`),
  Ledger: ({ said }) => err(said),
  Unlisted: ({ why }) => err(`git could not list the files, so none was checked: ${why}`),
  Unread: ({ file, why }) => err(`${file}  not read: ${why}`),
  Over: ({ file, kind, may, now, test }) =>
    err(`${file}  holds ${now} ${kind}, and may hold ${may}: ${(test ? testRemedy : remedy)[kind]}`),
  At: ({ code, place }) => err(`  ${place}  ${shown(code)}`)
})

const countOf = (places: ReadonlyArray<DefaultsPlace>): Held => {
  const of = (kind: DefaultsKind): number => A.filter(places, (place) => place.kind === kind).length
  return [of("fallback"), of("absence"), of("unwrap"), of("normalise")]
}
const sum = (a: Held, b: Held): Held => [a[0] + b[0], a[1] + b[1], a[2] + b[2], a[3] + b[3]]
const isTest = (file: string): boolean => Str.includes("/test/")(file) || Str.includes(".test.")(file)

// The places a file's committed version does not have: each old place takes one new place with the same code away,
// so a place whose line only moved is not said, and the place just written is.
const added = (
  now: ReadonlyArray<DefaultsPlace>,
  before: ReadonlyArray<DefaultsPlace>
): ReadonlyArray<DefaultsPlace> => {
  const left = Array.from(before, (place) => place.code)
  const fresh: Array<DefaultsPlace> = []
  for (const place of now) {
    const known = A.findFirstIndex(left, (code) => code === place.code)
    if (O.isSome(known)) left.splice(known.value, 1)
    else fresh.push(place)
  }
  return fresh
}

const encodeKey = S.encodeEffect(S.fromJsonString(S.String))

const BaselineJson = S.fromJsonString(DefaultsBaseline)

/**
 * The files the law reads, from git's list of own code and its list of the kit's `vendor.json` files (each NUL
 * separated): not a declaration file, and not inside a package the kit is copied into (it keeps beep-effect's code as
 * it is).
 */
const scopeOf = (listed: ReadonlyArray<string>, vendored: ReadonlyArray<string>): ReadonlyArray<string> => {
  const kit = A.map(A.filter(vendored, Str.isNonEmpty), (file) =>
    Str.slice(0, file.length - "vendor.json".length)(file)
  )
  return A.dedupe(
    A.filter(
      listed,
      (file) =>
        Str.isNonEmpty(file) && !Str.endsWith(".d.ts")(file) && !A.some(kit, (folder) => Str.startsWith(folder)(file))
    )
  )
}

/**
 * The files the law read at `commit`, or what git said when it could not list them: every file the commit holds,
 * empty ones too (an empty `vendor.json` still marks a kit), as a difference from the empty tree, which takes the same
 * pathspecs as `git ls-files`. Any code but 0 is a list git could not give, never an empty one. `--name-only` prints
 * no colour and the run is from the root, so `--no-color` and `--no-relative` only spell that out.
 */
const readScope = Effect.fn("Defaults.readScope")(function* (commit: string) {
  const repo = yield* Repo
  const empty = yield* repo.run("git", ["hash-object", "-t", "tree", "--stdin"], { cwd: repo.root, stdin: "" })
  if (empty.code !== 0) {
    const unlisted: Result.Result<ReadonlyArray<string>, string> = Result.fail(Str.trim(empty.stderr))
    return unlisted
  }
  const listedAt = (pathspec: ReadonlyArray<string>) =>
    Effect.map(
      repo.run(
        "git",
        [
          "diff",
          "--name-only",
          "-z",
          "--no-renames",
          "--no-color",
          "--no-relative",
          Str.trim(empty.stdout),
          commit,
          "--",
          ...pathspec
        ],
        { cwd: repo.root }
      ),
      (answer): Result.Result<ReadonlyArray<string>, string> =>
        answer.code === 0 ? Result.succeed(Str.split("\0")(answer.stdout)) : Result.fail(Str.trim(answer.stderr))
    )
  const listed = yield* listedAt(ownCode)
  const vendored = yield* listedAt([":(glob)packages/**/vendor.json"])
  return Result.all([listed, vendored]).pipe(Result.map(([own, kit]) => scopeOf(own, kit)))
})

/** One thing the baseline says against the files or main's, and whether it is code that breaks the rule. */
const Said = DefaultsFinding.cases.Ledger

/**
 * What the baseline says against the files there are and against main's (`base`: where this branch left it; on a
 * push, the commit CI names): each file it names that is not there, so a new file at that path inherits no allowance
 * (unless `--write` is about to take its line off, or move it to the file it was renamed to); each file main's does
 * not name, under the name it had there; and each count above main's. Main with no baseline yet is not compared.
 *
 * Main's baseline written for what the reader counted before it counted more (its `reads`) holds numbers of fewer
 * things, so its lines say nothing of these. Then each line is held instead to what this reader finds in the file as
 * it stood at the base, kind by kind: code nobody changed passes, and a place written since is refused, in the same
 * push that widens the reader.
 */
const againstMain = Effect.fn("Defaults.againstMain")(function* (input: {
  readonly now: DefaultsBaseline["files"]
  readonly write: boolean
  readonly base: AtBase
  readonly inScope: ReadonlyArray<string>
  readonly present: ReadonlyArray<string>
}) {
  const repo = yield* Repo
  const { base, now } = input
  // Gone is what the law's list does not hold, as the rename credit reads it: a stray file git ignores at that path is
  // no file of the law's, here and in CI alike.
  const gone = input.write
    ? []
    : A.filter(A.sort(R.keys(now), Order.String), (file) => !A.contains(input.present, file))
  // A line whose file moved to one the law reads goes with it at the next `--write`; one moved out of what the law
  // reads (a declaration file, the kit) is only taken off.
  const movedTo = R.fromEntries(
    A.filterMap(R.toEntries(base.renamed), ([to, from]) =>
      A.contains(input.inScope, to) ? Result.succeed([from, to] as const) : Result.failVoid
    )
  )
  const missing = A.map(gone, (file) =>
    Said.make({
      said: O.match(R.get(movedTo, file), {
        onNone: () =>
          `${file}  is in ${baselineFile} but the law reads no file at that path (deleted, ignored or out of its reach): take its line off (bun run beep laws defaults --write), so a new file at its path inherits nothing`,
        onSome: (to) =>
          `${file}  is in ${baselineFile} but was renamed to ${to}: bun run beep laws defaults --write moves its line`
      }),
      grew: false
    })
  )
  if (O.isSome(base.problem)) return A.append(missing, Said.make({ said: base.problem.value, grew: false }))
  if (O.isNone(base.text)) return missing
  const was = S.decodeOption(BaselineJson)(base.text.value)
  if (O.isNone(was)) {
    return A.append(
      missing,
      Said.make({ said: `${baselineFile} on main is not a baseline, so it could not be compared`, grew: false })
    )
  }
  const sameReader = readsAsNow(was.value.reads)
  // With another reader, only a file the law read at the base is held to what it held there: one that came in from
  // the kit, the registry's components or the tooling holds places nobody counted, and is new to the law.
  const scopeThere: Result.Result<ReadonlyArray<string>, string> = sameReader || O.isNone(base.commit)
    ? Result.succeed([])
    : yield* readScope(base.commit.value)
  if (Result.isFailure(scopeThere)) {
    return A.append(
      missing,
      Said.make({
        said: `${baselineFile} could not be compared with main: git could not list the files at the base (${scopeThere.failure})`,
        grew: false
      })
    )
  }
  // What a file held on main: its line in main's baseline, or with another reader what this one finds in it there.
  const heldThere = Effect.fn("Defaults.heldThere")(function* (old: string) {
    if (sameReader) return R.get(was.value.files, old)
    if (O.isNone(base.commit) || !A.contains(scopeThere.success, old)) return O.none<Held>()
    const shown = yield* repo.run("git", ["show", `${base.commit.value}:${old}`], { cwd: repo.root })
    return shown.code === 0 ? O.some(countOf(readDefaults({ file: old, source: shown.stdout }).found)) : O.none<Held>()
  })
  const told = (counts: Held) => `[${A.join(A.map(counts, String), ", ")}]`
  const compared = yield* Effect.forEach(
    R.toEntries(now),
    Effect.fnUntraced(function* ([file, counts]) {
      // A file renamed since then is held at what main held it under its old name.
      const there = yield* heldThere(O.getOrElse(R.get(base.renamed, file), () => file))
      return O.match(there, {
        onNone: () => [
          Said.make({
            said: O.match(R.get(base.retaken, file), {
              onNone: () =>
                `${file}  is in ${baselineFile} but not on main: a baseline only loses files. Fix the file instead`,
              onSome: (old) =>
                `${file}  is in ${baselineFile} but not on main: it was moved from ${old}, and a file is at ${old} again, which keeps what main held there, so this one starts from nothing. Fix the file instead`
            }),
            grew: true
          })
        ],
        onSome: (may) =>
          A.some(A.zip(counts, may), ([held, mainHolds]) => held > mainHolds)
            ? [
                Said.make({
                  said: sameReader
                    ? `${file}  is held at ${told(counts)} in ${baselineFile}, above the ${told(may)} main holds it to: a number only falls`
                    : `${file}  is held at ${told(counts)} in ${baselineFile}, above the ${told(may)} this reader finds in it on main (main's baseline counts less, so the file is held to its code there): a number only falls`,
                  grew: true
                })
              ]
            : []
      })
    }),
    { concurrency: 1 }
  )
  return A.appendAll(missing, A.flatten(compared))
})

/**
 * Checks the files against the baseline, or with `write` lowers the baseline to what the tree holds.
 *
 * @param write Lower the baseline. Refused with files named, and when any file is over its baseline.
 * @param only The files to read, from the root or from the folder the command runs in; every file when none is named.
 * @param exempt The files that keep places on purpose: the command passes `exemptions`. It has no default, so a test
 *   in a made-up tree says which it means and is not failed for a file of this repository that its tree lacks.
 */
export const defaults = Effect.fn("Defaults.defaults")(function* (
  write: boolean,
  only: ReadonlyArray<string>,
  exempt: ReadonlyArray<DefaultsExemption>
) {
  const repo = yield* Repo
  const git = (pathspec: ReadonlyArray<string>) =>
    repo.run("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard", ...pathspec], { cwd: repo.root })
  const listed = yield* git(["--", ...ownCode])
  const vendored = yield* git(["--", ":(glob)packages/**/vendor.json"])
  // A list git could not give is not an empty list: nothing was checked, and the law says so.
  if (listed.code !== 0 || vendored.code !== 0) {
    return A.make<[DefaultsFinding, DefaultsFinding]>(
      DefaultsFinding.cases.Refused.make({ broken: false }),
      DefaultsFinding.cases.Unlisted.make({ why: Str.trim(listed.code !== 0 ? listed.stderr : vendored.stderr) })
    )
  }
  if (write && A.isReadonlyArrayNonEmpty(only)) return A.of<DefaultsFinding>(DefaultsFinding.cases.NoWrite.make({}))
  const inScope = scopeOf(Str.split("\0")(listed.stdout), Str.split("\0")(vendored.stdout))
  // A named file is read as the caller wrote it: from the root, from the folder the command runs in, or in full.
  const asked = A.map(only, (file) => repo.relative(repo.resolve(repo.cwd, file), repo.root))
  const present = yield* Effect.filter(inScope, (file) => repo.exists(repo.join(repo.root, file)), { concurrency: 1 })
  const files = A.isReadonlyArrayNonEmpty(asked) ? A.filter(present, (file) => A.contains(asked, file)) : present
  const baselinePath = repo.join(repo.root, baselineFile)
  const kept = yield* repo.exists(baselinePath)
  const stored = kept ? yield* Effect.asSome(repo.json(DefaultsBaseline)(baselinePath)) : O.none()
  const baseline = O.match(stored, { onNone: () => ({}), onSome: (one) => one.files })
  // A baseline written before the reader counted more holds numbers of fewer things: every file would be over it for
  // code nobody touched. `--write` records the tree anew, as it does with no baseline, and until then the run says so.
  const stale = O.exists(stored, (one) => !readsAsNow(one.reads))
  // The base is read once: the whole tree's run holds the baseline against it, and every run follows a file renamed
  // since, so a file moved with `git mv` keeps its line's allowance and `--write` moves the line.
  const base: AtBase = kept
    ? yield* atBase(baselineFile, present)
    : { problem: O.none(), text: O.none(), renamed: {}, retaken: {}, commit: O.none() }
  // Given files, the law leaves the baseline to the run over the whole tree.
  const against: ReadonlyArray<typeof Said.Type> =
    !kept || A.isReadonlyArrayNonEmpty(only)
      ? []
      : !stale
        ? yield* againstMain({ now: baseline, write, base, inScope, present })
        : write
          ? []
          : [
              Said.make({
                said: `${baselineFile} was written before the law counted what it counts now (${A.join(whatIsCounted, ", ")}): bun run beep laws defaults --write records the tree anew`,
                grew: false
              })
            ]
  const isExempt = (file: string, kind: DefaultsKind): boolean =>
    A.some(exempt, (one) => one.file === file && A.contains(one.kinds, kind))
  // An exemption outlives its file only by mistake, and a new file at that path would inherit it.
  // Held against the files that are there, not git's list: a file deleted and not yet staged is still in the index.
  const orphaned = A.isReadonlyArrayNonEmpty(only)
    ? []
    : A.map(
        A.filter(exempt, (one) => !A.contains(files, one.file)),
        (one) =>
          `${one.file}  is named in the law's exemptions but is not a file the law reads: take it off the list (Defaults.rules.ts)`
      )
  const read = yield* Effect.forEach(
    files,
    (file) =>
      Effect.map(repo.text(repo.join(repo.root, file)), (source) => {
        const one = readDefaults({ file, source })
        return { file, unread: one.unread, found: A.filter(one.found, (place) => !isExempt(file, place.kind)) }
      }),
    { concurrency: 1 }
  )
  const unread = A.flatMap(read, (one) =>
    O.match(one.unread, {
      onNone: () => [],
      onSome: (why) => [DefaultsFinding.cases.Unread.make({ file: one.file, why })]
    })
  )
  const counted = A.map(read, (one) => ({
    ...one,
    count: countOf(one.found),
    // A file the baseline names holds to its line; a renamed one to its old name's (atBase keeps only a move whose old
    // name the law lists no file at); any other may hold none.
    may: O.match(
      O.orElse(R.get(baseline, one.file), () =>
        O.flatMap(R.get(base.renamed, one.file), (was) => R.get(baseline, was))
      ),
      { onNone: () => none, onSome: identity }
    )
  }))
  // The first `--write`, with no baseline file yet, records the tree as it stands: nothing can be over nothing kept.
  const starting = write && (!kept || stale)
  const over = starting ? [] : A.filter(counted, (one) => A.some(A.zip(one.count, one.may), ([now, may]) => now > may))
  const problems = yield* Effect.forEach(
    over,
    Effect.fnUntraced(function* (one) {
      // What the file held when it was last committed says which places are new; a file never committed has none.
      const committed = yield* repo.run("git", ["show", `HEAD:${one.file}`], { cwd: repo.root })
      const before = committed.code === 0 ? readDefaults({ file: one.file, source: committed.stdout }).found : []
      const overs = A.flatMap(A.zip(kinds, A.zip(one.count, one.may)), ([kind, [now, may]]) => {
        if (now <= may) return []
        const ofKind = A.filter(one.found, (place) => place.kind === kind)
        const fresh = added(
          ofKind,
          A.filter(before, (place) => place.kind === kind)
        )
        const said: ReadonlyArray<DefaultsPlace> = A.isReadonlyArrayNonEmpty(fresh) ? fresh : ofKind
        return A.prepend<DefaultsFinding, DefaultsFinding>(
          A.map(said, (place) =>
            DefaultsFinding.cases.At.make({ place: `${one.file}:${place.line}`, code: place.code })
          ),
          DefaultsFinding.cases.Over.make({ file: one.file, kind, now, may, test: isTest(one.file) })
        )
      })
      // A move whose old name the law lists a file at again lends it nothing, and the reader is told why while git sees
      // the move (once the file at the old name is staged it sees no move but a new file, and lends nothing
      // either). A moved file with a line of its own is held to that line, and the move is not what it is over.
      const retaken = O.filter(R.get(base.retaken, one.file), () => !R.has(baseline, one.file))
      return O.match(retaken, {
        onNone: () => overs,
        onSome: (old) =>
          A.prepend<DefaultsFinding, DefaultsFinding>(
            overs,
            Said.make({
              said: `${one.file}  was moved from ${old}, and a file is at ${old} again, which keeps that name's line, so this one may hold none`,
              grew: false
            })
          )
      })
    }),
    { concurrency: 1 }
  )
  const places = A.flatten(problems)
  const failures = A.flatten<ReadonlyArray<ReadonlyArray<DefaultsFinding>>>([
    against,
    A.map(orphaned, (said) => Said.make({ said, grew: false })),
    unread,
    places
  ])
  if (A.isReadonlyArrayNonEmpty(failures)) {
    return A.prepend<DefaultsFinding, DefaultsFinding>(
      failures,
      DefaultsFinding.cases.Refused.make({
        broken: A.isReadonlyArrayNonEmpty(places) || A.some(against, (one) => one.grew)
      })
    )
  }
  const holding = A.filter(counted, (one) => A.some(one.count, (count) => count > 0))
  if (write) {
    const lines = yield* Effect.forEach(
      A.sortWith(
        holding,
        (one) => one.file,
        (a, b) => (a < b ? -1 : a > b ? 1 : 0)
      ),
      (one) => Effect.map(encodeKey(one.file), (key) => `    ${key}: [${A.join(A.map(one.count, String), ", ")}]`),
      { concurrency: 1 }
    )
    const reads = yield* Effect.forEach(whatIsCounted, (one) => encodeKey(one), { concurrency: 1 })
    const body = A.isArrayNonEmpty(lines) ? `{\n${A.join(lines, ",\n")}\n  }` : "{}"
    yield* repo.write(
      baselinePath,
      `{\n  "counts": ["fallback", "absence", "unwrap", "normalise"],\n  "reads": [\n    ${A.join(reads, ",\n    ")}\n  ],\n  "files": ${body}\n}\n`
    )
    return A.of<DefaultsFinding>(DefaultsFinding.cases.Wrote.make({ files: holding.length }))
  }
  const below = A.filter(counted, (one) => A.some(A.zip(one.count, one.may), ([now, may]) => now < may)).length
  const clean = DefaultsFinding.cases.Clean.make({
    files: files.length,
    held: A.reduce(counted, none, (total, one) => sum(total, one.count))
  })
  return below > 0
    ? A.make<[DefaultsFinding, DefaultsFinding]>(clean, DefaultsFinding.cases.Below.make({ files: below }))
    : A.of<DefaultsFinding>(clean)
})
