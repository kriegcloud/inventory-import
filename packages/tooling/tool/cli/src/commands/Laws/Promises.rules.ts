/**
 * No Promise is written: code that waits is an Effect (Benjamin's rule, 2026-11-22: "Promises are also banned"). A
 * Promise hides what can fail from the type, starts the moment it is made, and cannot be interrupted; an Effect says
 * what it needs and how it fails, and starts when it is run. A platform's Promise comes in at an edge through
 * `Effect.tryPromise` (with a `catch` that returns a typed error) or `Effect.promise`, and an Effect goes out as a
 * Promise only where a platform calls in (`promiseEntryPoints`).
 *
 * What is refused, in every code file git would commit: an `async` function or method, an `await` (`for await`
 * included), a `new Promise`, any call of `Promise.*`, a `Promise<…>` or `PromiseLike<…>` type, a `.then(`, `.catch(`
 * or `.finally(` call on anything but a name an import binds (`Effect.catch` and `Story.then` are a module's members,
 * not a promise's), an Effect run as a Promise (`runPromise`, `runPromiseExit`, `runPromiseWith`), and `Promise`
 * taken as a value (`const Q = Promise`). `Promise` is caught however it is reached: by its name, through
 * `globalThis`, `self` or `window`, or by a member in brackets (`Promise["all"]`).
 *
 * The parser alone cannot read types, so this is where the law stops: a `.then` on a local name is taken for a
 * promise's, and a thenable imported from a module passes its `.then` as a module's member. The type-aware rules
 * that would close that, `typescript/no-floating-promises`, `typescript/await-thenable` and
 * `typescript/no-misused-promises`, are oxlint's on `oxlint-tsgolint`, which is installed here for the
 * deprecated-API law; none is run by this law.
 *
 * Three lists, each by name. `promiseEntryPoints`: where a platform calls in and takes a Promise, which may run an
 * Effect as one and name the type. `promisesVendored`: components copied from a registry as published, with where each
 * came from. `promisesListed`: the files that use Promises today; it may only shrink. A listed file with no use left
 * is refused until its line is taken off, and `test/Promises.test.ts` holds the list at its length.
 *
 * As for the `try` law, a file nested too deep, too large, or one the parser reads with errors is refused as a whole,
 * once, at the line being read; and "every file git would commit" is git's answer, so this asks git.
 *
 * @packageDocumentation
 */
import { $RepoCliId } from "@beep/identity/packages"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as R from "effect/Record"
import * as S from "effect/Schema"
import * as Str from "effect/String"
import { Repo } from "../../Repo.service.ts"
import { scratchpadFolder } from "../../Repo.schema.ts"
import { err, type Line, out } from "../../Report.schema.ts"
import { unreadSentence } from "./internal/budget.ts"
import { heldAs } from "./internal/held.ts"
import { type PromiseUse, readPromises } from "./internal/promiseCode.ts"

const $I = $RepoCliId.create("commands/Laws/Promises.rules")

/** A code file, by its name: TypeScript or JavaScript, wherever it is. */
const isCode = (file: string) => Str.match(/\.[cm]?[jt]sx?$/)(file).pipe(O.isSome)

/**
 * What is not read, each from the root, a folder with its closing slash: the agent skills, copied as published and run
 * by nothing; the scratchpad, where this law applies when an experiment graduates into a package; the vendored
 * shadcn components, kept as published (`packages/ui/src/components/ui/`); and the Alchemy packages kept as files,
 * which no one edits (`vendor/`).
 */
export const promisesLeftOut: ReadonlyArray<string> = [
  ".agents/",
  `${scratchpadFolder}/`,
  "packages/ui/src/components/ui/",
  "vendor/"
]

/**
 * Where a platform calls in and takes a Promise, with what calls it: the only files that may run an Effect as a
 * Promise and name its type. Every other use of a Promise there is refused as anywhere else.
 */
export const promiseEntryPoints: Readonly<Record<string, string>> = {
  "apps/inventory/src/server/App.ts": "the Worker's exported fetch, which Cloudflare calls and awaits",
  "apps/inventory/src/web/main.tsx": "the browser's root, which starts the app"
}

/** The uses an entry point may make: an Effect run as a Promise, and the Promise type it hands the platform. */
const atAnEntry: ReadonlyArray<PromiseUse> = ["run", "type"]

/**
 * Components copied from a registry as published, by where each came from (`packages/ui/components.json` names the
 * registries; `docs/kit.md` says what each is for). Their Promises are the registry's; a change goes there first.
 */
export const promisesVendored: Readonly<Record<string, string>> = {
  "packages/ui/src/components/data-grid/data-grid-cell-variants.tsx": "tablecn's data-grid (@tablecn registry)",
  "packages/ui/src/components/data-grid/data-grid-features.ts": "tablecn's data-grid (@tablecn registry)",
  "packages/ui/src/components/data-grid/data-grid-utils.ts": "tablecn's data-grid (@tablecn registry)",
  "packages/ui/src/components/data-grid/use-data-grid.ts": "tablecn's data-grid (@tablecn registry)",
  "packages/ui/src/components/data-table/data-table-toolbar.tsx": "tablecn's data-table (@tablecn registry)",
  "packages/ui/src/components/file-upload.tsx": "Dice UI's file-upload (@diceui registry)",
  "packages/ui/src/components/stepper.tsx": "Dice UI's stepper (@diceui registry)"
}

/**
 * The files that use Promises today, each read as a whole: this list may only shrink. Its owner takes a file off when
 * its last use is gone, and the law refuses a listed file that has none left.
 */
export const promisesListed: ReadonlyArray<string> = [
  "apps/inventory/scripts/auth-schema.mjs",
  "apps/inventory/scripts/dev-accounts.mjs",
  "apps/inventory/scripts/grid-keys.mjs",
  "apps/inventory/scripts/telemetry.mjs",
  "apps/inventory/src/server/App.ts",
  "apps/inventory/src/server/security.ts",
  "apps/inventory/src/web/components/app/AppSidebar.tsx",
  "apps/inventory/src/web/lib/otlp.ts",
  "apps/inventory/src/web/pages/ActivityPage.tsx",
  "apps/inventory/src/web/preload.ts",
  "apps/inventory/src/web/Workspace.tsx",
  "apps/inventory/test/server/AuthSchema.test.ts",
  "apps/inventory/test/server/Pwned.test.ts",
  "apps/inventory/test/server/RequestTelemetry.test.ts",
  "apps/inventory/test/server/support/app.ts",
  "apps/inventory/test/server/Telemetry.slow.test.ts",
  "apps/inventory/test/server/Telemetry.test.ts",
  "apps/inventory/test/web/gridCallbacks.test.ts",
  "apps/inventory/test/web/root.test.ts",
  "apps/inventory/test/web/session.test.ts",
  "apps/inventory/test/web/support/page.ts",
  "apps/inventory/test/web/traceContext.test.ts",
  "apps/inventory/test/web/workspace.test.ts",
  "packages/access/host/src/internal/authOptions.ts",
  "packages/access/host/src/SignIn.route.ts",
  "packages/access/web/src/People.screen.tsx",
  "packages/access/web/src/Session.atoms.ts",
  "packages/access/web/src/SignIn.screen.tsx",
  "packages/catalog/contract/test/FileProblem.test.ts",
  "packages/catalog/web/src/Catalog.runtime.ts",
  "packages/catalog/web/src/Draft.atoms.ts",
  "packages/catalog/web/src/Draft.machine.ts",
  "packages/catalog/web/src/ImportPage.screen.tsx",
  "packages/catalog/web/src/internal/reader.worker.ts",
  "packages/catalog/web/src/ItemsPage.screen.tsx",
  "packages/catalog/web/src/MatchStep.screen.tsx",
  "packages/catalog/web/src/ResultStep.screen.tsx",
  "packages/catalog/web/src/ReviewDraft.atoms.ts",
  "packages/catalog/web/src/ReviewStep.screen.tsx",
  "packages/catalog/web/src/TableAssistant.screen.tsx",
  "packages/catalog/web/src/Upload.controller.ts",
  "packages/catalog/web/src/UploadStep.screen.tsx",
  "packages/catalog/web/test/ImportPage.test.ts",
  "packages/catalog/web/test/readInPieces.test.ts",
  "packages/catalog/web/test/RemoveImportAddress.test.ts",
  "packages/catalog/web/test/RemoveImport.test.ts",
  "packages/catalog/web/test/support/catalog.ts",
  "packages/catalog/web/test/TabRows.test.ts",
  "packages/catalog/web/test/UploadOwner.test.ts",
  "packages/client/src/ApiRuntime.runtime.ts",
  "packages/client/src/Early.runtime.ts",
  "packages/client/src/Http.runtime.ts",
  "packages/client/src/Tab.atoms.ts",
  "packages/client/test/Connection.atoms.test.ts",
  "packages/review/src/internal/parts.tsx",
  "packages/review/src/ReviewRegion.component.tsx",
  "packages/review/src/SavedProgress.hook.ts"
]

/**
 * What the lists are held by, from their contents (`internal/held.ts`): a file swapped for another changes the number,
 * and the law refuses the list until it is recorded again. Recorded only when files came off.
 */
export const promisesHeld = { listed: -142488807, vendored: 75817709, entryPoints: -1064530232 }

/** Each list whose files are not the ones it is held by. */
const changedLists = (): ReadonlyArray<PromiseFinding> =>
  A.getSomes(
    A.map(
      [
        ["promisesListed", heldAs(promisesListed), promisesHeld.listed],
        ["promisesVendored", heldAs(R.keys(promisesVendored)), promisesHeld.vendored],
        ["promiseEntryPoints", heldAs(R.keys(promiseEntryPoints)), promisesHeld.entryPoints]
      ] as const,
      ([list, now, held]) => (now === held ? O.none() : O.some(PromiseFinding.cases.Changed.make({ list, held, now })))
    )
  )

const isLeftOut = (file: string): boolean => A.some(promisesLeftOut, (path) => Str.startsWith(path)(file))

/** The paths not read, as the output names them each time. */
const notRead = `${A.join(promisesLeftOut, ", ")} are not read; ${A.length(promisesListed)} files are listed and ${R.size(promisesVendored)} vendored`

const PromiseUseSchema = S.Literals(["async", "await", "new", "static", "type", "chain", "run", "value"])

/**
 * What `laws promises` finds: nothing, or a refusal and each use; a listed file with none left; and what keeps it
 * from being sure.
 *
 * @category schemas
 */
export const PromiseFinding = S.TaggedUnion({
  Clean: {},
  Refused: {},
  Unlisted: {
    why: S.String.pipe(S.annotateKey({ description: "What git said when it could not list the files" }))
  },
  At: {
    place: S.String.pipe(S.annotateKey({ description: "The file and line, as file:line" })),
    use: PromiseUseSchema.pipe(S.annotateKey({ description: "What the use of a Promise is" }))
  },
  Settled: {
    file: S.String.pipe(S.annotateKey({ description: "A listed file that uses no Promise any more" }))
  },
  Changed: {
    list: S.String.pipe(S.annotateKey({ description: "The list whose files are not the ones it is held by" })),
    held: S.Finite.pipe(S.annotateKey({ description: "The number the list is held by" })),
    now: S.Finite.pipe(S.annotateKey({ description: "The number its files give now" }))
  },
  Unread: {
    place: S.String.pipe(S.annotateKey({ description: "The file and line the law stopped at, as file:line" })),
    why: S.String.pipe(S.annotateKey({ description: "Why the law did not read the file, in words" }))
  }
}).pipe(
  $I.annoteSchema("PromiseFinding", {
    description: "No Promise is written, or a refusal and each place one is, or why that could not be told"
  })
)

/**
 * The decoded value of `PromiseFinding`.
 *
 * @category models
 */
export type PromiseFinding = typeof PromiseFinding.Type

/** What each use is, and what to write instead. */
const insteadOf = (use: PromiseUse): string => {
  switch (use) {
    case "async":
      return "an async function: write an Effect.fn, with Effect.tryPromise at the edge where a platform hands a Promise"
    case "await":
      return "an await: yield* an Effect in an Effect.fn"
    case "new":
      return "a new Promise: write Effect.async, Effect.callback or a Deferred"
    case "static":
      return "a call of Promise.*: write Effect.all, Effect.forEach, Effect.race or Effect.succeed"
    case "type":
      return "a Promise type: type the Effect, and let only an entry point hand a Promise to the platform"
    case "chain":
      return "a .then, .catch or .finally on a promise: write Effect.map, Effect.catch or Effect.ensuring"
    case "run":
      return "an Effect run as a Promise: run it at an entry point (promiseEntryPoints), or yield* it"
    case "value":
      return "Promise taken as a value, to be called or made under another name: write the Effect that does the work"
  }
}

/**
 * The line each finding prints.
 *
 * @category rendering
 */
export const promiseSentence: (finding: PromiseFinding) => Line = PromiseFinding.match({
  Clean: () => out(`promises:check OK  no Promise is written (${notRead})`),
  Refused: () => err(`promises:check FAIL  a Promise is written. Write what each line says instead (${notRead}):`),
  Unlisted: ({ why }) => err(`git could not list the files, so none was checked: ${why}`),
  At: ({ place, use }) => err(`${place}  ${insteadOf(use)}`),
  Settled: ({ file }) =>
    err(`${file}  is listed in promisesListed but uses no Promise any more: take its line off the list`),
  Unread: ({ place, why }) => err(`${place}  ${why}`),
  Changed: ({ held, list, now }) =>
    err(
      `${list} names other files than the ones it is held by (${held}): it may only shrink. If files came off it because they are clean, record ${now} beside it; never add one`
    )
})

/**
 * Reads every code file git would commit, from the repository's root, but what `promisesLeftOut` names.
 *
 * @category rules
 */
export const promises = Effect.fn("Promises.promises")(function* () {
  const repo = yield* Repo
  const listed = yield* repo.run("git", [
    "ls-files",
    "-z",
    "--cached",
    "--others",
    "--exclude-standard",
    "--deduplicate"
  ])
  if (listed.code !== 0) {
    return A.make<[PromiseFinding, PromiseFinding]>(
      PromiseFinding.cases.Refused.make({}),
      PromiseFinding.cases.Unlisted.make({ why: Str.trim(listed.stderr) })
    )
  }
  const files = yield* Effect.filter(
    A.filter(Str.split("\0")(listed.stdout), (file) => isCode(file) && !isLeftOut(file)),
    (file) => repo.exists(repo.join(repo.root, file)),
    { concurrency: 1 }
  )
  const found = yield* Effect.forEach(
    files,
    (file) =>
      Effect.map(repo.text(repo.join(repo.root, file)), (source): ReadonlyArray<PromiseFinding> => {
        const read = readPromises({ file, source })
        if (O.isSome(read.unread)) {
          return A.of(
            PromiseFinding.cases.Unread.make({
              place: `${file}:${read.unread.value.line}`,
              why: unreadSentence(read.unread.value.unread)
            })
          )
        }
        const allowed = R.has(promiseEntryPoints, file) ? atAnEntry : []
        const uses = A.filter(read.found, ({ use }) => !A.contains(allowed, use))
        // A vendored file is the registry's; a listed one is passed while it uses a Promise, and refused once it
        // uses none, so the list shrinks with the code.
        if (R.has(promisesVendored, file)) return []
        if (A.contains(promisesListed, file)) {
          return A.isReadonlyArrayEmpty(uses) ? A.of(PromiseFinding.cases.Settled.make({ file })) : []
        }
        return A.map(uses, ({ line, use }) => PromiseFinding.cases.At.make({ place: `${file}:${line}`, use }))
      }),
    { concurrency: 1 }
  )
  const problems = A.appendAll(changedLists(), A.flatten(found))
  return A.isArrayNonEmpty(problems)
    ? A.prepend<PromiseFinding, PromiseFinding>(problems, PromiseFinding.cases.Refused.make({}))
    : A.of<PromiseFinding>(PromiseFinding.cases.Clean.make({}))
})
