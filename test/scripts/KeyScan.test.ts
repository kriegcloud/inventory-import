// @effect-diagnostics nodeBuiltinImport:off
import { spawnSync } from "node:child_process"
import { readdirSync, readFileSync } from "node:fs"
import { join, relative } from "node:path"
import { fileURLToPath } from "node:url"
import { Array as Arr, Option, String as Str } from "effect"
import { describe, expect, it } from "vitest"

// The pack (scripts/pack.sh) refuses the zip when a file it packs holds a key-shaped string, and the checkpoint stops
// there. This runs the pack's own pattern, read from the script, over every file git would commit, so a key-shaped
// test value fails `bun run check` long before a checkpoint. A test that needs one puts it together at run time, as
// below. A failure names the file and line, never the string.

const root = fileURLToPath(new URL("../../", import.meta.url))

/** The `pattern='…'` line of scripts/pack.sh, as a regular expression. */
const packPattern = Option.map(
  Arr.findFirst(Str.split(readFileSync(join(root, "scripts", "pack.sh"), "utf8"), "\n"), Str.startsWith("pattern='")),
  (line) => new RegExp(Str.slice(9, -1)(Str.trimEnd(line)))
)

// Without git (a project made with --no-git), the files a first commit would take: the same folders and secrets
// .gitignore leaves out are skipped here.
const skippedFolders = [
  ".git",
  "node_modules",
  "dist",
  "dist-ssr",
  ".wrangler",
  "submit",
  ".frozen",
  ".scratch",
  "logs"
]
const isLocalSecret = (name: string) =>
  (Str.startsWith(".dev.vars")(name) || Str.startsWith(".env")(name)) && !Str.endsWith(".example")(name)
const walk = (folder: string): ReadonlyArray<string> =>
  Arr.flatMap(readdirSync(folder, { withFileTypes: true }), (entry) => {
    if (entry.isDirectory()) return Arr.contains(skippedFolders, entry.name) ? [] : walk(join(folder, entry.name))
    return entry.isFile() && !isLocalSecret(entry.name) ? [relative(root, join(folder, entry.name))] : []
  })

/** Every file git would commit: tracked, and new files it does not ignore. */
const committable = (): ReadonlyArray<string> => {
  const listed = spawnSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], {
    cwd: root,
    encoding: "utf8"
  })
  if (listed.status !== 0) return walk(root)
  return Arr.filter(Str.split(listed.stdout, "\u0000"), Str.isNonEmpty)
}

describe("the pack's key scan, over the files git would commit", () => {
  it("reads the pattern from the pack script, and it finds a key put together here", () => {
    expect(Option.isSome(packPattern)).toBe(true)
    const pattern = Option.getOrThrow(packPattern)
    expect(pattern.test(`${"sk-or-v1-"}0123456789abcdefghij`)).toBe(true)
    expect(pattern.test(`${"sk-ant-api03-"}0123456789abcdefghij`)).toBe(true)
    expect(pattern.test("test-key-not-a-real-key")).toBe(false)
  })

  it("finds no key-shaped string in any of them", () => {
    const pattern = Option.getOrThrow(packPattern)
    const found = Arr.flatMap(committable(), (path) => {
      let bytes: Buffer
      try {
        bytes = readFileSync(join(root, path))
      } catch {
        return [] // listed by git but deleted in the working tree
      }
      // Binary files are skipped, as `git grep -I` in the pack skips them.
      if (bytes.subarray(0, 8000).includes(0)) return []
      return Arr.flatMap(Str.split(bytes.toString("utf8"), "\n"), (line, index) =>
        pattern.test(line) ? [`${path}:${index + 1}`] : []
      )
    })
    expect(found).toEqual([])
  })
})
