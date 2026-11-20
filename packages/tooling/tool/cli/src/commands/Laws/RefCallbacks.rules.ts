/**
 * A `ref` on an element is a DOM ref or a callback that stays the same across draws: never a function written in
 * the element, a call, or a function made inside the component. React calls a ref callback again whenever it is
 * given a new function, so one made on each draw runs after every draw: an effect with no dependency list under
 * another name, which the atoms lint cannot see because no import gives it away (goals/atoms, Benjamin's answer
 * "No, follow the brief"). The function handed to `useAtomSubscribe` is held to the same: a new one on each draw
 * unsubscribes and subscribes after every draw.
 *
 * Each screen is read from its syntax tree, and a name is judged by where the file binds it. What passes: a name the
 * file binds at its top level or imports; what a hook holds (`useRef(null)`, a member of what `useAtomValue` gave);
 * a member of either; a member, two or more steps down, of a parameter. What is refused: a function written where it
 * is handed over; a call (a function returned from a call, `.bind`); a choice by a condition (a ref switched on and
 * off is an effect on that condition); and a name bound inside a function to a function (typed, generic, `var` and
 * declared ones too), an object, a call that is not a hook's, or taken out of one. A prop handed to a ref
 * (`ref={props.measure}`) is the caller's to keep steady: every attribute of that name, in every screen, is judged
 * the same way.
 *
 * What it does not see: a ref among spread props (`{...first}`); a steady callback on an element whose `key` changes
 * (React makes the element anew, and calls the callback, whenever the key does: an effect on the key); a hook that
 * hands back a new function on each draw; and a prop's name shared by two unrelated components, which is judged as
 * one. The vendored kit keeps its own.
 *
 * "Every file git would commit" is git's answer to give, so this asks git, and fails when git does not answer.
 *
 * @packageDocumentation
 */
import { $RepoCliId } from "@beep/identity/packages"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as HashSet from "effect/HashSet"
import * as S from "effect/Schema"
import * as Str from "effect/String"
import { Repo } from "../../Repo.service.ts"
import { err, type Line, out } from "../../Report.schema.ts"
import { type Handed, readScreen } from "./internal/refCallbacksCode.ts"

const $I = $RepoCliId.create("commands/Laws/RefCallbacks.rules")

/** Our own screens: every .tsx git would commit, the vendored kit and the agents' skills left out. */
const screens = ["--", "*.tsx", ":!packages/ui/src/components", ":!packages/ui/src/hooks", ":!.agents"]

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
  const read = yield* Effect.forEach(
    files,
    (file) =>
      Effect.map(repo.text(repo.join(repo.root, file)), (source) => ({ file, ...readScreen({ file, source }) })),
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
