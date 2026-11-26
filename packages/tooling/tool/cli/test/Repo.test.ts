// Both forms of a repository operation keep the same file and process scope.
import { describe, expect, it } from "@effect/vitest"
import * as Effect from "effect/Effect"
import { pipe } from "effect/Function"
import { Repo } from "../src/Repo.service.ts"
import { inTree } from "./support/tree.ts"

describe("repository operation call forms", () => {
  it.effect("keeps the acted-on path first and resolves it from the supplied folder", () =>
    inTree(
      {},
      Effect.gen(function* () {
        const repo = yield* Repo
        const folder = repo.join(repo.root, "docs")
        const file = repo.join(folder, "note.txt")
        yield* repo.write(file, "first")
        expect(repo.relative(file, folder)).toBe("note.txt")
        expect(pipe(file, repo.relative(folder))).toBe("note.txt")
        yield* pipe(file, repo.write("second"))
        const text = yield* repo.text(file)
        expect(text).toBe("second")
      })
    )
  )

  it.effect("starts the same tool with optional settings in either form", () =>
    inTree(
      {},
      Effect.gen(function* () {
        const repo = yield* Repo
        const direct = yield* repo.run("git", ["--version"])
        const piped = yield* pipe("git", repo.run(["--version"]))
        const configured = yield* repo.run("git", ["--version"], { stdin: "" })
        const pipedConfigured = yield* pipe("git", repo.run(["--version"], { stdin: "" }))
        expect(direct.code).toBe(0)
        expect(piped.stdout).toBe(direct.stdout)
        expect(configured.stdout).toBe(direct.stdout)
        expect(pipedConfigured.stdout).toBe(direct.stdout)
      })
    )
  )
})
