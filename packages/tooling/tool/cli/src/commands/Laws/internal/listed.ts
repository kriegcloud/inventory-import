// A law in the shape of the bans that came with a list of today's files: every code file git would commit is read,
// but the folders it leaves out; each place it refuses is said with what to write instead; a listed file is passed
// at the number of places it breaks the rule, which may only fall (`ledger.ts`); and the list's files are held by a
// number read from their names (`held.ts`), a guard for the review rather than for the code, since the number sits
// beside the list and changes in the same commit. The bans differ in what they read and in their words, which a `ListedSpec` gives.
import { $RepoCliId } from "@beep/identity/packages"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import { dual } from "effect/Function"
import * as O from "effect/Option"
import * as Order from "effect/Order"
import * as R from "effect/Record"
import * as S from "effect/Schema"
import * as Str from "effect/String"
import { Repo } from "../../../Repo.service.ts"
import { err, type Line, out } from "../../../Report.schema.ts"
import { type Stopped, Unread, unreadable, unreadSentence } from "./budget.ts"
import { heldAs } from "./held.ts"
import { type Ledger, standingOf, standingWords } from "./ledger.ts"
import { linesOf } from "./lines.ts"
import { type Node, parsedAs } from "./tryCode.ts"

const $I = $RepoCliId.create("commands/Laws/internal/listed")

/** What one file gives a law: the lines that break its rule, or where and why it was not read. */
export interface ListedRead {
  readonly found: ReadonlyArray<number>
  readonly unread: O.Option<{ readonly line: number; readonly unread: Unread }>
}

/** One law of this shape: its name, its words, what it leaves out, its list, and how it reads a file's tree. */
export interface ListedSpec {
  /** The root script's name, as the output starts: `dual:check`. */
  readonly check: string
  /** What the rule asks for, as a clause: "every helper of two values takes the one it acts on first and is dual". */
  readonly rule: string
  /** What a place breaks and what to write instead, as the line for it says. */
  readonly instead: string
  /** The list's name, as the law's source declares it. */
  readonly listName: string
  readonly listed: Ledger
  /** The number the list is held by (`held.ts`). */
  readonly held: number
  /** The paths not read, from the root, a folder with its closing slash. */
  readonly leftOut: ReadonlyArray<string>
  /** The offsets in a file's tree that break the rule. */
  readonly offsets: (program: Node) => ReadonlyArray<number>
}

/**
 * What a law of this shape finds.
 *
 * @category schemas
 */
export const ListedFinding = S.TaggedUnion({
  Clean: {},
  Refused: {},
  Unlisted: {
    why: S.String.pipe(S.annotateKey({ description: "What git said when it could not list the files" }))
  },
  At: {
    place: S.String.pipe(S.annotateKey({ description: "The file and line, as file:line" }))
  },
  Standing: {
    file: S.String.pipe(S.annotateKey({ description: "A listed file whose number of places moved" })),
    words: S.String.pipe(S.annotateKey({ description: "How it moved, and what to do" }))
  },
  Changed: {
    held: S.Finite.pipe(S.annotateKey({ description: "The number the list is held by" })),
    now: S.Finite.pipe(S.annotateKey({ description: "The number its files give now" }))
  },
  Unread: {
    place: S.String.pipe(S.annotateKey({ description: "The file and line the law stopped at, as file:line" })),
    why: S.String.pipe(S.annotateKey({ description: "Why the law did not read the file, in words" }))
  }
}).pipe($I.annoteSchema("ListedFinding", { description: "What a law with a list of today's files finds" }))

/**
 * The decoded value of `ListedFinding`.
 *
 * @category models
 */
export type ListedFinding = typeof ListedFinding.Type

const isCode = (file: string) => Str.match(/\.[cm]?[jt]sx?$/)(file).pipe(O.isSome)

/**
 * The lines of one file that break the rule `offsets` reads, or where and why it was not read.
 *
 * @example readListed({ file: "a.ts", source: "export const a = 1" }, () => []).found // []
 */
export const readListed: {
  (offsets: ListedSpec["offsets"]): (input: { readonly file: string; readonly source: string }) => ListedRead
  (input: { readonly file: string; readonly source: string }, offsets: ListedSpec["offsets"]): ListedRead
} = dual(2, (input: { readonly file: string; readonly source: string }, offsets: ListedSpec["offsets"]) => {
  const lineAt = linesOf(input.source)
  const unreadAt = (stopped: Stopped): ListedRead => ({
    found: [],
    unread: O.some({ line: lineAt(stopped.at), unread: stopped.unread })
  })
  // The scan before parsing answers at its own edge: a place it stopped, or nothing.
  const refused = O.fromUndefinedOr(unreadable(input.source))
  if (O.isSome(refused)) return unreadAt(refused.value)
  const whole = parsedAs(input)
  if (O.isSome(whole.failed)) return unreadAt(whole.failed.value)
  return O.match(whole.program, {
    onNone: () => unreadAt({ at: 0, unread: Unread.Unparsed({ message: "no program" }) }),
    onSome: (program): ListedRead => ({
      found: A.sort(A.dedupe(A.map(offsets(program), lineAt)), Order.Number),
      unread: O.none()
    })
  })
})

/**
 * The line each finding of `spec`'s law prints.
 *
 * @category rendering
 */
export const listedSentence = (spec: ListedSpec): ((finding: ListedFinding) => Line) => {
  const notRead = `${A.join(spec.leftOut, ", ")} are not read; ${R.size(spec.listed)} files are listed`
  return ListedFinding.match({
    Clean: () => out(`${spec.check} OK  ${spec.rule} (${notRead})`),
    Refused: () => err(`${spec.check} FAIL  not ${spec.rule}. Write what each line says instead (${notRead}):`),
    Unlisted: ({ why }) => err(`git could not list the files, so none was checked: ${why}`),
    At: ({ place }) => err(`${place}  ${spec.instead}`),
    Standing: ({ file, words }) => err(`${file}  ${words}`),
    Changed: ({ held, now }) =>
      err(
        `${spec.listName} names other files than the ones it is held by (${held}): it may only shrink. If files came off it because they are clean, record ${now} beside it; never add one`
      ),
    Unread: ({ place, why }) => err(`${place}  ${why}`)
  })
}

/**
 * Runs `spec`'s law over every code file git would commit, from the repository's root.
 *
 * @category rules
 */
export const listedLaw = Effect.fn("listed.listedLaw")(function* (spec: ListedSpec) {
  const repo = yield* Repo
  const git = yield* repo.run("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard", "--deduplicate"])
  if (git.code !== 0) {
    return A.make<[ListedFinding, ListedFinding]>(
      ListedFinding.cases.Refused.make({}),
      ListedFinding.cases.Unlisted.make({ why: Str.trim(git.stderr) })
    )
  }
  const files = yield* Effect.filter(
    A.filter(
      Str.split("\0")(git.stdout),
      (file) => isCode(file) && !A.some(spec.leftOut, (path) => Str.startsWith(path)(file))
    ),
    (file) => repo.exists(repo.join(repo.root, file)),
    { concurrency: 1 }
  )
  const found = yield* Effect.forEach(
    files,
    (file) =>
      Effect.map(repo.text(repo.join(repo.root, file)), (source): ReadonlyArray<ListedFinding> => {
        const read = readListed({ file, source }, spec.offsets)
        if (O.isSome(read.unread)) {
          return A.of(
            ListedFinding.cases.Unread.make({
              place: `${file}:${read.unread.value.line}`,
              why: unreadSentence(read.unread.value.unread)
            })
          )
        }
        return O.match(standingOf(spec.listed, { file, now: A.length(read.found) }), {
          onNone: () => A.map(read.found, (line) => ListedFinding.cases.At.make({ place: `${file}:${line}` })),
          onSome: (standing) =>
            O.match(standingWords(standing, spec.listName), {
              onNone: () => [],
              onSome: (words) => A.of(ListedFinding.cases.Standing.make({ file, words }))
            })
        })
      }),
    { concurrency: 1 }
  )
  const now = heldAs(R.keys(spec.listed))
  const changed = now === spec.held ? [] : [ListedFinding.cases.Changed.make({ held: spec.held, now })]
  const problems = A.appendAll(changed, A.flatten(found))
  return A.isReadonlyArrayNonEmpty(problems)
    ? A.prepend<ListedFinding, ListedFinding>(problems, ListedFinding.cases.Refused.make({}))
    : A.of<ListedFinding>(ListedFinding.cases.Clean.make({}))
})
