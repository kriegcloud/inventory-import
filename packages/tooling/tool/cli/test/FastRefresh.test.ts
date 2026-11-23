// The fast-refresh ban: a file of screens that exports more than components is refused, the registry's components
// and hooks are not read, a listed file is held at its number against main's, and nothing turns the rule off.
import { describe, expect, it } from "@effect/vitest"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as R from "effect/Record"
import * as Str from "effect/String"
import {
  fastRefresh,
  fastRefreshLedger,
  fastRefreshProfile,
  fastRefreshSentence
} from "../src/commands/Laws/FastRefresh.rules.ts"
import { Repo } from "../src/Repo.service.ts"
import { render } from "../src/Report.schema.ts"
import { inTree, json, onMain, printed, type Tree } from "./support/tree.ts"

/** This repository's root, from this file's folder: its profile and what it has installed are the law's. */
const real = (repo: Repo["Service"], path: string) => repo.resolve(import.meta.dirname, "../../../../..", path)

/** The law, in a repository whose main holds what `inTree` wrote and the real profile, with `after` on the branch. */
const inRepository = Effect.fn("inRepository")(function* (after: Tree = {}) {
  const repo = yield* Repo
  const here = (path: string) => repo.join(repo.root, path)
  if (!(yield* repo.exists(here(fastRefreshProfile)))) {
    const profile = yield* repo.text(real(repo, fastRefreshProfile))
    yield* repo.write(here(fastRefreshProfile), profile)
  }
  if (!(yield* repo.exists(here(fastRefreshLedger)))) yield* repo.write(here(fastRefreshLedger), json({}))
  yield* repo.write(here(".gitignore"), "node_modules\n")
  yield* repo.run("ln", ["-s", real(repo, "node_modules"), here("node_modules")])
  yield* onMain()
  yield* Effect.forEach(R.toEntries(after), ([file, text]) => repo.write(here(file), text), {
    concurrency: 1,
    discard: true
  })
  const found = yield* fastRefresh()
  return printed(render(fastRefreshSentence)(found))
})

const screen = "packages/review/src/Panel.tsx"
const components = `export const Panel = () => <div />\nexport function Side() { return <aside /> }\n`
/** A screen with `count` exports beside its component that are not components. */
const mixed = (count: number) =>
  `${components}${A.join(
    A.makeBy(count, (i) => `export const limit${i} = ${i}\n`),
    ""
  )}`

describe("laws fast-refresh", () => {
  it.effect("passes a file of components only, and refuses an export beside them that is not one", () =>
    Effect.gen(function* () {
      const clean = yield* inTree({ [screen]: components }, inRepository())
      expect(clean).toEqual([expect.stringContaining("out: fast-refresh:check OK")])
      const said = yield* inTree({ [screen]: mixed(1) }, inRepository())
      expect(said).toContain(
        `err: ${screen}:3  an export that is not a component: move it to a file of its own (an atom to a .atoms.ts, a helper to a .rules.ts), so fast refresh keeps the screen's state`
      )
    })
  )

  it.effect("does not read the registry's components and hooks, or code outside the screen folders", () =>
    Effect.gen(function* () {
      const said = yield* inTree(
        {
          "packages/ui/src/components/button.tsx": mixed(1),
          "packages/ui/src/hooks/use-x.tsx": mixed(1),
          "packages/catalog/model/src/Rules.tsx": mixed(1)
        },
        inRepository()
      )
      expect(said).toEqual([expect.stringContaining("out: fast-refresh:check OK")])
    })
  )

  it.effect("holds a listed file at its number, against its ledger and against main's", () =>
    Effect.gen(function* () {
      const held = { [fastRefreshLedger]: json({ [screen]: 2 }), [screen]: mixed(2) }
      const kept = yield* inTree(held, inRepository())
      expect(kept).toEqual([expect.stringContaining("out: fast-refresh:check OK")])
      const more = yield* inTree(held, inRepository({ [screen]: mixed(3) }))
      expect(more).toContain(
        `err: ${screen}  breaks the rule in 3 places, more than the 2 ${fastRefreshLedger} holds it to: a listed file may only lose places. Fix the new ones`
      )
      const raised = yield* inTree(
        held,
        inRepository({ [fastRefreshLedger]: json({ [screen]: 3 }), [screen]: mixed(3) })
      )
      expect(raised).toContain(
        `err: ${screen}  is held at 3 in ${fastRefreshLedger}, above the 2 main holds it to: a number only falls`
      )
    })
  )

  it.effect("refuses a comment that turns the rule off, and a profile loosened", () =>
    Effect.gen(function* () {
      const off = Str.trim(`oxlint-disable-next-line react/only-export-components`)
      const said = yield* inTree({ [screen]: `${components}// ${off}\nexport const limit = 1\n` }, inRepository())
      expect(said).toContain(
        `err: ${screen}:3  a comment that turns only-export-components off (oxlint-disable-next-line): no comment does. Remove it`
      )
      const loosened = yield* inTree(
        {
          [fastRefreshProfile]: json({
            plugins: ["react"],
            categories: {},
            rules: { "react/only-export-components": "warn" }
          })
        },
        inRepository()
      )
      expect(loosened).toContain(
        `err:   ${fastRefreshProfile} is not the profile this law holds: the one rule, an error, every other category off`
      )
    })
  )
})
