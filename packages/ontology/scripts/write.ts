// @effect-diagnostics nodeBuiltinImport:off
// `bun run ontology:write`: writes the three generated files of report 14 section 8 into this package, from the
// kernel's vocabulary and the thread's graph. Everything that decides a byte is in `src/Generated.ts`; this script
// only puts the texts on disk, which is why it alone in the package reads `node:fs`. Gate 1 fails until what it wrote
// is committed. It reads no clock and no environment.
import { mkdir, writeFile } from "node:fs/promises"
import * as Console from "effect/Console"
import * as Effect from "effect/Effect"
import * as S from "effect/Schema"
import { generatedFiles } from "../src/Generated.ts"

/** A generated file could not be put on disk. */
class NotWritten extends S.TaggedError<NotWritten, { readonly brand: unique symbol }>(
  "@inventory/ontology/scripts/write/NotWritten"
)("NotWritten", {
  path: S.String,
  reason: S.String
}) {}

const write = Effect.fn("ontology.write")(function* () {
  const files = yield* generatedFiles()
  for (const file of files) {
    const target = new URL(`../${file.path}`, import.meta.url)
    yield* Effect.tryPromise({
      try: () => mkdir(new URL("./", target), { recursive: true }).then(() => writeFile(target, file.text, "utf8")),
      catch: (cause) => NotWritten.make({ path: file.path, reason: String(cause) })
    })
    yield* Console.log(`wrote packages/ontology/${file.path}: ${file.triples.length} triples`)
  }
})

void Effect.runPromise(write())
