/**
 * Gate 7 of the vocabulary's thread (report 14 section 6.7): what only the source shows about the marks on records
 * and about the vocabulary's one value. The other gates read the decoded vocabulary, the marks on a schema's tree and
 * the types; none of them sees that a typed helper was bypassed, that a mark sits where no gate looks, or that a
 * module a browser loads imports the vocabulary.
 *
 * The rules, each named by its number in the report:
 *
 * - 1: an export on the enrolment list (`packages/ontology/enrolment.json`) whose declaration carries no helper call,
 *   in its own text or in a constant of the same file it reads by name. A `collection` entry is exempt.
 * - 1b: in a file under a workspace's `src`, a helper call that is in neither: a mark no gate checks.
 * - 3: in a file under a workspace's `src`, a helper whose argument is not the literal form its position takes, or a
 *   helper handed on as a value.
 * - 4: the text of a construct the vocabulary never states, as a CURIE or as a full IRI, in any code file.
 * - 5: the vocabulary's base IRI written out, in any code file but the vocabulary module.
 * - 6: a mark's annotation key written by hand: `term`, `path` or `noTerm` in an annotation object, or anywhere with
 *   the shape a helper returns. Three places are not read for it: the module that makes the helpers
 *   (`Pointer.mark.ts` of the helpers' package), that package's tests, and each folder of the vendored kit, which
 *   has a `term` annotation of its own. The rest of the helpers' package is read.
 * - 7: a value import, a value re-export or a dynamic import that resolves to the vocabulary module, from any file
 *   outside `packages/ontology`. A specifier is resolved, not matched: a relative path, a package's `exports`, a
 *   tsconfig `paths` alias and a `package.json` `imports` alias each lead to a file, and the rule is on that file.
 *   Only a whole-statement `import type` or `export type` passes: `import { type X }` still loads the module.
 *
 * Rule 2 (an Alchemy block without a pointer) does not run: no block is enrolled.
 *
 * The law does not read itself: this file must write the texts rules 4 and 5 search for, and its test must plant
 * what rules 3, 6 and 7 refuse. It reads source text and imports no package of the repository.
 *
 * @packageDocumentation
 */
import { $RepoCliId } from "@beep/identity/packages"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as Order from "effect/Order"
import * as R from "effect/Record"
import * as S from "effect/Schema"
import * as Str from "effect/String"
import { Repo } from "../../Repo.service.ts"
import { scratchpadFolder } from "../../Repo.schema.ts"
import { err, type Line, out } from "../../Report.schema.ts"
import { decodeJsonc } from "../../Sync.rules.ts"
import { unreadSentence } from "./internal/budget.ts"
import { linesOf } from "./internal/lines.ts"
import { helperNames, makerNames, readOntologyTerms } from "./internal/ontologyTermsCode.ts"

const $I = $RepoCliId.create("commands/Laws/OntologyTerms.rules")

/** The one file that holds the vocabulary's value, and the one folder that may import it. */
export const vocabularyModule = "packages/kernel/src/Terms.vocab.ts"
const ontologyPackage = "packages/ontology/"
/**
 * The package that makes the helpers: the one place a mark's keys are written by hand, in the module that returns
 * them and in the tests that hand its reader a mark no helper would make.
 */
const helperPackage = "packages/foundation/modeling/vocabulary/"
/** The module that returns a mark, the one source file that writes a mark's keys by hand (section 6.7, rule 6). */
const helperFiles: ReadonlyArray<string> = [`${helperPackage}src/Pointer.mark.ts`]
/** The one module that makes the five helpers, from the vocabulary's types. */
const helperModule = "packages/kernel/src/Terms.pointer.ts"
const enrolmentList = "packages/ontology/enrolment.json"

/**
 * The vocabulary's base IRI, written here because the law imports no package to take it from (rule 5). The law
 * reads the module's text, so it holds this copy to the module's own `const base`: one that differs is a finding.
 */
const baseIri = "https://example.org/inventory-import"

/** The constructs the vocabulary never states (rule 4), by namespace: the prefix, the namespace, the local names. */
const forbiddenConstructs: ReadonlyArray<readonly [string, string, ReadonlyArray<string>]> = [
  ["owl", "http://www.w3.org/2002/07/owl#", ["inverseOf", "sameAs", "equivalentClass", "imports", "hasKey"]],
  ["skos", "http://www.w3.org/2004/02/skos/core#", ["narrower", "hasTopConcept"]]
]

/** Every text rule 4 searches for, with the name it is reported under. */
const forbiddenTexts: ReadonlyArray<readonly [string, string]> = A.flatMap(
  forbiddenConstructs,
  ([prefix, namespace, locals]) =>
    A.flatMap(locals, (local): ReadonlyArray<readonly [string, string]> => [
      [`${prefix}:${local}`, `${prefix}:${local}`],
      [`${namespace}${local}`, `${prefix}:${local}`]
    ])
)

/** What is not read: the agents' skills and the scratchpad, as for the other source laws, and the law itself. */
const leftOut: ReadonlyArray<string> = [
  ".agents/",
  `${scratchpadFolder}/`,
  "packages/tooling/tool/cli/src/commands/Laws/OntologyTerms",
  "packages/tooling/tool/cli/test/OntologyTerms"
]

const isCode = (file: string): boolean => O.isSome(Str.match(/\.(?:tsx?|mjs)$/)(file))
const isLeftOut = (file: string): boolean => A.some(leftOut, (path) => Str.startsWith(path)(file))
/** A file under a workspace's `src`: where the marks on records live. */
const isWorkspaceSource = (file: string): boolean => O.isSome(Str.match(/^(?:apps|packages)\/(?:[^/]+\/)*src\//)(file))

/** One entry of the enrolment list, as far as this law reads it. */
const Enrolled = S.Struct({ file: S.String, export: S.String, as: S.String })
const EnrolmentList = S.Array(Enrolled)

/** The parts of a `package.json` and a tsconfig that say where a specifier leads. */
const PackageJson = S.Struct({
  name: S.optionalKey(S.String),
  exports: S.optionalKey(S.Unknown),
  imports: S.optionalKey(S.Unknown)
})
const TsConfig = S.Struct({
  extends: S.optionalKey(S.Union([S.String, S.Array(S.String)])),
  compilerOptions: S.optionalKey(
    S.Struct({
      baseUrl: S.optionalKey(S.String),
      paths: S.optionalKey(S.Record(S.String, S.Array(S.String)))
    })
  )
})

/**
 * What `laws ontology-terms` finds: nothing, or a refusal and each place a rule refuses.
 *
 * @category schemas
 */
export const OntologyTermsFinding = S.TaggedUnion({
  Clean: {},
  Refused: {},
  Unlisted: {
    why: S.String.pipe(S.annotateKey({ description: "What git said when it could not list the files" }))
  },
  At: {
    place: S.String.pipe(S.annotateKey({ description: "The file and line, as file:line" })),
    rule: S.Literals(["1", "1b", "3", "4", "5", "6", "7"]).pipe(
      S.annotateKey({ description: "The rule of report 14 section 6.7 that refuses it" })
    ),
    what: S.String.pipe(S.annotateKey({ description: "What is refused and what to write, in one sentence" }))
  },
  Unread: {
    place: S.String.pipe(S.annotateKey({ description: "The file and line the law stopped at, as file:line" })),
    why: S.String.pipe(S.annotateKey({ description: "Why the law did not read the file, in words" }))
  }
}).pipe(
  $I.annoteSchema("OntologyTermsFinding", {
    description: "The marks and the vocabulary are used as the thread's design says, or each place they are not"
  })
)

/**
 * The decoded value of `OntologyTermsFinding`.
 *
 * @category models
 */
export type OntologyTermsFinding = typeof OntologyTermsFinding.Type

/**
 * The line each finding prints.
 *
 * @category rendering
 */
export const ontologyTermsSentence: (finding: OntologyTermsFinding) => Line = OntologyTermsFinding.match({
  Clean: () =>
    out(
      "ontology-terms:check OK  every mark is a typed helper's, where a gate reads it, and only the ontology package loads the vocabulary"
    ),
  Refused: () => err("ontology-terms:check FAIL  the vocabulary's marks or its module are used as the design forbids:"),
  Unlisted: ({ why }) => err(`git could not list the files, so none was checked: ${why}`),
  At: ({ place, rule, what }) => err(`${place}  rule ${rule}: ${what}`),
  Unread: ({ place, why }) => err(`${place}  ${why}`)
})

const lineIn = (place: string): number =>
  Number(
    O.getOrElse(
      O.map(Str.match(/\d+$/)(place), (match) => match[0]),
      () => "0"
    )
  )

/** A refusal's line, read back from its place. */
const lineOfPlace = (finding: OntologyTermsFinding): number =>
  OntologyTermsFinding.match(finding, {
    Clean: () => 0,
    Refused: () => 0,
    Unlisted: () => 0,
    At: ({ place }) => lineIn(place),
    Unread: ({ place }) => lineIn(place)
  })
const byLine = Order.mapInput(Order.Number, lineOfPlace)

const at = (file: string, line: number, rule: "1" | "1b" | "3" | "4" | "5" | "6" | "7", what: string) =>
  OntologyTermsFinding.cases.At.make({ place: `${file}:${line}`, rule, what })

/** Every string a conditional `exports` or `imports` target leads to: a string, or the leaves of an object of conditions. */
const leaves = (target: unknown): ReadonlyArray<string> => {
  const found: Array<string> = []
  const left: Array<unknown> = [target]
  for (let next = left.pop(); next !== undefined; next = left.pop()) {
    if (typeof next === "string") found.push(next)
    else if (A.isArray(next)) left.push(...next)
    // The `types` condition names what the type-check reads, never the file that is loaded.
    else if (typeof next === "object" && next !== null) {
      left.push(
        ...A.map(
          A.filter(R.toEntries(next), ([condition]) => condition !== "types"),
          ([, leaf]) => leaf
        )
      )
    }
  }
  return found
}

/** The targets a map of patterns gives a name: an exact key, or a key with one `*` that the name fills. */
const targetsOf = (map: Readonly<Record<string, ReadonlyArray<string>>>, name: string): ReadonlyArray<string> =>
  A.flatMap(R.toEntries(map), ([pattern, targets]) => {
    if (pattern === name) return targets
    const star = Str.indexOf("*")(pattern)
    if (O.isNone(star)) return []
    const before = Str.slice(0, star.value)(pattern)
    const after = Str.slice(star.value + 1)(pattern)
    if (!Str.startsWith(before)(name) || !Str.endsWith(after)(name) || name.length < before.length + after.length) {
      return []
    }
    const filled = Str.slice(before.length, name.length - after.length)(name)
    return A.map(targets, Str.replaceAll("*", filled))
  })

const asMap = (value: unknown): Readonly<Record<string, ReadonlyArray<string>>> =>
  typeof value === "object" && value !== null && !A.isArray(value) ? R.map(value, leaves) : {}

/** The files a path may name: itself, with a TypeScript ending, with `.js` read as `.ts`, or its `index`. */
const candidates = (path: string): ReadonlyArray<string> => [
  path,
  `${path}.ts`,
  `${path}.tsx`,
  `${path}/index.ts`,
  Str.replace(/\.js$/, ".ts")(path)
]

const folderOf = (file: string): string =>
  O.match(Str.lastIndexOf("/")(file), { onNone: () => "", onSome: (slash) => Str.slice(0, slash)(file) })

/** Whether `folder`, from the root (`""` is the root), holds `file`. */
const holds = (folder: string, file: string): boolean => folder === "" || Str.startsWith(`${folder}/`)(file)

/**
 * Reads every code file git would commit, from the repository's root.
 *
 * @category rules
 */
export const ontologyTerms = Effect.fn("OntologyTerms.ontologyTerms")(function* () {
  const repo = yield* Repo
  const listed = yield* repo.run("git", [
    "ls-files",
    "-z",
    "--cached",
    "--others",
    "--exclude-standard",
    "--deduplicate"
  ])
  // A list git could not give is not an empty list: nothing was checked, and the law says so.
  if (listed.code !== 0) {
    return A.make<[OntologyTermsFinding, OntologyTermsFinding]>(
      OntologyTermsFinding.cases.Refused.make({}),
      OntologyTermsFinding.cases.Unlisted.make({ why: Str.trim(listed.stderr) })
    )
  }
  const present = yield* Effect.filter(
    A.filter(Str.split("\0")(listed.stdout), (file) => file !== "" && !Str.includes("node_modules/")(file)),
    (file) => repo.exists(repo.join(repo.root, file)),
    { concurrency: 1 }
  )
  const text = (file: string) => repo.text(repo.join(repo.root, file))
  const fromRoot = (...segments: ReadonlyArray<string>): string =>
    repo.normalize(
      A.join(
        A.filter(segments, (part) => part !== ""),
        "/"
      )
    )

  // Where a specifier leads: every package by name with its `exports`, every `imports` map and every `paths` map by
  // the folder it holds for. A file that does not decode leads nowhere; the type-check is what says so.
  const manifests = yield* Effect.forEach(
    A.filter(present, (file) => file === "package.json" || Str.endsWith("/package.json")(file)),
    (file) =>
      Effect.map(Effect.option(Effect.flatMap(text(file), (json) => decodeJsonc(PackageJson)(file, json))), (decoded) =>
        O.map(decoded, (manifest) => ({
          folder: folderOf(file),
          name: O.fromUndefinedOr(manifest.name),
          exports: typeof manifest.exports === "string" ? { ".": [manifest.exports] } : asMap(manifest.exports),
          imports: asMap(manifest.imports)
        }))
      ),
    { concurrency: 1 }
  ).pipe(Effect.map(A.getSomes))
  const readConfig = (file: string) =>
    Effect.map(Effect.option(Effect.flatMap(text(file), (json) => decodeJsonc(TsConfig)(file, json))), (decoded) =>
      O.map(decoded, (config) => ({
        file,
        // Only a configuration in the repository is followed: one a package ships has no alias of ours.
        parents: A.map(
          A.filter(
            config.extends === undefined ? [] : typeof config.extends === "string" ? [config.extends] : config.extends,
            Str.startsWith(".")
          ),
          (parent) => fromRoot(folderOf(file), Str.endsWith(".json")(parent) ? parent : `${parent}.json`)
        ),
        own: O.map(O.fromUndefinedOr(config.compilerOptions?.paths), (paths) => ({
          base: fromRoot(folderOf(file), config.compilerOptions?.baseUrl ?? ""),
          paths
        }))
      }))
    )
  const readConfigs = (files: ReadonlyArray<string>) =>
    Effect.map(Effect.forEach(files, readConfig, { concurrency: 1 }), A.getSomes)
  const named = yield* readConfigs(
    A.filter(present, (file) => O.isSome(Str.match(/(?:^|\/)tsconfig[^/]*\.json$/)(file)))
  )
  // A configuration may extend a file of any name: each one named is read too, and what it extends, a few deep.
  type Config = (typeof named)[number]
  const unreadParents = (known: ReadonlyArray<Config>): ReadonlyArray<string> =>
    A.dedupe(
      A.filter(
        A.flatMap(known, (config) => config.parents),
        (parent) => A.contains(present, parent) && !A.some(known, (config) => config.file === parent)
      )
    )
  const first = yield* readConfigs(unreadParents(named))
  const second = yield* readConfigs(unreadParents([...named, ...first]))
  const third = yield* readConfigs(unreadParents([...named, ...first, ...second]))
  const configs = [...named, ...first, ...second, ...third]
  /** The `paths` a configuration works with: its own, or else the nearest its `extends` gives, read from where they are written. */
  const pathsOf = (
    file: string,
    seen: ReadonlyArray<string>
  ): ReadonlyArray<{ readonly base: string; readonly paths: Readonly<Record<string, ReadonlyArray<string>>> }> => {
    const config = A.findFirst(configs, (candidate) => candidate.file === file)
    if (O.isNone(config) || A.contains(seen, file)) return []
    if (O.isSome(config.value.own)) return [config.value.own.value]
    // A later entry of `extends` wins over an earlier one.
    return A.take(
      A.flatMap(A.reverse(config.value.parents), (parent) => pathsOf(parent, [...seen, file])),
      1
    )
  }
  const aliases = A.flatMap(configs, (config) =>
    A.map(pathsOf(config.file, []), (found) => ({ folder: folderOf(config.file), ...found }))
  )

  /** Every file a specifier written in `file` may lead to, from the root. */
  const leadsTo = (file: string, written: string): ReadonlyArray<string> => {
    // A bundler's query (`?raw`, `?url`) or a fragment names the same file.
    const specifier = Str.replace(/^(.[^?#]*)[?#].*$/s, "$1")(written)
    const here = folderOf(file)
    if (Str.startsWith(".")(specifier)) return candidates(fromRoot(here, specifier))
    const byImports = Str.startsWith("#")(specifier)
      ? A.flatMap(manifests, (manifest) =>
          holds(manifest.folder, file)
            ? A.map(targetsOf(manifest.imports, specifier), (target) => fromRoot(manifest.folder, target))
            : []
        )
      : []
    const byPaths = A.flatMap(aliases, (alias) =>
      holds(alias.folder, file)
        ? A.map(targetsOf(alias.paths, specifier), (target) => fromRoot(alias.base, target))
        : []
    )
    const byExports = A.flatMap(manifests, (manifest) => {
      if (O.isNone(manifest.name)) return []
      const name = manifest.name.value
      if (specifier !== name && !Str.startsWith(`${name}/`)(specifier)) return []
      const entry = specifier === name ? "." : `.${Str.slice(name.length)(specifier)}`
      return A.map(targetsOf(manifest.exports, entry), (target) => fromRoot(manifest.folder, target))
    })
    return A.flatMap([...byImports, ...byPaths, ...byExports], candidates)
  }

  // A package the kit is copied into keeps beep-effect's code as it is, its own `term` annotation included: rule 6
  // does not read it.
  // The folder is a package's own: a `vendor.json` above several packages exempts none of them.
  const kit = A.filter(
    A.map(
      A.filter(present, (file) => Str.endsWith("/vendor.json")(file)),
      (file) => Str.slice(0, file.length - "vendor.json".length)(file)
    ),
    (folder) => A.contains(present, `${folder}package.json`)
  )
  // A list that is there and cannot be read stops the law: with no list, rule 1 would pass every record.
  const enrolment = A.contains(present, enrolmentList)
    ? yield* Effect.option(
        Effect.flatMap(text(enrolmentList), (json) => decodeJsonc(EnrolmentList)(enrolmentList, json))
      )
    : O.some<typeof EnrolmentList.Type>([])
  if (O.isNone(enrolment)) {
    return [
      OntologyTermsFinding.cases.Refused.make({}),
      OntologyTermsFinding.cases.Unread.make({
        place: `${enrolmentList}:1`,
        why: "the enrolment list could not be read as a list of file, export and as: no mark was checked"
      })
    ]
  }
  const enrolled = enrolment.value

  const files = A.filter(present, (file) => isCode(file) && !isLeftOut(file))
  const found = yield* Effect.forEach(
    files,
    (file) =>
      Effect.map(text(file), (source): ReadonlyArray<OntologyTermsFinding> => {
        const lineAt = linesOf(source)
        // Rules 4 and 5 read the text itself, comments and strings alike.
        const texts = A.flatMap(forbiddenTexts, ([written, name]) =>
          A.map(
            A.fromIterable(
              Str.matchAll(new RegExp(`${Str.replace(/[.#/]/g, "\\$&")(written)}(?![A-Za-z0-9_])`, "g"))(source)
            ),
            (match) =>
              at(
                file,
                lineAt(match.index ?? 0),
                "4",
                `${name} is a construct the vocabulary never states: do not write its name in code`
              )
          )
        )
        const bases =
          file === vocabularyModule
            ? A.flatMap(A.fromIterable(Str.matchAll(/^const base = "([^"]+)"/gm)(source)), (match) =>
                A.fromOption(
                  O.flatMap(A.get(match, 1), (written) =>
                    written === baseIri
                      ? O.none()
                      : O.some(
                          at(
                            file,
                            O.match(Str.indexOf(match[0])(source), { onNone: () => 1, onSome: lineAt }),
                            "5",
                            `the vocabulary's base is ${written} and this law searches for ${baseIri}: change baseIri in the law to match, or rule 5 lets the new base be written anywhere`
                          )
                        )
                  )
                )
              )
            : A.map(
                A.fromIterable(Str.matchAll(new RegExp(Str.replace(/[./]/g, "\\$&")(baseIri), "g"))(source)),
                (match) =>
                  at(
                    file,
                    lineAt(match.index ?? 0),
                    "5",
                    `the vocabulary's base IRI is written in ${vocabularyModule} only: read it from the vocabulary`
                  )
              )
        const read = readOntologyTerms({ file, source })
        if (O.isSome(read.unread)) {
          return [
            ...texts,
            ...bases,
            OntologyTermsFinding.cases.Unread.make({
              place: `${file}:${read.unread.value.line}`,
              why: unreadSentence(read.unread.value.unread)
            })
          ]
        }
        // A maker of helpers is no mark: it is read apart from the helpers' calls.
        // A helper is one the file takes from the module that makes the five: a function of the same name is none.
        const comesFrom = (use: { readonly from: string }, module: string): boolean =>
          A.contains(leadsTo(file, use.from), module)
        const marks = A.filter(read.uses, (use) => A.contains(helperNames, use.helper) && comesFrom(use, helperModule))
        const makers =
          isWorkspaceSource(file) && file !== helperModule && !Str.startsWith(helperPackage)(file)
            ? A.map(
                A.filter(
                  read.uses,
                  (use) => A.contains(makerNames, use.helper) && A.some(helperFiles, (made) => comesFrom(use, made))
                ),
                (use) =>
                  at(
                    file,
                    use.line,
                    "3",
                    `${use.helper} makes a helper of its own: the five helpers are made in ${helperModule} and nowhere else`
                  )
              )
            : []
        const here = A.filter(enrolled, (entry) => entry.file === file)
        const marked = A.filter(here, (entry) => entry.as !== "collection")
        const declarationOf = (name: string) =>
          A.findFirst(read.declarations, (declaration) => declaration.name === name)
        // What an enrolled declaration's marks may be written in: itself, and each constant of the file it reads.
        const within = (name: string): ReadonlyArray<string> =>
          O.match(declarationOf(name), {
            onNone: () => [],
            onSome: (declaration) => [
              name,
              ...A.map(
                A.filter(read.declarations, (other) => other.constant && A.contains(declaration.reads, other.name)),
                (other) => other.name
              )
            ]
          })
        const owners = A.flatMap(here, (entry) => within(entry.export))
        const unmarked = A.flatMap(marked, (entry) => {
          const homes = within(entry.export)
          const carries = A.some(marks, (use) => O.exists(use.owner, (owner) => A.contains(homes, owner)))
          return carries
            ? []
            : [
                at(
                  file,
                  O.match(declarationOf(entry.export), { onNone: () => 1, onSome: (declaration) => declaration.line }),
                  "1",
                  `${entry.export} is on the enrolment list and its declaration carries no mark: point it at its term with a helper of @inventory/kernel/TermsPointer`
                )
              ]
        })
        const source_ = isWorkspaceSource(file)
        const stray = source_
          ? A.map(
              A.filter(marks, (use) => !O.exists(use.owner, (owner) => A.contains(owners, owner))),
              (use) =>
                at(
                  file,
                  use.line,
                  "1b",
                  `${use.helper} marks nothing a gate checks: it is in no declaration ${enrolmentList} lists, and in no constant one reads`
                )
            )
          : []
        const computed = source_
          ? A.map(
              A.filter(marks, (use) => !use.literal),
              (use) =>
                at(
                  file,
                  use.line,
                  "3",
                  `${use.helper} is given something other than the literal its position takes: write the strings out, with no name, spread, call or computed key`
                )
            )
          : []
        const byHand =
          A.contains(helperFiles, file) ||
          Str.startsWith(`${helperPackage}test/`)(file) ||
          A.some(kit, (folder) => Str.startsWith(folder)(file))
            ? []
            : A.map(read.handKeys, ({ key, line }) =>
                at(
                  file,
                  line,
                  "6",
                  `the annotation key ${key} is written by hand: a mark is made by a helper of @inventory/kernel/TermsPointer, which checks the name`
                )
              )
        const loads =
          Str.startsWith(ontologyPackage)(file) || file === vocabularyModule
            ? []
            : A.map(
                A.filter(
                  read.imports,
                  (imported) => !imported.typeOnly && A.contains(leadsTo(file, imported.specifier), vocabularyModule)
                ),
                (imported) =>
                  at(
                    file,
                    imported.line,
                    "7",
                    `"${imported.specifier}" loads ${vocabularyModule}: only ${ontologyPackage} imports the vocabulary's value; anywhere else write import type`
                  )
              )
        // In the order of the file's lines, whichever rule found each.
        return A.sort([...unmarked, ...stray, ...computed, ...makers, ...texts, ...bases, ...byHand, ...loads], byLine)
      }),
    { concurrency: 1 }
  )
  // An enrolled export whose file git does not list is rule 1's too: a mark cannot be on a file that is not there.
  const missing = A.map(
    A.filter(enrolled, (entry) => entry.as !== "collection" && !A.contains(files, entry.file)),
    (entry) => at(entry.file, 1, "1", `${entry.export} is on the enrolment list and its file is not in the repository`)
  )
  const problems = [...missing, ...A.flatten(found)]
  return A.isArrayNonEmpty(problems)
    ? A.prepend<OntologyTermsFinding, OntologyTermsFinding>(problems, OntologyTermsFinding.cases.Refused.make({}))
    : A.of<OntologyTermsFinding>(OntologyTermsFinding.cases.Clean.make({}))
})
