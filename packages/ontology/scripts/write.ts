// `bun run ontology:write`: writes the three generated files of report 14 section 8 into this package, from the
// kernel's vocabulary and the thread's graph. Everything that decides a byte is in `src/Generated.ts`; this script
// only puts the texts on disk, through Bun's file system service. Gate 1 fails until what it wrote is committed. It
// reads no clock and no environment.
import * as BunRuntime from "@effect/platform-bun/BunRuntime"
import * as BunServices from "@effect/platform-bun/BunServices"
import * as Console from "effect/Console"
import * as Effect from "effect/Effect"
import * as FileSystem from "effect/FileSystem"
import * as Layer from "effect/Layer"
import * as Path from "effect/Path"
import { generatedFiles } from "../src/Generated.ts"

const write = Effect.fn("ontology.write")(function* () {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const root = yield* path.fromFileUrl(new URL("../", import.meta.url))
  const files = yield* generatedFiles()
  yield* Effect.forEach(
    files,
    (file) =>
      Effect.gen(function* () {
        const target = path.join(root, file.path)
        yield* fs.makeDirectory(path.dirname(target), { recursive: true })
        yield* fs.writeFileString(target, file.text)
        yield* Console.log(`wrote packages/ontology/${file.path}: ${file.triples.length} triples`)
      }),
    { concurrency: 1, discard: true }
  )
})

// The script is the entry point: Bun's services are built once, for the run.
Layer.build(BunServices.layer).pipe(
  Effect.flatMap((context) => write().pipe(Effect.provideContext(context))),
  Effect.scoped,
  BunRuntime.runMain
)
