// Gate 7, `laws ontology-terms` (report 14 section 6.7), run on small repositories written for each case. Each rule
// has the text it refuses and, beside it, the nearest text it lets through. The law does not read this file when it
// runs over the repository, so the planted texts fail nothing but the assertions made about them.
import { describe, expect, it } from "@effect/vitest"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as Str from "effect/String"
import { ontologyTerms, ontologyTermsSentence } from "../src/commands/Laws/OntologyTerms.rules.ts"
import { Repo } from "../src/Repo.service.ts"
import { render } from "../src/Report.schema.ts"
import { inTree, json, printed, type Tree } from "./support/tree.ts"

// git answers "every file git would commit", so the folder is made a repository first.
const inRepository = Effect.gen(function* () {
  const repo = yield* Repo
  yield* repo.run("git", ["init", "-q"])
  const found = yield* ontologyTerms()
  return printed(render(ontologyTermsSentence)(found))
})

/** The findings of a tree, each as `file:line rule N`, the heading left out. */
const refusals = (tree: Tree) =>
  Effect.map(inTree(tree, inRepository), (lines) =>
    A.map(
      A.filter(lines, (line) => Str.includes("  rule ")(line)),
      (line) => Str.replace(/^err: (\S+) {2}(rule \w+):.*$/s, "$1 $2")(line)
    )
  )

const clean =
  "out: ontology-terms:check OK  every mark is a typed helper's, where a gate reads it, and only the ontology package loads the vocabulary"

const vocab = "packages/kernel/src/Terms.vocab.ts"
const kernelManifest = json({
  name: "@inventory/kernel",
  exports: {
    "./Terms": "./src/Terms.vocab.ts",
    "./TermsPointer": "./src/Terms.pointer.ts",
    "./Member": "./src/Member.schema.ts"
  }
})
const helpers = `import { aboutClass, aboutPath, aboutProperty, aboutScheme, noTerm } from "@inventory/kernel/TermsPointer"\n`

// A record marked as the thread's are: a field mark in place, one hoisted as a constant the record reads, a path of
// literals, and the class pointer on the record itself.
const member = `${helpers}import * as S from "effect/Schema"
const nameMark = { description: "For the screen", ...noTerm("screen") }
export const Member = S.Struct({
  id: S.String.pipe(S.annotateKey({ description: "The id", ...aboutClass("inv:Member") })),
  name: S.String.pipe(S.annotateKey(nameMark)),
  email: S.String.pipe(S.annotateKey(noTerm("deferred", "party"))),
  organizationId: S.String.pipe(S.annotateKey(aboutProperty("inv:membershipIn"))),
  role: S.String.pipe(
    S.annotateKey(
      aboutPath([
        { property: "inv:grantedTo", reverse: true, node: "inv:Grant", fixed: [{ property: "inv:grantScope", concept: "inv:GrantScopeKindScheme-organization" }] },
        { property: "inv:grantsRole" }
      ])
    )
  )
}).pipe(S.annotate(aboutClass("inv:Member")))
`

const enrolment = (entries: ReadonlyArray<{ readonly file: string; readonly export: string; readonly as: string }>) =>
  json(entries)

/** The thread as it stands: one enrolled record, the vocabulary, and the ontology package that loads it. */
const thread: Tree = {
  "package.json": json({ name: "root", workspaces: ["packages/*", "apps/*"] }),
  "packages/kernel/package.json": kernelManifest,
  [vocab]: `export const vocabulary = { base: "https://example.org/inventory-import" } as const\nexport type Inv = typeof vocabulary\n`,
  "packages/kernel/src/Terms.pointer.ts": "export const made = 5\n",
  "packages/foundation/modeling/vocabulary/package.json": json({
    name: "@beep/vocabulary",
    exports: { "./Pointer": "./src/Pointer.mark.ts" }
  }),
  "packages/foundation/modeling/vocabulary/src/Pointer.mark.ts": "export const made = 3\n",
  "packages/kernel/src/Member.schema.ts": member,
  "packages/ontology/enrolment.json": enrolment([
    { file: "packages/kernel/src/Member.schema.ts", export: "Member", as: "record" }
  ]),
  "packages/ontology/src/Thread.ts": `import { vocabulary } from "@inventory/kernel/Terms"\nexport const base = vocabulary.base\n`
}

describe("laws ontology-terms", () => {
  it.effect("passes the thread as it stands", () =>
    Effect.gen(function* () {
      const lines = yield* inTree(thread, inRepository)
      expect(lines).toStrictEqual([clean])
    })
  )

  it.effect("says that git could not list the files, and checks none", () =>
    Effect.gen(function* () {
      const found = yield* inTree(thread, ontologyTerms())
      const lines = printed(render(ontologyTermsSentence)(found))
      expect(lines).toHaveLength(2)
      expect(lines[1]).toContain("git could not list the files, so none was checked")
    })
  )

  it.effect("stops at an enrolment list it cannot read: with no list, rule 1 would pass every record", () =>
    Effect.gen(function* () {
      const lines = yield* inTree({ ...thread, "packages/ontology/enrolment.json": '[{ "file": 1 }]' }, inRepository)
      expect(lines).toHaveLength(2)
      expect(lines[1]).toContain("packages/ontology/enrolment.json:1  the enrolment list could not be read")
    })
  )

  it.effect("refuses a file the parser reads with errors, once, where it stopped", () =>
    Effect.gen(function* () {
      const lines = yield* inTree({ ...thread, "packages/kernel/src/Broken.ts": "export const x = (\n" }, inRepository)
      expect(A.filter(lines, Str.includes("packages/kernel/src/Broken.ts:"))).toHaveLength(1)
      expect(A.some(lines, Str.includes("could not be parsed"))).toBe(true)
    })
  )
})

describe("rule 1, an enrolled export carries a mark", () => {
  it.effect("refuses an enrolled record with no helper call, and one whose file is gone", () =>
    Effect.gen(function* () {
      const bare = `import * as S from "effect/Schema"\n\nexport const Role = S.Literals(["viewer"])\n`
      const found = yield* refusals({
        ...thread,
        "packages/kernel/src/Role.schema.ts": bare,
        "packages/ontology/enrolment.json": enrolment([
          { file: "packages/kernel/src/Member.schema.ts", export: "Member", as: "record" },
          { file: "packages/kernel/src/Role.schema.ts", export: "Role", as: "scheme" },
          { file: "packages/kernel/src/Gone.schema.ts", export: "Gone", as: "record" }
        ])
      })
      expect(found).toStrictEqual([
        "packages/kernel/src/Gone.schema.ts:1 rule 1",
        "packages/kernel/src/Role.schema.ts:3 rule 1"
      ])
    })
  )

  it.effect("refuses an enrolled name the file does not declare, though the file has marks", () =>
    Effect.gen(function* () {
      const found = yield* refusals({
        ...thread,
        "packages/ontology/enrolment.json": enrolment([
          { file: "packages/kernel/src/Member.schema.ts", export: "Membership", as: "record" }
        ])
      })
      expect(A.filter(found, Str.endsWith("rule 1"))).toStrictEqual(["packages/kernel/src/Member.schema.ts:1 rule 1"])
    })
  )

  it.effect("exempts a collection, and takes a class and a scheme with the helper in their annotations", () =>
    Effect.gen(function* () {
      const forms = `${helpers}import * as S from "effect/Schema"
import * as Model from "effect/unstable/schema/Model"
const idMark = aboutClass("inv:AuditEntry")
export class Activity extends Model.Class<Activity>("Activity")(
  { id: S.String.pipe(S.annotateKey(idMark)) },
  { description: "One line of the audit trail", ...aboutClass("inv:AuditEntry") }
) {}
export const Role = S.Literals(["viewer"]).pipe(S.annotate({ description: "A role", ...aboutScheme("inv:MemberRoleScheme") }))
export const AuditTrail = S.Array(Activity)
`
      const lines = yield* inTree(
        {
          ...thread,
          "packages/kernel/src/Activity.schema.ts": forms,
          "packages/ontology/enrolment.json": enrolment([
            { file: "packages/kernel/src/Member.schema.ts", export: "Member", as: "record" },
            { file: "packages/kernel/src/Activity.schema.ts", export: "Activity", as: "record" },
            { file: "packages/kernel/src/Activity.schema.ts", export: "Role", as: "scheme" },
            { file: "packages/kernel/src/Activity.schema.ts", export: "AuditTrail", as: "collection" }
          ])
        },
        inRepository
      )
      expect(lines).toStrictEqual([clean])
    })
  )

  it.effect("takes a schema enrolled as standing for no term with noTerm in its annotations, and refuses it bare", () =>
    Effect.gen(function* () {
      const words = (annotations: string) => `${helpers}import * as S from "effect/Schema"
export const Words = S.Struct({ organizationName: S.String, role: S.String })${annotations}
`
      const entries = enrolment([
        { file: "packages/kernel/src/Member.schema.ts", export: "Member", as: "record" },
        { file: "packages/kernel/src/Words.schema.ts", export: "Words", as: "noTerm" }
      ])
      const marked = yield* inTree(
        {
          ...thread,
          "packages/kernel/src/Words.schema.ts": words(
            '.pipe(S.annotate({ description: "Words", ...noTerm("screen") }))'
          ),
          "packages/ontology/enrolment.json": entries
        },
        inRepository
      )
      const bare = yield* refusals({
        ...thread,
        "packages/kernel/src/Words.schema.ts": words(""),
        "packages/ontology/enrolment.json": entries
      })
      expect(marked).toStrictEqual([clean])
      expect(bare).toStrictEqual(["packages/kernel/src/Words.schema.ts:3 rule 1"])
    })
  )

  it.effect("takes no function of a helper's name from another module for the helper", () =>
    Effect.gen(function* () {
      const found = yield* refusals({
        ...thread,
        "packages/access/model/src/log.ts": "export const noTerm = (reason: string) => reason\n",
        "packages/access/model/src/Member.ts":
          'import * as Log from "./log.ts"\nimport { noTerm } from "./log.ts"\nimport * as S from "effect/Schema"\nexport const Member = S.Struct({ id: S.String.pipe(S.annotateKey({ description: Log.noTerm("screen") + noTerm("x") })) })\n',
        "packages/access/model/src/Read.ts":
          'import * as Log from "./log.ts"\nexport const reason = Log["noTerm"]("screen")\nexport const read = (row: { noTerm: string; pathFor: string }) => {\n  const { noTerm, pathFor } = row\n  return noTerm + pathFor\n}\n',
        "packages/ontology/enrolment.json": enrolment([
          { file: "packages/kernel/src/Member.schema.ts", export: "Member", as: "record" },
          { file: "packages/access/model/src/Member.ts", export: "Member", as: "record" }
        ])
      })
      expect(found).toStrictEqual(["packages/access/model/src/Member.ts:4 rule 1"])
    })
  )
})

describe("rule 1b, a mark no gate checks", () => {
  const unenrolled = `${helpers}import * as S from "effect/Schema"
const spare = noTerm("screen")
export const Draft = S.Struct({ id: S.String.pipe(S.annotateKey(aboutClass("inv:Member"))) })
`
  it.effect(
    "refuses a helper call in a source record that is not enrolled, and in a constant no enrolled record reads",
    () =>
      Effect.gen(function* () {
        const found = yield* refusals({
          ...thread,
          "packages/kernel/src/Draft.schema.ts": unenrolled,
          "packages/kernel/src/Member.schema.ts": `${member}const unread = aboutProperty("inv:membershipIn")\nexport const other = unread\n`
        })
        expect(found).toStrictEqual([
          "packages/kernel/src/Draft.schema.ts:3 rule 1b",
          "packages/kernel/src/Draft.schema.ts:4 rule 1b",
          "packages/kernel/src/Member.schema.ts:18 rule 1b"
        ])
      })
  )

  it.effect("does not read a test: a mark built there reaches no generated file", () =>
    Effect.gen(function* () {
      const lines = yield* inTree({ ...thread, "packages/kernel/test/Draft.test.ts": unenrolled }, inRepository)
      expect(lines).toStrictEqual([clean])
    })
  )
})

describe("rule 3, a helper's argument is written out", () => {
  const marked = (call: string) => `${helpers}import * as S from "effect/Schema"
const key = "inv:Member"
export const Member = S.Struct({ id: S.String.pipe(S.annotateKey(${call})) }).pipe(S.annotate(aboutClass("inv:Member")))
`
  const refused = [
    "aboutClass(key)",
    "aboutClass(`inv:Member`)",
    'aboutClass("inv:" + "Member")',
    'aboutClass("inv:Member", "inv:Tenant")',
    "aboutClass()",
    'aboutProperty(...["inv:membershipIn"])',
    'noTerm("screen", "party")',
    'noTerm("deferred", key)',
    "aboutPath([{ property: key }])",
    'aboutPath([{ ["property"]: "inv:grantsRole" }])',
    'aboutPath([{ property: "inv:grantsRole", reverse: false }])',
    'aboutPath([...[], { property: "inv:grantsRole" }])',
    'aboutPath([{ property: "inv:grantedTo", fixed: [{ property: key }] }])',
    'aboutPath([{ ...{}, property: "inv:grantsRole" }])',
    "[aboutClass][0]!(key)"
  ]
  it.effect(
    "refuses a name, a template, a sum, a spread, a computed key, a second argument and a helper handed on",
    () =>
      Effect.gen(function* () {
        const found = yield* Effect.forEach(
          refused,
          (call) => refusals({ ...thread, "packages/kernel/src/Member.schema.ts": marked(call) }),
          { concurrency: 4 }
        )
        expect(A.map(found, (lines) => A.filter(lines, Str.endsWith("rule 3")))).toStrictEqual(
          A.map(refused, () => ["packages/kernel/src/Member.schema.ts:4 rule 3"])
        )
      })
  )

  it.effect("refuses a helper called under another name or through a namespace", () =>
    Effect.gen(function* () {
      const renamed = `import { aboutClass as mark } from "@inventory/kernel/TermsPointer"
import * as T from "@inventory/kernel/TermsPointer"
import * as S from "effect/Schema"
const key = "inv:Member"
export const Member = S.Struct({ id: S.String.pipe(S.annotateKey(mark(key))) }).pipe(S.annotate(T.aboutClass(key)))
`
      const found = yield* refusals({ ...thread, "packages/kernel/src/Member.schema.ts": renamed })
      expect(found).toStrictEqual([
        "packages/kernel/src/Member.schema.ts:5 rule 3",
        "packages/kernel/src/Member.schema.ts:5 rule 3"
      ])
    })
  )

  it.effect("refuses a helper taken out of its namespace, read by a quoted name, or handed on under another", () =>
    Effect.gen(function* () {
      const taken = (line: string) => `import * as T from "@inventory/kernel/TermsPointer"
import { aboutClass } from "@inventory/kernel/TermsPointer"
import * as S from "effect/Schema"
const key = "inv:Member"
${line}
export const Member = S.Struct({ id: S.String.pipe(S.annotateKey(aboutClass("inv:Member"))) }).pipe(S.annotate(aboutClass("inv:Member")))
`
      const lines = [
        "const { aboutClass: mark } = T",
        'const mark = T["aboutClass"]',
        "const mark = T[`aboutClass`]",
        "const mark = aboutClass",
        'export { aboutClass as mark } from "@inventory/kernel/TermsPointer"'
      ]
      const found = yield* Effect.forEach(
        lines,
        (line) => refusals({ ...thread, "packages/kernel/src/Member.schema.ts": taken(line) }),
        { concurrency: 4 }
      )
      expect(A.map(found, (each) => A.filter(each, Str.endsWith("rule 3")))).toStrictEqual(
        A.map(lines, () => ["packages/kernel/src/Member.schema.ts:5 rule 3"])
      )
    })
  )

  it.effect("refuses a second maker of helpers, and lets the kernel's own module make the five", () =>
    Effect.gen(function* () {
      const maker =
        'import { pointerFor } from "@beep/vocabulary/Pointer"\nexport const aboutClass = pointerFor<never>()\n'
      const found = yield* refusals({
        ...thread,
        "packages/kernel/src/Terms.pointer.ts": maker,
        "packages/access/model/src/Mine.ts": maker
      })
      expect(found).toStrictEqual(["packages/access/model/src/Mine.ts:2 rule 3"])
    })
  )

  it.effect("passes a hoisted mark given its type by the helper's own", () =>
    Effect.gen(function* () {
      const typed = `${helpers}import * as S from "effect/Schema"
const idMark: ReturnType<typeof aboutClass> = aboutClass("inv:Member")
export const Member = S.Struct({ id: S.String.pipe(S.annotateKey(idMark)) }).pipe(S.annotate(aboutClass("inv:Member")))
`
      const lines = yield* inTree({ ...thread, "packages/kernel/src/Member.schema.ts": typed }, inRepository)
      expect(lines).toStrictEqual([clean])
    })
  )

  it.effect("passes the thread's own forms, and a test's computed mark", () =>
    Effect.gen(function* () {
      const lines = yield* inTree(
        { ...thread, "packages/kernel/test/Copy.test.ts": marked("aboutClass(key)") },
        inRepository
      )
      expect(lines).toStrictEqual([clean])
    })
  )
})

describe("rule 4, a construct the vocabulary never states", () => {
  it.effect("refuses its name as a CURIE and as a full IRI, in a comment, a string and an .mjs file", () =>
    Effect.gen(function* () {
      const found = yield* refusals({
        ...thread,
        "packages/kernel/src/A.ts":
          '// see owl:sameAs\nexport const a = "skos:narrower"\nexport const b = "http://www.w3.org/2002/07/owl#hasKey"\n',
        "apps/inventory/scripts/b.mjs":
          'export const c = "http://www.w3.org/2004/02/skos/core#hasTopConcept owl:inverseOf owl:equivalentClass owl:imports"\n'
      })
      expect(found).toStrictEqual([
        "apps/inventory/scripts/b.mjs:1 rule 4",
        "apps/inventory/scripts/b.mjs:1 rule 4",
        "apps/inventory/scripts/b.mjs:1 rule 4",
        "apps/inventory/scripts/b.mjs:1 rule 4",
        "packages/kernel/src/A.ts:1 rule 4",
        "packages/kernel/src/A.ts:2 rule 4",
        "packages/kernel/src/A.ts:3 rule 4"
      ])
    })
  )

  it.effect("reads code only, and lets a longer name and the law's own files through", () =>
    Effect.gen(function* () {
      const lines = yield* inTree(
        {
          ...thread,
          "packages/ontology/fixtures/negative/gate3.ttl": "<a> owl:sameAs <b> .\n",
          "packages/kernel/src/A.ts": 'export const a = "owl:sameAsIf owl:disjointWith skos:narrowerThan"\n',
          "packages/tooling/tool/cli/test/OntologyTerms.test.ts": 'export const planted = "owl:sameAs"\n',
          "packages/tooling/tool/cli/src/commands/Laws/OntologyTerms.rules.ts": 'export const searched = "owl:hasKey"\n'
        },
        inRepository
      )
      expect(lines).toStrictEqual([clean])
    })
  )
})

describe("rule 5, the base IRI is written once", () => {
  it.effect("refuses the literal in any code file but the vocabulary module", () =>
    Effect.gen(function* () {
      const found = yield* refusals({
        ...thread,
        "packages/ontology/test/Questions.test.ts":
          '\nexport const member = "https://example.org/inventory-import/data/x"\n',
        "packages/ontology/fixtures/cq/CQ-P06.rq": "PREFIX inv: <https://example.org/inventory-import/ontology/>\n"
      })
      expect(found).toStrictEqual(["packages/ontology/test/Questions.test.ts:2 rule 5"])
    })
  )

  it.effect("refuses a vocabulary module whose base is not the one this rule searches for", () =>
    Effect.gen(function* () {
      const found = yield* refusals({
        ...thread,
        "packages/kernel/src/Terms.vocab.ts":
          'const base = "https://example.org/another"\nexport const vocabulary = { base }\n'
      })
      expect(found).toStrictEqual(["packages/kernel/src/Terms.vocab.ts:1 rule 5"])
      const same = yield* refusals({
        ...thread,
        "packages/kernel/src/Terms.vocab.ts":
          'const base = "https://example.org/inventory-import"\nexport const vocabulary = { base }\n'
      })
      expect(same).toStrictEqual([])
    })
  )
})

describe("rule 6, a mark's key written by hand", () => {
  const byHand = (annotation: string) => `import * as S from "effect/Schema"
${annotation}
`
  it.effect("planted: an enrolled record pointed at its class by hand, the name spelt right", () =>
    Effect.gen(function* () {
      const found = yield* refusals({
        ...thread,
        "packages/kernel/src/Member.schema.ts": `${helpers}import * as S from "effect/Schema"
export const Member = S.Struct({ id: S.String.pipe(S.annotateKey(aboutClass("inv:Member"))) }).pipe(
  S.annotate({ term: "inv:Member" })
)
`
      })
      expect(found).toStrictEqual(["packages/kernel/src/Member.schema.ts:4 rule 6"])
    })
  )

  it.effect(
    "refuses each key in an annotation, in a class's annotations, and a hoisted object with a mark's shape",
    () =>
      Effect.gen(function* () {
        const cases = [
          "export const a = S.String.annotate({ term: name })",
          'export const a = S.String.pipe(S.annotateKey({ description: "x", noTerm: reason }))',
          "export const a = S.String.pipe(S.annotateKey({ path: steps }))",
          'export const a = $I.annoteSchema("A", { "term": "inv:Member" })',
          'export class A extends S.Class<A>("A")({ id: S.String }, { term: "inv:Member" }) {}',
          'const hoisted = { term: "inv:Member" }',
          'const hoisted = { noTerm: { reason: "screen" } }',
          'const hoisted = { path: [{ property: "inv:grantsRole" }] }',
          'export const a = S.String.annotate({ ["term"]: "inv:Member" })',
          "export const a = S.String.annotate({ [`noTerm`]: reason })",
          'export const a = S.String.annotate({ description: "x", ...{ term: name } })'
        ]
        const found = yield* Effect.forEach(
          cases,
          (text) => refusals({ ...thread, "packages/access/test/Hand.test.ts": byHand(text) }),
          { concurrency: 4 }
        )
        expect(found).toStrictEqual(A.map(cases, () => ["packages/access/test/Hand.test.ts:2 rule 6"]))
      })
  )

  it.effect("refuses a mark built in a constant and named or spread in an annotation, whatever its value", () =>
    Effect.gen(function* () {
      const cases = [
        'const hand = { term: name }\nexport const a = S.String.annotate({ description: "x", ...hand })',
        "const hand = { noTerm: why }\nexport const a = S.String.pipe(S.annotateKey(hand))",
        'const inner = { path: steps }\nconst hand = { description: "x", ...inner }\nexport const a = S.String.annotate(hand)',
        'const hand = { term: "Member" }\nexport class A extends S.Class<A>("A")({ id: S.String }, { ...hand }) {}'
      ]
      const found = yield* Effect.forEach(
        cases,
        (text) => refusals({ ...thread, "packages/access/test/Hand.test.ts": byHand(text) }),
        { concurrency: 4 }
      )
      expect(A.map(found, (each) => A.dedupe(A.map(each, Str.replace(/:\d+ /, " "))))).toStrictEqual(
        A.map(cases, () => ["packages/access/test/Hand.test.ts rule 6"])
      )
    })
  )

  it.effect("refuses the object in brackets, under satisfies, in a function, and a key read from a constant", () =>
    Effect.gen(function* () {
      const cases = [
        "export const a = S.String.annotate(({ term: name }))",
        "const hand = { term: name } satisfies { readonly term: unknown }\nexport const a = S.String.annotate(hand)",
        "export const make = () => {\n  const hand = { noTerm: why }\n  return S.String.annotate(hand)\n}",
        'const key = "term"\nexport const a = S.String.annotate({ [key]: "inv:Member" })',
        'export const a = S.String.annotate({ [cond ? "description" : "term"]: "inv:Member" })'
      ]
      const found = yield* Effect.forEach(
        cases,
        (text) => refusals({ ...thread, "packages/access/test/Hand.test.ts": byHand(text) }),
        { concurrency: 4 }
      )
      expect(A.map(found, (each) => A.dedupe(A.map(each, Str.replace(/:\d+ /, " "))))).toStrictEqual(
        A.map(cases, () => ["packages/access/test/Hand.test.ts rule 6"])
      )
    })
  )

  it.effect("exempts a vendored package only: a vendor.json above the packages exempts none", () =>
    Effect.gen(function* () {
      const found = yield* refusals({
        ...thread,
        "packages/vendor.json": "{}",
        "packages/access/model/src/Hand.ts": byHand('export const a = S.String.annotate({ term: "inv:Member" })')
      })
      expect(found).toStrictEqual(["packages/access/model/src/Hand.ts:2 rule 6"])
    })
  )

  it.effect("passes data handed to a curried function under the three names", () =>
    Effect.gen(function* () {
      const lines = yield* inTree(
        {
          ...thread,
          "packages/access/model/src/Decode.ts":
            'const decode = (schema: string) => (value: { readonly term: string; readonly path: ReadonlyArray<string> }) => value\nexport const parsed = decode("schema")({ term: "spring", path: ["a", "b"] })\n'
        },
        inRepository
      )
      expect(lines).toStrictEqual([clean])
    })
  )

  it.effect("holds the helpers' package to it outside the module that returns a mark and its tests", () =>
    Effect.gen(function* () {
      const hand = byHand('export const a = S.String.annotate({ term: "inv:Member" })')
      const found = yield* refusals({
        ...thread,
        "packages/foundation/modeling/vocabulary/src/Pointer.mark.ts": hand,
        "packages/foundation/modeling/vocabulary/src/Other.ts": hand
      })
      expect(found).toStrictEqual(["packages/foundation/modeling/vocabulary/src/Other.ts:2 rule 6"])
    })
  )

  it.effect(
    "passes a table keyed by the three names, a field named path, the helpers' package and the vendored kit",
    () =>
      Effect.gen(function* () {
        const lines = yield* inTree(
          {
            ...thread,
            "packages/ontology/src/Rules.ts": byHand(
              'export const rule = { term: "P5", path: "P7", noTerm: "P9" }\nexport class E extends S.TaggedError<E>("E")("E", { path: S.String, term: S.String }) {}'
            ),
            "packages/foundation/modeling/vocabulary/test/Pointer.test.ts": byHand(
              'export const a = S.String.annotate({ noTerm: { reason: "screen", slice: "party" } })'
            ),
            "packages/foundation/modeling/identity/package.json": json({ name: "@beep/identity" }),
            "packages/foundation/modeling/identity/vendor.json": "{}",
            "packages/foundation/modeling/identity/test/Key.test.ts": byHand(
              'export const a = $I.annoteSchema("A", { term: "skos:altLabel" })'
            )
          },
          inRepository
        )
        expect(lines).toStrictEqual([clean])
      })
  )
})

describe("rule 7, only the ontology package loads the vocabulary", () => {
  const web = "apps/inventory/src/web/Leak.ts"
  const leak = (line: string, more: Tree = {}) => refusals({ ...thread, [web]: `${line}\n`, ...more })
  const relative = "../../../../packages/kernel/src/Terms.vocab.ts"

  it.effect("a second negative: a web source that imports the value by a relative path", () =>
    Effect.gen(function* () {
      const found = yield* leak(`import { vocabulary } from "${relative}"`)
      expect(found).toStrictEqual([`${web}:1 rule 7`])
    })
  )

  it.effect("passes the same line as a type import, and a type re-export", () =>
    Effect.gen(function* () {
      const typed = yield* leak(`import type { vocabulary } from "${relative}"`)
      const reexported = yield* leak(
        `export type { Inv } from "${relative}"\nexport type * from "@inventory/kernel/Terms"`
      )
      expect([typed, reexported]).toStrictEqual([[], []])
    })
  )

  it.effect("refuses every other way to the file: an entry, an alias of each kind, a re-export, a dynamic import", () =>
    Effect.gen(function* () {
      const ways: ReadonlyArray<readonly [string, Tree]> = [
        ['import { vocabulary } from "@inventory/kernel/Terms"', {}],
        ['import "@inventory/kernel/Terms"', {}],
        // With `verbatimModuleSyntax` an inline `type` leaves the import statement, and the module is loaded.
        ['import { type Inv } from "@inventory/kernel/Terms"', {}],
        ['import * as Terms from "../../../../packages/kernel/src/Terms.vocab"', {}],
        ['import { vocabulary } from "../../../../packages/kernel/src/Terms.vocab.js"', {}],
        ['export * from "@inventory/kernel/Terms"', {}],
        ['export { vocabulary } from "@inventory/kernel/Terms"', {}],
        ['export const load = () => import("@inventory/kernel/Terms")', {}],
        ['import Terms = require("@inventory/kernel/Terms")', {}],
        ["export const load = () => import(`@inventory/kernel/Terms`)", {}],
        ['export const load = () => import(("@inventory/kernel/Terms") satisfies string)', {}],
        ['export const load = (web: boolean) => import(web ? "./Other.ts" : "@inventory/kernel/Terms")', {}],
        [`import text from "${relative}?raw"`, {}],
        [
          'import { vocabulary } from "@shared"',
          {
            "tooling/tsconfig.terms.json": json({
              compilerOptions: { paths: { "@shared": ["../packages/kernel/src/Terms.vocab.ts"] } }
            }),
            "apps/inventory/tsconfig.json": json({
              extends: ["../../tooling/tsconfig.terms", "some-package/tsconfig.json"],
              compilerOptions: {}
            })
          }
        ],
        [
          'import { vocabulary } from "@terms"',
          {
            "apps/inventory/tsconfig.json": `{
  // an alias the app declares
  "compilerOptions": { "paths": { "@terms": ["../../packages/kernel/src/Terms.vocab.ts"], } }
}`
          }
        ],
        [
          'import { vocabulary } from "~kernel/Terms.vocab"',
          {
            "apps/inventory/tsconfig.app.json": json({
              compilerOptions: { baseUrl: "../..", paths: { "~kernel/*": ["packages/kernel/src/*"] } }
            })
          }
        ],
        [
          'import { vocabulary } from "#terms"',
          {
            "apps/inventory/package.json": json({
              name: "@inventory/app",
              imports: { "#terms": { types: "./x.d.ts", default: "../../packages/kernel/src/Terms.vocab.ts" } }
            })
          }
        ]
      ]
      const found = yield* Effect.forEach(ways, ([line, more]) => leak(line, more), { concurrency: 4 })
      expect(found).toStrictEqual(A.map(ways, () => [`${web}:1 rule 7`]))
    })
  )

  it.effect(
    "refuses a dynamic import whose module is a constant, a sum or a filled template that reads as the entry",
    () =>
      Effect.gen(function* () {
        const ways = [
          'export const load = () => import(`@inventory/kernel/${"Terms"}`)',
          'const spec = "@inventory/kernel/Terms"\nexport const load = () => import(spec)',
          'export const load = () => import("@inventory/kernel/" + "Terms")',
          'const vocab = "@inventory/kernel/Terms"\nconst other = "./Other.ts"\nexport const load = (flag: boolean) => import(flag ? vocab : other)'
        ]
        const found = yield* Effect.forEach(ways, (line) => leak(line), { concurrency: 4 })
        expect(A.map(found, (each) => A.map(each, Str.replace(/:\d+ /, " ")))).toStrictEqual(
          A.map(ways, () => [`${web} rule 7`])
        )
      })
  )

  it.effect("follows extends to a configuration of any name", () =>
    Effect.gen(function* () {
      const found = yield* leak('import { vocabulary } from "@shared"', {
        "apps/inventory/vocab.paths.json": json({
          compilerOptions: { paths: { "@shared": ["../../packages/kernel/src/Terms.vocab.ts"] } }
        }),
        "apps/inventory/tsconfig.json": json({ extends: "./vocab.paths.json" })
      })
      expect(found).toStrictEqual([`${web}:1 rule 7`])
    })
  )

  it.effect("passes an entry whose types alone are the vocabulary's: the file loaded is another", () =>
    Effect.gen(function* () {
      const found = yield* leak('import { other } from "@inventory/kernel/Terms"', {
        "packages/kernel/package.json": json({
          name: "@inventory/kernel",
          exports: {
            "./Terms": { types: "./src/Terms.vocab.ts", default: "./src/Other.ts" },
            "./TermsPointer": "./src/Terms.pointer.ts"
          }
        }),
        "packages/ontology/src/Thread.ts": `import { vocabulary } from "../../kernel/src/Terms.vocab.ts"\nexport const base = vocabulary.base\n`
      })
      expect(found).toStrictEqual([])
    })
  )

  it.effect("holds the kernel's own files to it too, and lets another module of the kernel through", () =>
    Effect.gen(function* () {
      const found = yield* refusals({
        ...thread,
        "packages/kernel/src/index.ts": 'export * from "./Terms.vocab.ts"\nexport * from "./Member.schema.ts"\n',
        "packages/kernel/test/Terms.test.ts":
          'import { vocabulary } from "@inventory/kernel/Terms"\nexport const v = vocabulary\n',
        [web]: 'import { Member } from "@inventory/kernel/Member"\nexport const m = Member\n'
      })
      expect(found).toStrictEqual([
        "packages/kernel/src/index.ts:1 rule 7",
        "packages/kernel/test/Terms.test.ts:1 rule 7"
      ])
    })
  )
})
