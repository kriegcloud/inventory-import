// @effect-diagnostics nodeBuiltinImport:off
import { spawnSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { Array as Arr, String as Str } from "effect"
import { describe, expect, it } from "vitest"

// No key-shaped string (an OpenRouter or Anthropic key, a PEM private key) may be committed. This scans every file
// git would commit, so a key-shaped test value fails `bun run check`. A test that needs one puts it together at run
// time, as below. A failure names the file and line, never the string.

const here = fileURLToPath(new URL(".", import.meta.url))

/** The repository's top folder: the scan covers every workspace, not only this app. */
const root = Str.trim(spawnSync("git", ["rev-parse", "--show-toplevel"], { cwd: here, encoding: "utf8" }).stdout)

/** What a secret looks like in a text file. */
const keyPattern = /sk-or-[A-Za-z0-9_-]{16,}|sk-ant-[A-Za-z0-9_-]{16,}|-----BEGIN [A-Z ]*PRIVATE KEY/

/** Every file git would commit: tracked, and new files it does not ignore. */
const committable = (): ReadonlyArray<string> => {
  const listed = spawnSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], {
    cwd: root,
    encoding: "utf8"
  })
  expect(listed.status).toBe(0)
  return Arr.filter(Str.split(listed.stdout, "\u0000"), Str.isNonEmpty)
}

describe("the key scan, over the files git would commit", () => {
  it("finds a key put together here", () => {
    const pattern = keyPattern
    expect(pattern.test(`${"sk-or-v1-"}0123456789abcdefghij`)).toBe(true)
    expect(pattern.test(`${"sk-ant-api03-"}0123456789abcdefghij`)).toBe(true)
    expect(pattern.test("test-key-not-a-real-key")).toBe(false)
  })

  it("finds no key-shaped string in any of them", () => {
    const pattern = keyPattern
    const found = Arr.flatMap(committable(), (path) => {
      let bytes: Buffer
      try {
        bytes = readFileSync(join(root, path))
      } catch {
        return [] // listed by git but deleted in the working tree
      }
      // Binary files are skipped, as `git grep -I` skips them.
      if (bytes.subarray(0, 8000).includes(0)) return []
      return Arr.flatMap(Str.split(bytes.toString("utf8"), "\n"), (line, index) =>
        pattern.test(line) ? [`${path}:${index + 1}`] : []
      )
    })
    expect(found).toEqual([])
  })
})
