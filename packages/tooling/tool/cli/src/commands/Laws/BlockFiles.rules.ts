/**
 * Every block of a model has the file its kind is kept in, so a reader finds a block by its file's name and Verify's
 * inputs can name each kind by its ending (goals/alchemy-domain-uptake/INVENTORY.md, tests-06; the library's own
 * layout, `@alchemy.run/domain/skills/alchemy-domain/references/layout.md`; Benjamin, 2026-11-26, "Hold all kinds").
 *
 * In a workspace whose `beep.layer` is `model`, every block under `src` sits in a file whose ending keeps its kind:
 * a `Domain.View`, `Query`, `Projection`, `Stream`, `Policy`, `Saga`, `ExternalSystem`, `Api`, `Rewrite` or
 * `Compaction`, and a class extending `RpcMiddleware.Service`, in `.view.ts`, `.query.ts`, `.projection.ts`,
 * `.stream.ts`, `.policy.ts`, `.saga.ts`, `.external.ts`, `.api.ts`, `.rewrite.ts`, `.compaction.ts` or
 * `.middleware.ts`, and a file with one of those endings holds that block alone, but for three second kinds the
 * library's own templates write beside it, each only in a file that holds its block: a `Domain.Event` beside the view
 * that emits it (`Statement.view.ts`, the example in `@alchemy.run/domain/src/View.ts`, "Emitting events") and beside
 * the stream whose entries it is (`AccountCard.stream.ts`, `references/building-blocks.md`, "Stream"), and a
 * `Domain.Rejection` beside the saga that fails with it (the example in `@alchemy.run/domain/src/Saga.ts`, "Declaring a
 * saga"). No other template does: `src/Decision.ts`'s example writes a whole model in one block of code, and
 * `building-blocks.md`, "Decision", puts the same in a file each. A `Domain.Model` sits in `.model.ts`, with the
 * `Domain.Relation`s it lists; a `Domain.Aggregate` in `.aggregate.ts`, a `Domain.Decision` in `.decision.ts`; a
 * `Domain.Command`, its `Domain.Event`s and its `Domain.Rejection`s in `.command.ts` (the layout's
 * `OpenAccount.command.ts`, "command + its events + its rejections") or in a `.aggregate.ts` or `.decision.ts` that
 * holds the aggregate or decision deciding it (the catalog's hold theirs), and a rejection shared by several commands
 * in `.rejection.ts`; a `Domain.RequestContext` in `.context.ts`, with the schema it carries. A relation in a
 * `.model.ts`, and a command, event or rejection in a `.aggregate.ts` or `.decision.ts`, is kept only where the file
 * declares its model, aggregate or decision. A hand-written `Context.Service` port is free in any other file
 * (`.port.ts`, a memory twin), and refused in a file with one of those endings. (`.tsx`, `.mts` or `.cts`
 * the same, and each refusal keeps the file's own.)
 *
 * In a `model` or `contract` workspace two endings are reserved (decision 32: "A `Domain.Command` takes `.command.ts`;
 * a payload left in `contract` becomes `.payload.ts`"): a file ending `.command.ts` declares a `Domain.Command`, and
 * one ending `.external.ts` a `Domain.ExternalSystem`. In a `contract` workspace those two endings hold their block and
 * nothing else of what this law reads, ports and `RpcMiddleware.Service`s included, but that a contract's
 * `.command.ts` holds its command's events and rejections beside it, as a model's does (the law's owner's call,
 * 2026-11-26, not a decision of Benjamin's: a contract cannot import its model, so a command left there keeps what it
 * records and refuses with). Outside those two endings a contract declares no block of the library, and any other
 * moves to the model package beside it; its ports and `RpcMiddleware.Service`s, which are not the library's, are free
 * there, so a contract keeps its ports.
 *
 * Each refusal names the file, the block by its own name and what to write: the ending the file should have, when its
 * blocks are of one kind, none of them the kind its ending names, and it holds no other code; or else the file the
 * block moves to, beside it or in the model package. An event or a rejection is sent to its command's file when the
 * file holds one command, a lone rejection of a model to its own `.rejection.ts`, and a relation to the package's
 * `.model.ts` when exactly one file declares a model; otherwise the refusal names the kinds of file it may go to. Only
 * the reserved and the eleven endings must hold their block: a `.model.ts`, `.aggregate.ts`, `.decision.ts`,
 * `.rejection.ts` or `.context.ts` that declares none of its own is not refused for that, and is left to review.
 *
 * Every ending and layer comes from the registry of kinds (`Kinds.schema.ts`; goals/module-kinds, steps 1 and 2). In a
 * workspace whose `beep.layer` is `contract`, `model`, `host` or `web`, each file under `src` but those under
 * `internal/` has an ending that names a kind its layer holds: a file with no ending, an ending that is no kind, one
 * that says what another kind says (`.store.ts`, a port's) and a kind of another layer are each refused. A host's and
 * a web's files are asked their ending and their imports only.
 *
 * A file whose ending is an event's or a command's is read as a namespace named for its stem (explorations/
 * module-taxonomy, decision 2), so three things hold of it: its block's tag is the file's stem, the block is exported
 * as `Event` or `Command`, and in a model `evolve` or `decide` is exported beside it; and no file of the four layers
 * picks `Event` or `Command` by name out of such a file, a type included. A model's or a contract's `.event.ts` holds
 * its event alone. A module's files of a kind that takes a folder (`commands/`, `events/`) sit beside the module's
 * own while they are five or fewer and in that folder when they are more (decision 8a); the union that joins them is
 * not counted. Until the models' events and commands have moved, an event or a command is still kept in its
 * decider's file as well.
 *
 * The blocks are read from each file's syntax tree (`internal/blocksCode.ts`), never from its text, so a comment, a
 * string or a fixture that names one is not taken for it, and a callee is read through what only wraps it
 * (parentheses, `!`, `as`, `satisfies`, an optional chain, a sequence's last expression); a namespace bound by
 * `import Domain = require("@alchemy.run/domain")` is read like `import * as`. Its limits: a maker reached through a
 * name of the file's own (`const V = Domain.View`, `import V = Domain.View`), through a module that re-exports it, or
 * called through `.call(...)` or `.apply(...)` is not seen, and tests (files ending `.test.ts` or `.spec.ts`, `.tsx`,
 * `.mts` or `.cts` the same) and declarations (`.d.ts`, `.d.mts`, `.d.cts`) are not read; a test layer
 * (`*.test-layer.ts`) is.
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
import * as Result from "effect/Result"
import * as S from "effect/Schema"
import * as Str from "effect/String"
import { Repo } from "../../Repo.service.ts"
import { err, type Line, out } from "../../Report.schema.ts"
import { type BlockAt, type BlocksRead, readBlocks } from "./internal/blocksCode.ts"
import { endingOf, kinds, Layer, place, Placement } from "./Kinds.schema.ts"

const $I = $RepoCliId.create("commands/Laws/BlockFiles.rules")

/**
 * What `laws block-files` finds: every block in the file its ending names, or a refusal and each file to change.
 *
 * @category schemas
 */
export const BlockFilesFinding = S.TaggedUnion({
  Held: {
    files: S.Int.pipe(S.annotateKey({ description: "How many files were read" })),
    packages: S.Int.pipe(S.annotateKey({ description: "How many packages of a context they are in" }))
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
  },
  Unshaped: {
    file: S.String.pipe(S.annotateKey({ description: "The file, from the root" })),
    line: S.Int.pipe(S.annotateKey({ description: "The line it is written on, from 1" })),
    says: S.String.pipe(S.annotateKey({ description: "What is not as its kind's file is written" })),
    write: S.String.pipe(S.annotateKey({ description: "What to write instead" }))
  },
  Unkind: {
    file: S.String.pipe(S.annotateKey({ description: "The file or folder, from the root" })),
    says: S.String.pipe(S.annotateKey({ description: "What is wrong with its ending" })),
    write: S.String.pipe(S.annotateKey({ description: "What to do: the name to give it, or where it moves" }))
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
      `block-files:check OK  ${plural(files, "file", "files")} in ${plural(packages, "package of a context", "packages of a context")}, each ending a kind its layer holds and each block in the file its ending names`
    ),
  Refused: () =>
    err(
      "block-files:check FAIL  a file's ending is not a kind its layer holds, a block of a model is not in the file its ending names, or an ending is taken by something else. Write what each line says:"
    ),
  Misplaced: ({ file, line, name, block, write }) => err(`  ${file}:${line} declares ${name} with ${block}: ${write}`),
  Unfilled: ({ file, ending, block, write }) =>
    err(`  ${file} ends ${ending}, which is kept for ${block}, and declares none: ${write}`),
  Unread: ({ file, why }) => err(`  ${file} could not be read, so its blocks were not checked: ${why}`),
  Unshaped: ({ file, line, says, write }) => err(`  ${file}:${line} ${says}: ${write}`),
  Unkind: ({ file, says, write }) => err(`  ${file} ${says}: ${write}`)
})

/** A count and its noun, one or many. */
const plural = (count: number, one: string, many: string): string => `${count} ${count === 1 ? one : many}`

/** The registry's kinds that name a block of a model, each with what declares it as a reader writes it. */
const blocks: Readonly<Record<string, string>> = R.getSomes(R.map(kinds, (kind) => kind.block))

/** The endings a file must declare the block of: a view's, a policy's, a command's. */
const alone: Readonly<Record<string, string>> = R.filter(blocks, (_declarer, ending) =>
  O.exists(R.get(kinds, ending), (kind) => kind.alone)
)

/**
 * The endings a model or a contract keeps for one block each (decision 32): the ones a file must declare the block
 * of and a contract holds, a command's and an external system's.
 */
const reserved: Readonly<Record<string, string>> = R.filter(alone, (_declarer, ending) =>
  O.exists(R.get(kinds, ending), (kind) => A.contains(kind.heldBy, "contract"))
)

/** What declares a block that no ending names, as a reader writes it. */
const unplaced: Readonly<Record<string, string>> = {
  relation: "Domain.Relation"
}

/**
 * The two kinds whose file is read as a namespace named for its stem (decision 2), each with the name its block is
 * exported under and what a model's file of it exports beside the block.
 */
const roles: Readonly<Record<string, { readonly block: string; readonly beside: string }>> = {
  event: { block: "Event", beside: "evolve" },
  command: { block: "Command", beside: "decide" }
}

/** More files of one kind than this in a module, and the kind takes a folder (decision 8a). */
const flatAtMost = 5

/** The kinds that take a folder, each with the folder's name. */
const folders: Readonly<Record<string, string>> = R.getSomes(R.map(kinds, (kind) => kind.folder))

/**
 * The endings of a model's block files, each with the kinds a file with it may hold whatever else it declares. A kind
 * that is not under an ending, nor kept beside its block (`besideItsOwn`), is refused there, and a port, which no
 * ending keeps, is refused under every one of them.
 */
const holds: Readonly<Record<string, ReadonlyArray<string>>> = R.filter(
  R.map(kinds, (kind) => kind.holds),
  A.isReadonlyArrayNonEmpty
)

/**
 * The kinds an ending keeps only in a file that declares the block the ending names: a model's relations, a
 * decider's commands, events and rejections, and the second kinds the library's templates write beside a view, a
 * stream and a saga.
 */
const besideItsOwn: Readonly<Record<string, ReadonlyArray<string>>> = R.filter(
  R.map(kinds, (kind) => kind.beside),
  A.isReadonlyArrayNonEmpty
)

/** What a contract may declare outside its two endings: a port and a middleware, which the library does not make. */
const notTheLibrarys = R.keys(R.filter(blocks, (declarer) => !Str.startsWith("Domain.")(declarer)))

/** What a contract's `.command.ts` holds beside its command, as a model's does. */
const besideItsCommand = ["event", "rejection"]

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
    O.orElse(R.get(blocks, kind), () => R.get(unplaced, kind)),
    { onNone: () => kind, onSome: identity }
  )

/** The ending a kind's file takes: its own, when the registry has one for it, or none (an event, a relation). */
const homeOf = (kind: string): O.Option<string> => (R.has(blocks, kind) ? O.some(kind) : O.none())

/**
 * Whether a model's block may sit in a file with this ending: under an ending that keeps it, beside the block the
 * ending names when the file declares it, or a port under none.
 */
const keptBy = (ending: O.Option<string>, kind: string, blocks: ReadonlyArray<BlockAt>): boolean => {
  const kinds = O.flatMap(ending, (word) => R.get(holds, word))
  const besideOwn = O.exists(
    ending,
    (word) => has(blocks, word) && O.exists(R.get(besideItsOwn, word), (beside) => A.contains(beside, kind))
  )
  return kind === "port" ? O.isNone(kinds) : besideOwn || O.exists(kinds, (held) => A.contains(held, kind))
}

/** The block's own name, or the file's when it gave none. */
const nameOf = (file: string, block: BlockAt): string =>
  O.match(block.name, { onNone: () => stemOf(file), onSome: identity })

/**
 * The stem of the file a block moves to: its tag when its kind's file is named for one (an event's, a command's), and
 * its own name otherwise.
 */
const stemFor = (file: string, block: BlockAt): string =>
  R.has(roles, block.kind) ? O.getOrElse(block.tag, () => nameOf(file, block)) : nameOf(file, block)

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

/** The package of a context that holds a kind, as a refusal names it: "the model", "the contract or the model". */
const holders = (heldBy: ReadonlyArray<Layer>): string => `the ${A.join(heldBy, " or the ")}`

/** What the registry refuses of a file's ending in its layer, when it refuses anything. */
const unkind = (file: string, layer: Layer): O.Option<BlockFilesFinding> => {
  const extension = extensionOf(file)
  const refused = (says: string, write: string): O.Option<BlockFilesFinding> =>
    O.some(BlockFilesFinding.cases.Unkind.make({ file, says, write }))
  return Placement.match(place({ file, layer }), {
    Held: () => O.none(),
    NoEnding: () =>
      refused(
        "has no ending, so nothing says what kind of file it is",
        `name it ${stemOf(file)}.<kind>.${extension}, with a kind the registry holds for a ${layer} (Kinds.schema.ts)`
      ),
    Unknown: ({ ending }) =>
      refused(
        `ends .${ending}.${extension}, which is no kind in the registry`,
        `give it the ending of a kind a ${layer} holds, or add the kind to the registry (Kinds.schema.ts)`
      ),
    Renamed: ({ ending, to }) =>
      refused(
        `ends .${ending}.${extension}, which says what .${to}.${extension} says`,
        `rename it to ${stemOf(file)}.${to}.${extension}`
      ),
    WrongLayer: ({ ending, heldBy }) =>
      refused(
        `ends .${ending}.${extension}, a kind a ${layer} does not hold`,
        `move it to ${holders(heldBy)} package of its context, or give it the ending of what it is`
      )
  })
}

/**
 * What decision 2 asks of a file whose ending is an event's or a command's and which declares one: the block's tag is
 * the file's stem, the block is exported as `Event` or `Command`, and a model's file exports `evolve` or `decide`
 * beside it. A contract's command has no `decide`: what decides it is in the model.
 */
const shaped = (file: string, read: BlocksRead, inModel: boolean): ReadonlyArray<BlockFilesFinding> => {
  const stem = stemOf(file)
  const extension = extensionOf(file)
  return O.match(
    O.flatMap(endingOf(file), (ending) => O.map(R.get(roles, ending), (role) => ({ ending, role }))),
    {
      onNone: () => A.empty<BlockFilesFinding>(),
      onSome: ({ ending, role }) => {
        const own = A.filter(read.found, (block) => block.kind === ending)
        const refused = (line: number, says: string, write: string): BlockFilesFinding =>
          BlockFilesFinding.cases.Unshaped.make({ file, line, says, write })
        const perBlock = A.flatMap(own, (block) => {
          const tag = O.getOrElse(block.tag, () => "")
          const name = O.getOrElse(block.name, () => "")
          const stemmed =
            O.isSome(block.tag) && tag !== stem
              ? [
                  refused(
                    block.line,
                    `declares the ${ending} "${tag}" in a file named ${stem}`,
                    `a file's stem is its ${ending}'s tag, and it holds one: move it to ${tag}.${ending}.${extension}`
                  )
                ]
              : []
          const called =
            name === role.block
              ? []
              : [
                  refused(
                    block.line,
                    `names its ${ending}'s class ${name}`,
                    `export it as ${role.block}, read as ${stem}.${role.block} through \`import * as ${stem}\``
                  )
                ]
          return A.appendAll(stemmed, called)
        })
        const beside =
          inModel && A.isReadonlyArrayNonEmpty(own) && !A.contains(read.exported, role.beside)
            ? [
                refused(
                  A.headNonEmpty(own).line,
                  `exports no ${role.beside}`,
                  `export \`${role.beside}\` beside ${role.block}, read as ${stem}.${role.beside}`
                )
              ]
            : []
        return A.appendAll(perBlock, beside)
      }
    }
  )
}

/** An import that picks `Event` or `Command` out of an event's or a command's file, which nine files answer to. */
const pickedByName = (file: string, read: BlocksRead): ReadonlyArray<BlockFilesFinding> =>
  A.flatMap(read.picked, (pick) =>
    O.match(
      O.filter(endingOf(pick.from), (ending) => O.exists(R.get(roles, ending), (role) => role.block === pick.imported)),
      {
        onNone: () => A.empty<BlockFilesFinding>(),
        onSome: () =>
          A.of<BlockFilesFinding>(
            BlockFilesFinding.cases.Unshaped.make({
              file,
              line: pick.line,
              says: `imports ${pick.imported} by name from ${pick.from}`,
              write: `import the file whole, \`import * as ${stemOf(pick.from)} from "${pick.from}"\`, and write ${stemOf(pick.from)}.${pick.imported}`
            })
          )
      }
    )
  )

/**
 * What decision 8a asks of a package's folders: a module's files of a kind that takes a folder sit beside the module's
 * own while they are five or fewer, and in a folder named for the kind when they are more.
 */
const foldered = (files: ReadonlyArray<string>, folderOf: (file: string) => string): ReadonlyArray<BlockFilesFinding> =>
  A.flatMap(R.toEntries(folders), ([ending, folder]) => {
    const ofKind = A.filter(files, (file) => O.contains(endingOf(file), ending))
    const dirs = A.sort(A.dedupe(A.map(ofKind, folderOf)), Order.String)
    return A.flatMap(dirs, (dir) => {
      const count = A.filter(ofKind, (file) => folderOf(file) === dir).length
      const inItsFolder = baseOf(dir) === folder
      const many = plural(count, `${ending} file`, `${ending} files`)
      return inItsFolder && count <= flatAtMost
        ? [
            BlockFilesFinding.cases.Unkind.make({
              file: dir,
              says: `holds ${many}, and a folder is for more than ${flatAtMost}`,
              write: "move them up, beside their module's own files"
            })
          ]
        : !inItsFolder && count > flatAtMost
          ? [
              BlockFilesFinding.cases.Unkind.make({
                file: dir,
                says: `holds ${many}, more than ${flatAtMost}`,
                write: `move them into ${dir}/${folder}/, with the union that joins them`
              })
            ]
          : []
    })
  })

/** What one package's files show the law, read once: the package's one file that declares a model, when it has one. */
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
      `move it to ${stemFor(file, command)}.command.${extension}, beside this file, with the command that records it`
  )
  return block.kind === "event"
    ? O.none()
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
  const named = O.filter(ending, (word) => R.has(alone, word))
  const own = O.exists(named, (word) => has(blocks, word))
  const misplaced = A.filter(blocks, (block) => !keptBy(ending, block.kind, blocks))
  const renamedTo = renameTo(ending, blocks, misplaced, read.alone)
  const moved = A.map(misplaced, (block) => {
    const name = nameOf(file, block)
    return BlockFilesFinding.cases.Misplaced.make({
      file,
      line: block.line,
      name,
      block: declarerOf(block.kind),
      write: O.match(renamedTo, {
        onSome: (word) =>
          `rename the file to ${R.has(roles, word) ? stemFor(file, block) : stemOf(file)}.${word}.${extension}`,
        onNone: () =>
          O.match(besideInModel(file, block, blocks, pkg), {
            onSome: identity,
            onNone: () =>
              O.match(homeOf(block.kind), {
                onSome: (word) => `move it to ${stemFor(file, block)}.${word}.${extension}, beside this file`,
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

/** The kinds a contract keeps in a file of their own ending: its two reserved blocks, its ports and middleware. */
const ofTheContract = A.appendAll(R.keys(reserved), notTheLibrarys)

/**
 * Whether a contract's block may sit in a file with this ending: in `.command.ts` a command with its events and
 * rejections, in `.external.ts` an external system, each alone; under any other ending a port or a middleware.
 */
const keptByContract = (ending: O.Option<string>, kind: string): boolean =>
  O.match(
    O.filter(ending, (word) => R.has(reserved, word)),
    {
      onNone: () => A.contains(notTheLibrarys, kind),
      onSome: (word) => kind === word || (word === "command" && A.contains(besideItsCommand, kind))
    }
  )

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
  const misplaced = A.filter(blocks, (block) => !keptByContract(ending, block.kind))
  const renamedTo = O.filter(renameTo(ending, blocks, misplaced, read.alone), (word) => A.contains(ofTheContract, word))
  const commands = A.filter(blocks, (other) => other.kind === "command")
  const command = commands.length === 1 ? A.head(commands) : O.none()
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
      write: A.contains(ofTheContract, block.kind)
        ? O.match(renamedTo, {
            onSome: (word) => `rename the file to ${stemOf(file)}.${word}.${extension}`,
            onNone: () => `move it to ${stemFor(file, block)}.${block.kind}.${extension}, beside this file`
          })
        : A.contains(besideItsCommand, block.kind)
          ? O.match(command, {
              onSome: (one) =>
                `move it to ${stemFor(file, one)}.command.${extension}, beside this file, with the command that records it`,
              onNone: () =>
                `a contract declares a ${declarer} only beside its command, in .command.${extension}: move it to the file of the command that ${block.kind === "event" ? "records" : "refuses with"} it`
            })
          : O.match(homeOf(block.kind), {
              onSome: (word) => inTheModel(`${stemFor(file, block)}.${word}.${extension}`),
              onNone: () =>
                `a contract declares no ${declarer}: move it into the relations of the model's .model.${extension}`
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
  const layered = A.filterMap(all, (workspace) =>
    O.match(S.decodeUnknownOption(Layer)(workspace.manifest.beep?.layer), {
      onNone: () => Result.failVoid,
      onSome: (layer) => Result.succeed({ dir: workspace.dir, layer, model: layer === "model" })
    })
  )
  const perPackage = yield* Effect.forEach(
    layered,
    Effect.fnUntraced(function* (workspace) {
      const src = repo.join(workspace.dir, "src")
      const everything = yield* repo.files(src)
      // In the order of their paths, so the refusals come out the same on every machine.
      const files = A.sort(A.filter(everything, isCode), Order.String)
      // A host's and a web's files declare no block of a model: their endings and their imports are asked.
      const declares = workspace.layer === "model" || workspace.layer === "contract"
      const read = yield* Effect.forEach(
        files,
        Effect.fnUntraced(function* (path) {
          const file = repo.relative(path, repo.root)
          const source = yield* repo.text(path)
          return { path, file, blocks: readBlocks({ file, source }) }
        }),
        { concurrency: 1 }
      )
      // The package's model, for a relation that moves: the one `.model.ts` that declares a model.
      const models = A.filter(read, (one) => O.contains(endingOf(one.file), "model") && has(one.blocks.found, "model"))
      const pkg: Package = {
        model: O.map(
          O.filter(A.head(models), () => models.length === 1),
          (one) => one.file
        )
      }
      // The model package of the same context, for a block a contract moves out: the model folder beside it.
      const twin = A.findFirst(
        layered,
        (other) => other.model && repo.dirname(other.dir) === repo.dirname(workspace.dir)
      )
      const findings = A.map(read, ({ path, file, blocks }) => {
        const declared = O.match(blocks.unread, {
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
        return A.flatten([
          O.toArray(unkind(file, workspace.layer)),
          declares ? declared : [],
          declares ? shaped(file, blocks, workspace.model) : [],
          pickedByName(file, blocks)
        ])
      })
      const relative = A.map(read, (one) => one.file)
      const folds = declares ? foldered(relative, (file) => repo.dirname(file)) : []
      return { files: files.length, findings: A.appendAll(A.flatten(findings), folds) }
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
