/**
 * Every block of a model has one file ending, so a reader finds a block by its file's name and Verify's inputs can
 * name each kind by its ending (goals/alchemy-domain-uptake/INVENTORY.md, tests-06; the library's own layout,
 * `@alchemy.run/domain/skills/alchemy-domain/references/layout.md`). In a workspace whose `beep.layer` is `model`, a
 * file under `src` that declares a `Domain.View`, `Query`, `Projection`, `Stream`, `Policy`, `Saga`, `ExternalSystem`,
 * `Api`, `Rewrite` or `Compaction`, or extends `RpcMiddleware.Service`, ends `.view.ts`, `.query.ts`,
 * `.projection.ts`, `.stream.ts`, `.policy.ts`, `.saga.ts`, `.external.ts`, `.api.ts`, `.rewrite.ts`,
 * `.compaction.ts` or `.middleware.ts` (`.tsx`, `.mts` or `.cts` the same, and each refusal keeps the file's own);
 * and a file with one of those endings declares that block and nothing of another kind: no other of the eleven, and
 * no `Domain.Model`, `Aggregate`, `Decision`, `Command`, `Event`, `Rejection`, `RequestContext` or `Relation`, and no
 * hand-written `Context.Service` port. A file ending `.model.ts`, `.aggregate.ts`, `.decision.ts` or `.context.ts`
 * holds blocks of its own, and only the eleven are moved out of it: a command, its events and its rejections beside
 * their aggregate or decision are where the layout puts them, and pass. In a `model` or `contract` workspace two
 * endings are reserved (decision 32: "A `Domain.Command` takes `.command.ts`; a payload left in `contract` becomes
 * `.payload.ts`"): a file ending `.command.ts` declares a `Domain.Command`, and one ending `.external.ts` a
 * `Domain.ExternalSystem`.
 *
 * Each refusal names the file and the line to write: the ending the file should have, when it holds blocks of one kind
 * only and none of the kind its ending names, or else the file beside it a block moves to; for a reserved ending,
 * `.payload.ts` for a payload schema and `.port.ts` for a hand-written `Context.Service` port.
 *
 * The blocks are read from each file's syntax tree (`internal/blocksCode.ts`), never from its text, so a comment, a
 * string or a fixture that names one is not taken for it, and a callee is read through what only wraps it
 * (parentheses, `!`, `as`, `satisfies`, a sequence's last expression). Its limits: a maker reached through a constant
 * of the file's own (`const V = Domain.View`) or through a module that re-exports it is not seen, and tests (files
 * ending `.test.ts` or `.spec.ts`, `.tsx`, `.mts` or `.cts` the same) and declarations (`.d.ts`, `.d.mts`, `.d.cts`)
 * are not read; a test layer (`*.test-layer.ts`) is.
 *
 * @packageDocumentation
 */
import { $RepoCliId } from "@beep/identity/packages"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import { identity } from "effect/Function"
import * as O from "effect/Option"
import * as Order from "effect/Order"
import * as R from "effect/Record"
import * as S from "effect/Schema"
import * as Str from "effect/String"
import { Repo } from "../../Repo.service.ts"
import { err, type Line, out } from "../../Report.schema.ts"
import { type BlockAt, readBlocks } from "./internal/blocksCode.ts"

const $I = $RepoCliId.create("commands/Laws/BlockFiles.rules")

/**
 * What `laws block-files` finds: every block in the file its ending names, or a refusal and each file to change.
 *
 * @category schemas
 */
export const BlockFilesFinding = S.TaggedUnion({
  Held: {
    files: S.Int.pipe(S.annotateKey({ description: "How many files were read" })),
    packages: S.Int.pipe(S.annotateKey({ description: "How many model and contract packages they are in" }))
  },
  Refused: {},
  Misplaced: {
    file: S.String.pipe(S.annotateKey({ description: "The file, from the root" })),
    line: S.Int.pipe(S.annotateKey({ description: "The line the block is declared on, from 1" })),
    name: S.String.pipe(S.annotateKey({ description: "The block's class or constant" })),
    block: S.String.pipe(S.annotateKey({ description: "What declares it, as written: Domain.Policy, ..." })),
    write: S.String.pipe(S.annotateKey({ description: "What to do: the ending to give the file, or where it moves" }))
  },
  Unfilled: {
    file: S.String.pipe(S.annotateKey({ description: "The file, from the root" })),
    ending: S.String.pipe(S.annotateKey({ description: "Its ending, which names a kind of block" })),
    block: S.String.pipe(S.annotateKey({ description: "The block that ending is for" })),
    write: S.String.pipe(S.annotateKey({ description: "What to do: the ending of what the file holds" }))
  },
  Unread: {
    file: S.String.pipe(S.annotateKey({ description: "The file, from the root" })),
    why: S.String.pipe(S.annotateKey({ description: "The parser's first complaint" }))
  }
}).pipe(
  $I.annoteSchema("BlockFilesFinding", {
    description: "Every block of a model in the file its ending names, or each file whose ending is wrong"
  })
)

/**
 * The decoded value of `BlockFilesFinding`.
 *
 * @category models
 */
export type BlockFilesFinding = typeof BlockFilesFinding.Type

/**
 * The line each finding prints.
 *
 * @category rendering
 */
export const blockFilesSentence: (finding: BlockFilesFinding) => Line = BlockFilesFinding.match({
  Held: ({ files, packages }) =>
    out(
      `block-files:check OK  ${plural(files, "file", "files")} in ${plural(packages, "model or contract package", "model and contract packages")}, each block in the file its ending names`
    ),
  Refused: () =>
    err(
      "block-files:check FAIL  a block of a model is not in the file its ending names, or an ending is taken by something else. Write what each line says:"
    ),
  Misplaced: ({ file, line, name, block, write }) => err(`  ${file}:${line} declares ${name} with ${block}: ${write}`),
  Unfilled: ({ file, ending, block, write }) =>
    err(`  ${file} ends ${ending}, which is kept for ${block}, and declares none: ${write}`),
  Unread: ({ file, why }) => err(`  ${file} could not be read, so its blocks were not checked: ${why}`)
})

/** A count and its noun, one or many. */
const plural = (count: number, one: string, many: string): string => `${count} ${count === 1 ? one : many}`

/** The kinds a model's file is named after, each with what declares it as a reader writes it. */
const placed: Readonly<Record<string, string>> = {
  view: "Domain.View",
  query: "Domain.Query",
  projection: "Domain.Projection",
  stream: "Domain.Stream",
  policy: "Domain.Policy",
  saga: "Domain.Saga",
  external: "Domain.ExternalSystem",
  api: "Domain.Api",
  rewrite: "Domain.Rewrite",
  compaction: "Domain.Compaction",
  middleware: "RpcMiddleware.Service"
}

/** The two endings a model or a contract keeps for one block each (decision 32). */
const reserved: Readonly<Record<string, string>> = {
  command: "Domain.Command",
  external: "Domain.ExternalSystem"
}

/** What declares each other kind, as a reader writes it. */
const declarers: Readonly<Record<string, string>> = {
  command: "Domain.Command",
  port: "Context.Service",
  model: "Domain.Model",
  aggregate: "Domain.Aggregate",
  decision: "Domain.Decision",
  event: "Domain.Event",
  rejection: "Domain.Rejection",
  context: "Domain.RequestContext",
  relation: "Domain.Relation"
}

/** The ending each other kind's file takes, where the layout gives it one. */
const homes: Readonly<Record<string, string>> = {
  command: "command",
  port: "port",
  model: "model",
  aggregate: "aggregate",
  decision: "decision",
  rejection: "rejection",
  context: "context"
}

/** Where a block of a kind with no file of its own goes. */
const elsewhere: Readonly<Record<string, string>> = {
  event: "move it to the .aggregate.ts or .command.ts whose command records it",
  relation: "move it into the model's relations, in its .model.ts"
}

/** Endings of files that hold blocks of their own: a block of another kind there moves out, the file keeps its name. */
const holdsItsOwn = ["model", "aggregate", "decision", "context"]

/**
 * A file of a package's code: TypeScript under `src` (`.ts`, `.tsx`, `.mts`, `.cts`), not a test (`*.test.ts`,
 * `*.spec.ts`) and not a declaration (`*.d.ts`, `*.d.mts`, `*.d.cts`).
 */
const isCode = (file: string): boolean =>
  O.isSome(Str.match(/\.(m|c)?tsx?$/)(file)) &&
  O.isNone(Str.match(/\.d\.(m|c)?ts$/)(file)) &&
  O.isNone(Str.match(/\.(test|spec)\.(m|c)?tsx?$/)(file))

/** The file's name, its folder left out. */
const baseOf = (file: string): string => A.lastNonEmpty(Str.split("/")(file))

/** The file's name before its first dot: `Thing` of `Thing.view.ts`. */
const stemOf = (file: string): string => A.headNonEmpty(Str.split(".")(baseOf(file)))

/** The word before `.ts`, when the name has one: `view` of `Thing.view.ts`, and of `Thing.view.mts`. */
const endingOf = (file: string): O.Option<string> =>
  O.flatMap(Str.match(/\.([a-z-]+)\.(m|c)?tsx?$/)(baseOf(file)), (found) => A.get(found, 1))

/** The file's extension, `ts`, `tsx`, `mts` or `cts`, kept when the law names another file for it. */
const extensionOf = (file: string): string =>
  O.match(
    O.flatMap(Str.match(/\.((m|c)?tsx?)$/)(file), (found) => A.get(found, 1)),
    { onNone: () => "ts", onSome: identity }
  )

const has = (blocks: ReadonlyArray<BlockAt>, kind: string): boolean => A.some(blocks, (block) => block.kind === kind)

/** What declares a kind, as a reader writes it. */
const declarerOf = (kind: string): string =>
  O.match(
    O.orElse(R.get(placed, kind), () => R.get(declarers, kind)),
    { onNone: () => kind, onSome: identity }
  )

/** The ending a kind's file takes: its own, a placed one, or none (an event, a relation). */
const homeOf = (kind: string): O.Option<string> => (R.has(placed, kind) ? O.some(kind) : R.get(homes, kind))

/** What a file whose reserved ending is taken by something else is renamed to: a port's ending, or a payload's. */
const freed = (file: string, blocks: ReadonlyArray<BlockAt>): string => {
  const extension = extensionOf(file)
  return has(blocks, "port")
    ? `rename it to ${stemOf(file)}.port.${extension} (a hand-written Context.Service port)`
    : `rename it to ${stemOf(file)}.payload.${extension} (a payload schema), or ${stemOf(file)}.port.${extension} if it is a hand-written Context.Service port`
}

/** The findings of one model file. */
const inModel = (file: string, blocks: ReadonlyArray<BlockAt>): ReadonlyArray<BlockFilesFinding> => {
  const ending = endingOf(file)
  const extension = extensionOf(file)
  const named = O.filter(ending, (word) => R.has(placed, word) || R.has(reserved, word))
  const own = O.exists(named, (word) => has(blocks, word))
  // A file with a placed ending holds its block and nothing else; any other file only gives up the placed blocks.
  const misplaced = O.match(
    O.filter(ending, (word) => R.has(placed, word)),
    {
      onSome: (word) => A.filter(blocks, (block) => block.kind !== word),
      onNone: () => A.filter(blocks, (block) => R.has(placed, block.kind))
    }
  )
  const kinds = A.dedupe(A.map(blocks, (block) => block.kind))
  // Blocks of one kind only, which has an ending, in a file of no block of its own: the file is renamed. Otherwise
  // each block moves to a file beside it.
  const renamedTo = O.filter(
    O.flatMap(A.head(misplaced), (block) => homeOf(block.kind)),
    () => !own && kinds.length === 1 && !O.exists(ending, (word) => A.contains(holdsItsOwn, word))
  )
  const moved = A.map(misplaced, (block) => {
    const name = O.match(block.name, { onNone: () => stemOf(file), onSome: identity })
    return BlockFilesFinding.cases.Misplaced.make({
      file,
      line: block.line,
      name,
      block: declarerOf(block.kind),
      write: O.match(renamedTo, {
        onSome: (word) => `rename the file to ${stemOf(file)}.${word}.${extension}`,
        onNone: () =>
          O.match(homeOf(block.kind), {
            onSome: (word) => `move it to ${name}.${word}.${extension}, beside this file`,
            onNone: () => O.match(R.get(elsewhere, block.kind), { onNone: () => "move it out", onSome: identity })
          })
      })
    })
  })
  const unfilled = O.match(named, {
    onNone: () => A.empty<BlockFilesFinding>(),
    onSome: (word) =>
      own || O.isSome(renamedTo)
        ? A.empty<BlockFilesFinding>()
        : A.of<BlockFilesFinding>(
            BlockFilesFinding.cases.Unfilled.make({
              file,
              ending: `.${word}.${extension}`,
              block: declarerOf(word),
              write: R.has(reserved, word)
                ? freed(file, blocks)
                : `declare its ${declarerOf(word)} here, or give the file the ending of what it holds`
            })
          )
  })
  return A.appendAll(moved, unfilled)
}

/** The findings of one contract file: only its reserved ending is read. */
const inContract = (file: string, blocks: ReadonlyArray<BlockAt>): ReadonlyArray<BlockFilesFinding> =>
  O.match(
    O.filter(endingOf(file), (word) => R.has(reserved, word) && !has(blocks, word)),
    {
      onNone: () => A.empty<BlockFilesFinding>(),
      onSome: (word) =>
        A.of<BlockFilesFinding>(
          BlockFilesFinding.cases.Unfilled.make({
            file,
            ending: `.${word}.${extensionOf(file)}`,
            block: declarerOf(word),
            write: freed(file, blocks)
          })
        )
    }
  )

/**
 * Reads every file of the model and contract packages and holds each block to its file's ending.
 *
 * @category rules
 */
export const blockFiles = Effect.fn("BlockFiles.blockFiles")(function* () {
  const repo = yield* Repo
  const all = yield* repo.workspaces
  const read = A.filter(
    all,
    (workspace) => workspace.manifest.beep?.layer === "model" || workspace.manifest.beep?.layer === "contract"
  )
  const perPackage = yield* Effect.forEach(
    read,
    Effect.fnUntraced(function* (workspace) {
      const model = workspace.manifest.beep?.layer === "model"
      const everything = yield* repo.files(repo.join(workspace.dir, "src"))
      // In the order of their paths, so the refusals come out the same on every machine.
      const files = A.sort(A.filter(everything, isCode), Order.String)
      const findings = yield* Effect.forEach(
        files,
        Effect.fnUntraced(function* (path) {
          const file = repo.relative(path, repo.root)
          const source = yield* repo.text(path)
          const blocks = readBlocks({ file, source })
          return O.match(blocks.unread, {
            onSome: (why) => A.of<BlockFilesFinding>(BlockFilesFinding.cases.Unread.make({ file, why })),
            onNone: () => (model ? inModel(file, blocks.found) : inContract(file, blocks.found))
          })
        }),
        { concurrency: 1 }
      )
      return { files: files.length, findings: A.flatten(findings) }
    }),
    { concurrency: 1 }
  )
  const problems = A.flatMap(perPackage, (one) => one.findings)
  return A.isArrayNonEmpty(problems)
    ? A.prepend<BlockFilesFinding, BlockFilesFinding>(problems, BlockFilesFinding.cases.Refused.make({}))
    : A.of<BlockFilesFinding>(
        BlockFilesFinding.cases.Held.make({
          files: A.reduce(perPackage, 0, (sum, one) => sum + one.files),
          packages: read.length
        })
      )
})
