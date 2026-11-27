/**
 * Every block of a model has the file its kind is kept in, so a reader finds a block by its file's name and Verify's
 * inputs can name each kind by its ending (goals/alchemy-domain-uptake/INVENTORY.md, tests-06; the library's own
 * layout, `@alchemy.run/domain/skills/alchemy-domain/references/layout.md`; Benjamin, 2026-11-26, "Hold all kinds").
 *
 * In a workspace whose `beep.layer` is `model`, every block under `src` sits in a file whose ending keeps its kind:
 * a `Domain.View`, `Query`, `Projection`, `Stream`, `Policy`, `Saga`, `ExternalSystem`, `Api`, `Rewrite` or
 * `Compaction`, and a class extending `RpcMiddleware.Service`, in `.view.ts`, `.query.ts`, `.projection.ts`,
 * `.stream.ts`, `.policy.ts`, `.saga.ts`, `.external.ts`, `.api.ts`, `.rewrite.ts`, `.compaction.ts` or
 * `.middleware.ts`, and a file with one of those endings holds that block alone; a `Domain.Model` in `.model.ts`, with
 * the `Domain.Relation`s it lists; a `Domain.Aggregate` in `.aggregate.ts`, a `Domain.Decision` in `.decision.ts`;
 * a `Domain.Command`, its `Domain.Event`s and its `Domain.Rejection`s in `.command.ts` or beside the aggregate or
 * decision that decides it (the layout's `OpenAccount.command.ts`, "command + its events + its rejections"; the
 * catalog's aggregates and decisions hold theirs), and a rejection shared by several commands in `.rejection.ts`; a
 * `Domain.RequestContext` in `.context.ts`, with the schema it carries. A hand-written `Context.Service` port is free
 * in any other file (`.port.ts`, `.store.ts`, a memory twin), and refused in a file with one of those endings. (`.tsx`,
 * `.mts` or `.cts` the same, and each refusal keeps the file's own.) In a `model` or `contract` workspace two endings
 * are reserved (decision 32: "A `Domain.Command` takes `.command.ts`; a payload left in `contract` becomes
 * `.payload.ts`"): a file ending `.command.ts` declares a `Domain.Command`, and one ending `.external.ts` a
 * `Domain.ExternalSystem`. In a `contract` workspace no other block of the library is declared at all: those two in
 * their own endings only, and any other moves to the model package beside it. A port and an `RpcMiddleware.Service`
 * are not the library's, and a contract keeps its gateways.
 *
 * Each refusal names the file, the block by its own name and what to write: the ending the file should have, when its
 * blocks are of one kind, none of them the kind its ending names, and it holds no other code; or else the file the
 * block moves to, beside it or in the model package. An event is sent to its command's file when the file holds one
 * command, and a relation to the package's `.model.ts` when it has exactly one; otherwise the refusal names the kinds
 * of file it may go to. Only the reserved and the eleven endings must hold their block: a `.model.ts`, `.aggregate.ts`,
 * `.decision.ts`, `.rejection.ts` or `.context.ts` that declares none is not refused, and is left to review.
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

/** Beside the aggregate or the decision that decides it: a command, its events and its rejections. */
const besideItsDecider = ["command", "event", "rejection"]

/**
 * The endings of a model's block files, each with the kinds a file with it may hold. A kind that is not under an
 * ending is refused there, and a port, which no ending keeps, is refused under every one of them.
 */
const holds: Readonly<Record<string, ReadonlyArray<string>>> = {
  ...R.map(placed, (_declarer, kind) => A.of(kind)),
  command: besideItsDecider,
  model: ["model", "relation"],
  aggregate: A.prepend(besideItsDecider, "aggregate"),
  decision: A.prepend(besideItsDecider, "decision"),
  rejection: ["rejection"],
  context: ["context"]
}

/** The ending each other kind's file takes when it moves: a port's, or the first of its homes. */
const homes: Readonly<Record<string, string>> = {
  command: "command",
  port: "port",
  model: "model",
  aggregate: "aggregate",
  decision: "decision",
  rejection: "rejection",
  context: "context"
}

/** The kinds a contract may declare, `Context.Service` and `RpcMiddleware.Service`, which are not the library's. */
const notTheLibrarys = ["port", "middleware"]

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

/** Whether a model's block may sit in a file with this ending: under an ending that keeps it, or a port under none. */
const keptBy = (ending: O.Option<string>, kind: string): boolean => {
  const kinds = O.flatMap(ending, (word) => R.get(holds, word))
  return kind === "port" ? O.isNone(kinds) : O.exists(kinds, (held) => A.contains(held, kind))
}

/** The block's own name, or the file's when it gave none. */
const nameOf = (file: string, block: BlockAt): string =>
  O.match(block.name, { onNone: () => stemOf(file), onSome: identity })

/** What a file whose reserved ending is taken by something else is renamed to: a port's ending, or a payload's. */
const freed = (file: string, blocks: ReadonlyArray<BlockAt>): string => {
  const extension = extensionOf(file)
  return has(blocks, "port")
    ? `rename it to ${stemOf(file)}.port.${extension} (a hand-written Context.Service port)`
    : `rename it to ${stemOf(file)}.payload.${extension} (a payload schema), or ${stemOf(file)}.port.${extension} if it is a hand-written Context.Service port`
}

/**
 * The ending a file is renamed to: when every block it holds is of one kind, all of them out of place, none of them
 * the kind its own ending names, and it holds no other code. Otherwise each block moves to a file beside it.
 */
const renameTo = (
  ending: O.Option<string>,
  blocks: ReadonlyArray<BlockAt>,
  misplaced: ReadonlyArray<BlockAt>,
  alone: boolean
): O.Option<string> =>
  O.filter(
    O.flatMap(A.head(misplaced), (block) => homeOf(block.kind)),
    () =>
      alone &&
      misplaced.length === blocks.length &&
      A.dedupe(A.map(blocks, (block) => block.kind)).length === 1 &&
      !O.exists(ending, (word) => has(blocks, word))
  )

/** What one package's files show the law, read once: the package's one `.model.ts`, when it has exactly one. */
interface Package {
  readonly model: O.Option<string>
}

/** Where a block with no file of its own (an event, a relation) or one of its kind (a rejection) goes in a model. */
const besideInModel = (
  file: string,
  block: BlockAt,
  blocks: ReadonlyArray<BlockAt>,
  pkg: Package
): O.Option<string> => {
  const extension = extensionOf(file)
  const commands = A.filter(blocks, (other) => other.kind === "command")
  const withItsCommand = O.map(
    commands.length === 1 ? A.head(commands) : O.none(),
    (command) =>
      `move it to ${nameOf(file, command)}.command.${extension}, beside this file, with the command that records it`
  )
  return block.kind === "event"
    ? O.orElse(withItsCommand, () =>
        O.some(
          `move it to the .command.${extension}, .aggregate.${extension} or .decision.${extension} of the command that records it`
        )
      )
    : block.kind === "rejection"
      ? withItsCommand
      : block.kind === "relation"
        ? O.some(
            O.match(pkg.model, {
              onNone: () => "move it into the relations of the package's .model.ts",
              onSome: (model) => `move it into the relations of the model in ${model}`
            })
          )
        : O.none()
}

/** The findings of one model file. */
const inModel = (
  file: string,
  read: { readonly found: ReadonlyArray<BlockAt>; readonly alone: boolean },
  pkg: Package
): ReadonlyArray<BlockFilesFinding> => {
  const blocks = read.found
  const ending = endingOf(file)
  const extension = extensionOf(file)
  const named = O.filter(ending, (word) => R.has(placed, word) || R.has(reserved, word))
  const own = O.exists(named, (word) => has(blocks, word))
  const misplaced = A.filter(blocks, (block) => !keptBy(ending, block.kind))
  const renamedTo = renameTo(ending, blocks, misplaced, read.alone)
  const moved = A.map(misplaced, (block) => {
    const name = nameOf(file, block)
    return BlockFilesFinding.cases.Misplaced.make({
      file,
      line: block.line,
      name,
      block: declarerOf(block.kind),
      write: O.match(renamedTo, {
        onSome: (word) => `rename the file to ${stemOf(file)}.${word}.${extension}`,
        onNone: () =>
          O.match(besideInModel(file, block, blocks, pkg), {
            onSome: identity,
            onNone: () =>
              O.match(homeOf(block.kind), {
                onSome: (word) => `move it to ${name}.${word}.${extension}, beside this file`,
                onNone: () => "move it out"
              })
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

/**
 * The findings of one contract file. `model` is the folder of the model package beside the contract that the file's
 * own folder matches (`packages/shop/model/src/Basket` for `packages/shop/contract/src/Basket/Watch.view.ts`), when
 * the context has one.
 */
const inContract = (
  file: string,
  read: { readonly found: ReadonlyArray<BlockAt>; readonly alone: boolean },
  model: O.Option<string>
): ReadonlyArray<BlockFilesFinding> => {
  const blocks = read.found
  const ending = endingOf(file)
  const extension = extensionOf(file)
  const misplaced = A.filter(
    blocks,
    (block) =>
      !A.contains(notTheLibrarys, block.kind) && !(R.has(reserved, block.kind) && O.contains(ending, block.kind))
  )
  const renamedTo = O.filter(renameTo(ending, blocks, misplaced, read.alone), (word) => R.has(reserved, word))
  const moved = A.map(misplaced, (block) => {
    const name = nameOf(file, block)
    const declarer = declarerOf(block.kind)
    const inTheModel = (place: string): string =>
      O.match(model, {
        onNone: () => `a contract declares no ${declarer}: move it to ${place} in the context's model package`,
        onSome: (folder) => `a contract declares no ${declarer}: move it to ${folder}/${place}`
      })
    return BlockFilesFinding.cases.Misplaced.make({
      file,
      line: block.line,
      name,
      block: declarer,
      write: R.has(reserved, block.kind)
        ? O.match(renamedTo, {
            onSome: (word) => `rename the file to ${stemOf(file)}.${word}.${extension}`,
            onNone: () => `move it to ${name}.${block.kind}.${extension}, beside this file`
          })
        : O.match(homeOf(block.kind), {
            onSome: (word) => inTheModel(`${name}.${word}.${extension}`),
            onNone: () =>
              block.kind === "relation"
                ? `a contract declares no ${declarer}: move it into the relations of the model's .model.${extension}`
                : `a contract declares no ${declarer}: move it to the model package, beside the command that records it`
          })
    })
  })
  const unfilled = O.match(
    O.filter(ending, (word) => R.has(reserved, word) && !has(blocks, word) && O.isNone(renamedTo)),
    {
      onNone: () => A.empty<BlockFilesFinding>(),
      onSome: (word) =>
        A.of<BlockFilesFinding>(
          BlockFilesFinding.cases.Unfilled.make({
            file,
            ending: `.${word}.${extension}`,
            block: declarerOf(word),
            write: freed(file, blocks)
          })
        )
    }
  )
  return A.appendAll(moved, unfilled)
}

/**
 * Reads every file of the model and contract packages and holds each block to its file's ending.
 *
 * @category rules
 */
export const blockFiles = Effect.fn("BlockFiles.blockFiles")(function* () {
  const repo = yield* Repo
  const all = yield* repo.workspaces
  const layered = A.map(
    A.filter(
      all,
      (workspace) => workspace.manifest.beep?.layer === "model" || workspace.manifest.beep?.layer === "contract"
    ),
    (workspace) => ({ dir: workspace.dir, model: workspace.manifest.beep?.layer === "model" })
  )
  const perPackage = yield* Effect.forEach(
    layered,
    Effect.fnUntraced(function* (workspace) {
      const src = repo.join(workspace.dir, "src")
      const everything = yield* repo.files(src)
      // In the order of their paths, so the refusals come out the same on every machine.
      const files = A.sort(A.filter(everything, isCode), Order.String)
      const models = A.filter(files, (path) => O.contains(endingOf(path), "model"))
      const pkg: Package = {
        model: O.map(
          O.filter(A.head(models), () => models.length === 1),
          (path) => repo.relative(path, repo.root)
        )
      }
      // The model package of the same context, for a block a contract moves out: the model folder beside it.
      const twin = A.findFirst(
        layered,
        (other) => other.model && repo.dirname(other.dir) === repo.dirname(workspace.dir)
      )
      const findings = yield* Effect.forEach(
        files,
        Effect.fnUntraced(function* (path) {
          const file = repo.relative(path, repo.root)
          const source = yield* repo.text(path)
          const blocks = readBlocks({ file, source })
          return O.match(blocks.unread, {
            onSome: (why) => A.of<BlockFilesFinding>(BlockFilesFinding.cases.Unread.make({ file, why })),
            onNone: () =>
              workspace.model
                ? inModel(file, blocks, pkg)
                : inContract(
                    file,
                    blocks,
                    O.map(twin, (other) =>
                      repo.relative(repo.join(other.dir, "src", repo.relative(repo.dirname(path), src)), repo.root)
                    )
                  )
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
          packages: layered.length
        })
      )
})
