/**
 * A `ref` on an element is a DOM ref or a callback that stays the same across draws: never a function written in
 * the element, a call, or a function made inside the component. React calls a ref callback again whenever it is
 * given a new function, so one made on each draw runs after every draw: an effect with no dependency list under
 * another name, which the atoms lint cannot see because no import gives it away (goals/atoms, Benjamin's answer
 * "No, follow the brief"). The function handed to `useAtomSubscribe` is held to the same: a new one on each draw
 * unsubscribes and subscribes after every draw.
 *
 * Each screen is read from its syntax tree, and a name is judged by where the file binds it. What passes: a name the
 * file binds at its top level or imports and no function sets again or writes into; what a hook holds (`useRef(null)`,
 * a member of what `useAtomValue` gave, through a namespace import too); a member of either; an element of a list that
 * is itself steady. A hook is a `use…` name imported from react, react-dom, @effect/atom-react, or a module the
 * repository names as one of hooks by its exact path (an export of a package whose file is a `*.hook.ts` or sits in
 * its `src/hooks`, as the vendored kit's do; a `*.hook.ts` file imported by its path): a function merely named `use…`,
 * or one from a module that only sits in a `hooks` or `components` folder, is judged by what it returns.
 *
 * What is refused: a function written where it is handed over; a call (a function returned from a call, `.bind`, a
 * `use…` helper that is not a hook); a choice by a condition (a ref switched on and off is an effect on that
 * condition); a name bound inside a function to a function (typed, generic, `var` and declared ones too), an object,
 * a call that is not a hook's, or taken out of one; a module `let` a function sets again (it holds what the last draw
 * gave it); a module record a function writes into (`refs[id] ??= …`, `Object.assign(refs, { [id]: fn })` under any
 * name for `Object.assign`, or through another name for the record, `const r = refs`, `r = refs`, `refs ?? {}`: a
 * cache by hand, holding what a draw made), under any of its names, and only where the write reaches (a write into
 * `big.a` refuses `big.a`'s refs and `big`'s, never `big.b`'s); the
 * `.current` of what a hook holds (`useRef(fn).current`: useRef is for a DOM node, and `.current` is what it held when
 * the draw read it); a value followed more than eight names deep (nothing there was shown steady); and an element of
 * a list (`rows.map((row) => <li ref={row.measure} />)`) made in the draw. A prop handed
 * to a ref, at any depth (`ref={props.measure}`, `ref={props.on.measure}`), is the caller's to keep steady: every
 * attribute of that name, in every screen, is judged the same way, and so is a list a prop hands in.
 *
 * What it does not see: a ref among spread props (`{...first}`); a steady callback on an element whose `key` changes
 * (React makes the element anew, and calls the callback, whenever the key does: an effect on the key); a hook that
 * hands back a new function on each draw; and a prop's name shared by two unrelated components, which is judged as
 * one. The vendored kit keeps its own, and the scratchpad (`scratchpad/`) is left out by name: an experiment's
 * screen is tried there under the type-checker only, and this law applies to it when it graduates into a package
 * (decision "the scratchpad", 2026-11-22).
 *
 * "Every file git would commit" is git's answer to give, so this asks git, and fails when git does not answer.
 *
 * @packageDocumentation
 */
import { $RepoCliId } from "@beep/identity/packages"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as HashSet from "effect/HashSet"
import * as P from "effect/Predicate"
import * as R from "effect/Record"
import * as S from "effect/Schema"
import * as Str from "effect/String"
import { Repo, type Workspace } from "../../Repo.service.ts"
import { scratchpadFolder } from "../../Repo.schema.ts"
import { err, type Line, out } from "../../Report.schema.ts"
import { type Handed, readScreen } from "./internal/refCallbacksCode.ts"

const $I = $RepoCliId.create("commands/Laws/RefCallbacks.rules")

/**
 * Our own screens: every .tsx git would commit, the vendored kit and the agents' skills left out, and the scratchpad:
 * an experiment's screen is held to this when it graduates into a package, not while it is tried.
 */
const screens = [
  "--",
  "*.tsx",
  ":!packages/ui/src/components",
  ":!packages/ui/src/hooks",
  ":!.agents",
  `:!${scratchpadFolder}`
]

/**
 * What `laws ref-callbacks` finds: nothing, or a refusal and each `ref` that is not steady, with why.
 *
 * @category schemas
 */
export const RefCallbacksFinding = S.TaggedUnion({
  Clean: {},
  Refused: {},
  Unlisted: {
    why: S.String.pipe(S.annotateKey({ description: "What git said when it could not list the files" }))
  },
  At: {
    place: S.String.pipe(S.annotateKey({ description: "The file and line, as file:line" })),
    why: S.String.pipe(S.annotateKey({ description: "What the ref is given, in words" }))
  }
}).pipe(
  $I.annoteSchema("RefCallbacksFinding", {
    description: "Every ref is steady across draws, or a refusal and each place one is not"
  })
)

/**
 * The decoded value of `RefCallbacksFinding`.
 *
 * @category models
 */
export type RefCallbacksFinding = typeof RefCallbacksFinding.Type

/**
 * The line each finding prints.
 *
 * @category rendering
 */
export const refCallbacksSentence: (finding: RefCallbacksFinding) => Line = RefCallbacksFinding.match({
  Clean: () => out("refs:check OK  every ref is a DOM ref or a callback that stays the same across draws"),
  Refused: () =>
    err(
      "refs:check FAIL  a ref callback made on each draw runs after every draw. Use a module-level function, a function an atom holds, or useAtomSubscribe:"
    ),
  Unlisted: ({ why }) => err(`git could not list the screens, so none was checked: ${why}`),
  At: ({ place, why }) => err(`${place}  ${why}`)
})

/**
 * The modules of the repository whose `use…` exports are hooks, each by the exact specifier a screen imports it by:
 * an export of a package whose file is a `*.hook.ts` (`@inventory/review/SavedProgressHook`) or sits in the package's
 * `src/hooks` folder, where the vendored kit keeps its hooks (`@inventory/ui/hooks/use-data-table`). Nothing else is
 * taken for a hook because of where it lives or what it is named.
 *
 * @example hookModulesOf([{ dir: "packages/ui", manifest: { name: "@inventory/ui", exports: { "./hooks/use-mobile": "./src/hooks/use-mobile.ts" } } }]) // ["@inventory/ui/hooks/use-mobile"]
 * @category rules
 */
export const hookModulesOf = (workspaces: ReadonlyArray<Pick<Workspace, "manifest">>): ReadonlyArray<string> =>
  A.flatMap(workspaces, ({ manifest }) =>
    A.flatMap(R.toEntries(manifest.exports ?? {}), ([entry, target]) =>
      P.isString(target) &&
      P.isString(manifest.name) &&
      (/\.hook\.tsx?$/.test(target) || Str.startsWith("./src/hooks/")(target))
        ? [entry === "." ? manifest.name : `${manifest.name}/${Str.slice(2)(entry)}`]
        : []
    )
  )

/**
 * Reads every screen of our own from the repository's root.
 *
 * @category rules
 */
export const refCallbacks = Effect.fn("RefCallbacks.refCallbacks")(function* () {
  const repo = yield* Repo
  const listed = yield* repo.run("git", ["ls-files", "--cached", "--others", "--exclude-standard", ...screens])
  // A list git could not give is not an empty list: nothing was checked, and the law says so.
  if (listed.code !== 0) {
    return A.make<[RefCallbacksFinding, RefCallbacksFinding]>(
      RefCallbacksFinding.cases.Refused.make({}),
      RefCallbacksFinding.cases.Unlisted.make({ why: Str.trim(listed.stderr) })
    )
  }
  const files = yield* Effect.filter(
    A.filter(Str.split("\n")(listed.stdout), (file) => file !== ""),
    (file) => repo.exists(repo.join(repo.root, file)),
    { concurrency: 1 }
  )
  const workspaces = yield* repo.workspaces
  const hookModules = hookModulesOf(workspaces)
  const read = yield* Effect.forEach(
    files,
    (file) =>
      Effect.map(repo.text(repo.join(repo.root, file)), (source) => ({
        file,
        ...readScreen({ file, source, hookModules })
      })),
    { concurrency: 1 }
  )
  const at = (file: string, handed: Handed, why: string): RefCallbacksFinding =>
    RefCallbacksFinding.cases.At.make({ place: `${file}:${handed.line}`, why })
  const direct = A.flatMap(read, (screen) =>
    A.flatMap(screen.refs, (handed) =>
      handed.verdict.kind === "refused" ? [at(screen.file, handed, `${handed.as}: ${handed.verdict.why}`)] : []
    )
  )
  // A prop handed to a ref is steady only if every caller hands it something steady: the names of such props, those
  // handed on under another name too, until no new name turns up.
  const handedDown = (names: HashSet.HashSet<string>): HashSet.HashSet<string> => {
    const more = A.flatMap(read, (screen) =>
      A.flatMap(screen.attributes, (handed) =>
        handed.verdict.kind === "prop" && HashSet.has(names, handed.as) && !HashSet.has(names, handed.verdict.name)
          ? [handed.verdict.name]
          : []
      )
    )
    return A.isArrayNonEmpty(more) ? handedDown(HashSet.union(names, HashSet.fromIterable(more))) : names
  }
  const carried = handedDown(
    HashSet.fromIterable(
      A.flatMap(read, (screen) =>
        A.flatMap(screen.refs, (handed) => (handed.verdict.kind === "prop" ? [handed.verdict.name] : []))
      )
    )
  )
  const through = A.flatMap(read, (screen) =>
    A.flatMap(screen.attributes, (handed) =>
      handed.verdict.kind === "refused" && HashSet.has(carried, handed.as)
        ? [at(screen.file, handed, `${handed.as} is handed down to a ref: ${handed.verdict.why}`)]
        : []
    )
  )
  const found = A.appendAll(direct, through)
  return A.isArrayNonEmpty(found)
    ? A.prepend<RefCallbacksFinding, RefCallbacksFinding>(found, RefCallbacksFinding.cases.Refused.make({}))
    : A.of<RefCallbacksFinding>(RefCallbacksFinding.cases.Clean.make({}))
})
