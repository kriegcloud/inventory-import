// The ban on `@effect-diagnostics` directives: each is refused where it stands, and each listed file is held at its
// number of directives against its ledger and against main's. A directive is put together here, never written out,
// since the checker reads one in a string too.
import { describe, expect, it } from "@effect/vitest"
import { vi } from "vitest"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as R from "effect/Record"
import * as Str from "effect/String"
import {
  diagnostics,
  diagnosticsLedger,
  diagnosticsSentence,
  directiveLines
} from "../src/commands/Laws/Diagnostics.rules.ts"
import { diagnosticDirective } from "../src/commands/Scratch/Scratch.templates.ts"
import { Repo } from "../src/Repo.service.ts"
import { render } from "../src/Report.schema.ts"
import { inTree, json, onMain, printed, type Tree } from "./support/tree.ts"

/** The law, in a repository whose main holds what `inTree` wrote, with `after` written on the branch. */
const inRepository = Effect.fn("inRepository")(function* (after: Tree = {}) {
  const repo = yield* Repo
  yield* onMain()
  yield* Effect.forEach(R.toEntries(after), ([file, text]) => repo.write(repo.join(repo.root, file), text), {
    concurrency: 1,
    discard: true
  })
  const found = yield* diagnostics()
  return printed(render(diagnosticsSentence)(found))
})

const off = `// ${diagnosticDirective} strictEffectProvide:off\nconst a = 1\n// ${diagnosticDirective}-next-line floatingEffect:off\nconst b = 2\nconst said = "${diagnosticDirective} schemaSync:off"\n`

/** `count` directives, two on each line, so a law that counts lines would count half. */
const directives = (count: number) =>
  A.join(
    A.makeBy(count, (i) => `/* ${diagnosticDirective} floatingEffect:off */ export const a${i} = ${i}\n`),
    ""
  )

const listed = "packages/x/src/listed.ts"
const ledger = (entries: Readonly<Record<string, number>>) => ({ [diagnosticsLedger]: json(entries) })

describe("laws diagnostics", () => {
  it("finds each directive, in a comment or a string, and not the word alone; two on a line are two", () => {
    expect(directiveLines(off)).toEqual([1, 3, 5])
    expect(directiveLines(`// the ${diagnosticDirective} comment is banned\n`)).toEqual([])
    expect(directiveLines(`// ${diagnosticDirective} a:off ${diagnosticDirective} b:off\n`)).toEqual([1, 1])
  })

  it.effect("refuses each directive in a file the ledger does not name; leaves out docs and the scratchpad", () =>
    Effect.gen(function* () {
      const said = yield* inTree({ ...ledger({}), "packages/x/src/a.ts": off }, inRepository())
      expect(said).toContain(
        "err: packages/x/src/a.ts:3  an @effect-diagnostics directive: remove it and write the code the rule asks for"
      )
      const elsewhere = yield* inTree(
        { ...ledger({}), "docs/a.ts": off, "scratchpad/experiments/x/a.ts": off },
        inRepository()
      )
      expect(elsewhere).toEqual([expect.stringContaining("out: diagnostics:check OK")])
    })
  )

  it.effect("holds a listed file at its number of directives, counted by place, not by line", () =>
    Effect.gen(function* () {
      const held = { ...ledger({ [listed]: 2 }), [listed]: directives(2) }
      const kept = yield* inTree(held, inRepository())
      expect(kept).toEqual([expect.stringContaining("out: diagnostics:check OK")])
      const more = yield* inTree(held, inRepository({ [listed]: directives(3) }))
      expect(more).toContain(
        `err: ${listed}  breaks the rule in 3 places, more than the 2 ${diagnosticsLedger} holds it to: a listed file may only lose places. Fix the new ones`
      )
      // A number that rose is code that breaks the rule; one that fell is the ledger's alone.
      expect(A.head(more)).toEqual(
        O.some(
          expect.stringContaining("err: diagnostics:check FAIL  an @effect-diagnostics directive turns a rule off")
        )
      )
      const fewer = yield* inTree(held, inRepository({ [listed]: directives(1) }))
      expect(A.head(fewer)).toEqual(
        O.some(expect.stringContaining("err: diagnostics:check FAIL  its ledger does not hold"))
      )
      expect(fewer).toContain(
        `err: ${listed}  breaks the rule in 1 places, fewer than the 2 ${diagnosticsLedger} holds it to: lower its number to 1`
      )
      const none = yield* inTree(held, inRepository({ [listed]: "export const a = 1\n" }))
      expect(none).toContain(
        `err: ${listed}  is listed in ${diagnosticsLedger} but breaks the rule no more: take its line off`
      )
    })
  )

  it.effect("refuses a number that rose on main's, a file main does not list, and an entry for a missing file", () =>
    Effect.gen(function* () {
      const held = { ...ledger({ [listed]: 2 }), [listed]: directives(2) }
      // The same commit raises both the file's directives and its number: main still holds it at 2.
      const raised = yield* inTree(held, inRepository({ ...ledger({ [listed]: 3 }), [listed]: directives(3) }))
      expect(raised).toContain(
        `err: ${listed}  is held at 3 in ${diagnosticsLedger}, above the 2 main holds it to: a number only falls`
      )
      const added = "packages/x/src/added.ts"
      const grew = yield* inTree(held, inRepository({ ...ledger({ [listed]: 2, [added]: 1 }), [added]: directives(1) }))
      expect(grew).toContain(
        `err: ${added}  is in ${diagnosticsLedger} but not on main: a ledger only loses files. Fix the file instead`
      )
      const gone = yield* inTree(
        { ...ledger({ [listed]: 1, "packages/x/src/gone.ts": 1 }), [listed]: directives(1) },
        inRepository()
      )
      expect(gone).toContain(
        `err: packages/x/src/gone.ts  is in ${diagnosticsLedger} but the law reads no file at that path (deleted, ignored or out of its reach): take its line off, so a new file at its path inherits nothing`
      )
    })
  )

  it.effect("compares with where the branch left main, or on main with the commit before, and follows a rename", () =>
    Effect.gen(function* () {
      const commit = Effect.fn("commit")(function* (message: string) {
        const repo = yield* Repo
        yield* repo.run("git", ["add", "--all"])
        yield* repo.run("git", [
          "-c",
          "user.name=Test",
          "-c",
          "user.email=test@example.test",
          "-c",
          "commit.gpgsign=false",
          "commit",
          "-q",
          "-m",
          message
        ])
      })
      const write = Effect.fn("write")(function* (tree: Tree) {
        const repo = yield* Repo
        yield* Effect.forEach(R.toEntries(tree), ([file, text]) => repo.write(repo.join(repo.root, file), text), {
          concurrency: 1,
          discard: true
        })
      })
      const run = Effect.gen(function* () {
        const found = yield* diagnostics()
        return printed(render(diagnosticsSentence)(found))
      })
      const held = { ...ledger({ [listed]: 2 }), [listed]: directives(2) }
      // A branch cut before main lowered the number: it still holds the old one, which main held when it left.
      const behind = yield* inTree(
        held,
        Effect.gen(function* () {
          const repo = yield* Repo
          yield* onMain()
          yield* repo.run("git", ["checkout", "-q", "main"])
          yield* write({ ...ledger({ [listed]: 1 }), [listed]: directives(1) })
          yield* commit("main lowers it")
          yield* repo.run("git", ["checkout", "-q", "work"])
          return yield* run
        })
      )
      expect(behind).toEqual([expect.stringContaining("out: diagnostics:check OK")])
      // A number raised in a push straight to main is compared with the commit before.
      const pushed = yield* inTree(
        held,
        Effect.gen(function* () {
          const repo = yield* Repo
          yield* onMain()
          yield* repo.run("git", ["checkout", "-q", "main"])
          yield* write({ ...ledger({ [listed]: 3 }), [listed]: directives(3) })
          yield* commit("main raises it")
          return yield* run
        })
      )
      expect(pushed).toContain(
        `err: ${listed}  is held at 3 in ${diagnosticsLedger}, above the 2 main holds it to: a number only falls`
      )
      // A file renamed since main is held at its old name's number.
      const moved = "packages/x/src/moved.ts"
      const renamed = yield* inTree(
        held,
        Effect.gen(function* () {
          const repo = yield* Repo
          yield* onMain()
          yield* repo.run("git", ["mv", listed, moved])
          yield* write(ledger({ [moved]: 2 }))
          return yield* run
        })
      )
      expect(renamed).toEqual([expect.stringContaining("out: diagnostics:check OK")])
      // A move whose line was left at the old name is told the move, and the line to write, as a case-only one is.
      for (const to of [moved, "packages/x/src/Listed.ts"]) {
        const lineLeft = yield* inTree(
          held,
          Effect.gen(function* () {
            const repo = yield* Repo
            yield* onMain()
            yield* repo.run("git", ["mv", listed, to])
            return yield* run
          })
        )
        expect(lineLeft).toContain(
          `err: ${listed}  is in ${diagnosticsLedger} but was moved to ${to}: move its line to ${to}`
        )
      }
      // A move with a new file at the old name lends nothing: the new file keeps the number, so the moved one is new.
      // The same whether the new file is untracked (git sees a rename, and the law says so) or both are committed (git
      // sees a change of the old file and a new one).
      const notTwice = `err: ${moved}  is in ${diagnosticsLedger} but not on main:`
      const retaken = `${notTwice} it was moved from ${listed}, and a file is at ${listed} again, which keeps what main held there, so this one starts from nothing. Fix the file instead`
      for (const committed of [false, true]) {
        const both = yield* inTree(
          held,
          Effect.gen(function* () {
            const repo = yield* Repo
            yield* onMain()
            yield* repo.run("git", ["mv", listed, moved])
            yield* write({ ...ledger({ [listed]: 2, [moved]: 2 }), [listed]: directives(2) })
            if (committed) yield* commit("moves it, and writes a new file at its name")
            return yield* run
          })
        )
        expect(both).toContainEqual(expect.stringContaining(notTwice))
        if (!committed) expect(both).toContain(retaken)
      }
      // A stray file git ignores at the old name is no file of the law's: the move still lends its number.
      const ignored = yield* inTree(
        held,
        Effect.gen(function* () {
          const repo = yield* Repo
          yield* onMain()
          yield* repo.run("git", ["mv", listed, moved])
          yield* write({ ...ledger({ [moved]: 2 }), ".gitignore": `${listed}\n`, [listed]: directives(2) })
          return yield* run
        })
      )
      expect(ignored).toEqual([expect.stringContaining("out: diagnostics:check OK")])
      // A file changed beside a listed one is no rename: git's records are a status and one path each.
      const beside = yield* inTree(
        { ...held, "README.md": "# a\n" },
        Effect.gen(function* () {
          yield* onMain()
          yield* write({ "README.md": "# b\n" })
          return yield* run
        })
      )
      expect(beside).toEqual([expect.stringContaining("out: diagnostics:check OK")])
      // A push of two commits, the number raised in the first: CI names the commit main moved from, so both count.
      const twoCommits = yield* inTree(
        held,
        Effect.gen(function* () {
          const repo = yield* Repo
          yield* onMain()
          yield* repo.run("git", ["checkout", "-q", "main"])
          const before = Str.trim((yield* repo.run("git", ["rev-parse", "HEAD"])).stdout)
          yield* write({ ...ledger({ [listed]: 3 }), [listed]: directives(3) })
          yield* commit("raises it")
          yield* write({ "README.md": "# only\n" })
          yield* commit("touches the readme")
          vi.stubEnv("LEDGER_BASE", before)
          return yield* run
        })
      )
      vi.unstubAllEnvs()
      expect(twoCommits).toContain(
        `err: ${listed}  is held at 3 in ${diagnosticsLedger}, above the 2 main holds it to: a number only falls`
      )
      // A LEDGER_BASE not fetched, or not in HEAD's history (a force push), is refused, not taken in silence.
      const unfetched = yield* inTree(
        held,
        Effect.gen(function* () {
          yield* onMain()
          vi.stubEnv("LEDGER_BASE", "0123456789abcdef0123456789abcdef01234567")
          return yield* run
        })
      )
      vi.unstubAllEnvs()
      expect(unfetched).toEqual([
        `err: diagnostics:check FAIL  its ledger does not hold (.agents/, vendor/, docs/, scratchpad/ are not read; the files in ${diagnosticsLedger} are listed):`,
        `err: ${diagnosticsLedger} could not be compared: LEDGER_BASE names 0123456789abcdef0123456789abcdef01234567, which is not in this checkout. Fetch it, so a number that rose since is seen`
      ])
      const forced = yield* inTree(
        held,
        Effect.gen(function* () {
          const repo = yield* Repo
          yield* onMain()
          yield* repo.run("git", ["checkout", "-q", "--orphan", "elsewhere"])
          yield* commit("another history")
          const other = Str.trim((yield* repo.run("git", ["rev-parse", "HEAD"])).stdout)
          yield* repo.run("git", ["checkout", "-q", "work"])
          vi.stubEnv("LEDGER_BASE", other)
          return yield* run
        })
      )
      vi.unstubAllEnvs()
      expect(A.join(forced, "\n")).toContain("which is not in HEAD's history (was the branch pushed with --force?)")
      // A shallow checkout may not hold the base: refused, not passed in silence.
      const shallow = yield* inTree(
        held,
        Effect.gen(function* () {
          const repo = yield* Repo
          yield* onMain()
          const head = Str.trim((yield* repo.run("git", ["rev-parse", "HEAD"])).stdout)
          yield* repo.write(repo.join(repo.root, ".git", "shallow"), `${head}\n`)
          return yield* run
        })
      )
      expect(shallow).toContain(
        `err: ${diagnosticsLedger} could not be compared with main: the checkout is shallow, so where this branch left main may be missing. Fetch main's history (git fetch --unshallow origin main), so a number that rose is seen`
      )
    })
  )

  it.effect("says when main cannot be read, and refuses a ledger that is not one", () =>
    Effect.gen(function* () {
      const nomain = Effect.gen(function* () {
        const repo = yield* Repo
        yield* repo.run("git", ["init", "-q", "-b", "work"])
        const found = yield* diagnostics()
        return printed(render(diagnosticsSentence)(found))
      })
      const said = yield* inTree(ledger({}), nomain)
      expect(said).toContain(
        `err: ${diagnosticsLedger} could not be compared with main: neither origin/main nor main is here. Fetch it (git fetch origin main), so a number that rose is seen`
      )
      const broken = yield* inTree({ [diagnosticsLedger]: json({ "a.ts": 0 }) }, inRepository())
      expect(broken).toContain(
        `err: ${diagnosticsLedger} is not a ledger: an object of files, each with a number of places, one at least`
      )
    })
  )
})
