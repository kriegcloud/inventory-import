/**
 * Gate 9, the reasoner (report 14 section 6.9; decisions 112, 113 and 121): the pin of the two tools it needs, the
 * runs, and what each run must come to: the thread's five, and one for each hand-written fixture of the party slice
 * with the refusal of decision 34 (PLAN step 13). The machine it runs on is a port, `Machine`, so the checks that come
 * before a run are tested with no Java and no jar: `scripts/reason.ts` gives the real one.
 *
 * Do not break: the gate fails, never skips. No Java of the pinned major version, a jar that cannot be fetched and a
 * jar whose bytes do not hash to the pin each stop it before any run, and a run that does not come to what it must
 * fails it. A run that must be inconsistent first passes the OWL 2 DL profile check, so the reasoner's refusal is
 * the inconsistency and not a file it could not read.
 *
 * @packageDocumentation
 */
import { LiteralKit } from "@beep/schema/LiteralKit"
import * as A from "effect/Array"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import { identity, pipe } from "effect/Function"
import * as O from "effect/Option"
import * as S from "effect/Schema"
import * as Str from "effect/String"
import graph from "../generated/fixtures/CQ-P06.graph.ttl?raw"
import ontology from "../generated/inventory.owl.ttl?raw"
import entryIsPerson from "../fixtures/reason/entry-is-person.ttl?raw"
import entryIsTenant from "../fixtures/reason/entry-is-tenant.ttl?raw"
import entryNamesMember from "../fixtures/reason/entry-names-member.ttl?raw"
import personIsTenant from "../fixtures/reason/person-is-tenant.ttl?raw"
import recordIsOrganization from "../fixtures/reason/record-is-organization.ttl?raw"
import bareTypeFixture from "../../../explorations/erp-ontology/assets/requirements/cq/bare-type.fixture.ttl?raw"
import tradingFixture from "../../../explorations/erp-ontology/assets/requirements/cq/CQ-P01.fixture.ttl?raw"
import rolelessFixture from "../../../explorations/erp-ontology/assets/requirements/cq/CQ-P02.fixture.ttl?raw"
import tenancyFixture from "../../../explorations/erp-ontology/assets/requirements/cq/CQ-P09.fixture.ttl?raw"
import identityFixture from "../../../explorations/erp-ontology/assets/requirements/cq/CQ-P04.fixture.ttl?raw"
import samenessFixture from "../../../explorations/erp-ontology/assets/requirements/cq/CQ-P05.fixture.ttl?raw"
import modelCallFixture from "../../../explorations/erp-ontology/assets/requirements/cq/model-call.ttl?raw"
import stewardshipFixture from "../../../explorations/erp-ontology/assets/requirements/cq/CQ-P07.fixture.ttl?raw"
import contactsFixture from "../../../explorations/erp-ontology/assets/requirements/cq/CQ-P03.fixture.ttl?raw"
import suttonPartyFixture from "../../../explorations/erp-ontology/assets/requirements/cq/sutton-party.ttl?raw"
import lock from "../robot.lock.json" with { type: "json" }
import { $OntologyId } from "./internal/identity.ts"

const $I = $OntologyId.create("Reason")

/**
 * The pin Benjamin approved (decisions 112 and 113): one release of ROBOT by the address, size and sha256 of its
 * jar, and Java by its major version. `robot.lock.json` is its one copy.
 */
export class RobotLock extends S.Class<RobotLock, { readonly brand: unique symbol }>($I`RobotLock`)(
  {
    tool: S.Literal("ROBOT").pipe(S.annotateKey({ description: "The tool the pin is of" })),
    release: S.String.check(S.isPattern(/^v\d+\.\d+\.\d+$/)).pipe(
      S.annotateKey({ description: "The release, as its tag is written" })
    ),
    file: S.String.check(S.isPattern(/^[A-Za-z0-9._-]{1,64}$/)).pipe(
      S.annotateKey({ description: "The jar's file name" })
    ),
    url: S.String.check(S.isPattern(/^https:\/\/github\.com\/ontodev\/robot\/releases\/download\/[^\s]+$/)).pipe(
      S.annotateKey({ description: "Where the jar is fetched from: the release's own asset" })
    ),
    bytes: S.Int.check(S.isGreaterThan(0)).pipe(S.annotateKey({ description: "The jar's size in bytes" })),
    sha256: S.String.check(S.isPattern(/^[0-9a-f]{64}$/)).pipe(
      S.annotateKey({ description: "The sha256 of the jar's bytes, in lower-case hex" })
    ),
    javaMajor: S.Int.check(S.isGreaterThan(0)).pipe(
      S.annotateKey({ description: "The major version of the Java that runs the jar" })
    )
  },
  { description: "The pin of the reasoner's two tools" }
) {}

/**
 * The pin as `robot.lock.json` holds it, decoded. It fails when the file is not a pin.
 *
 * @example robotPin // RobotLock { release: "v1.9.11", javaMajor: 17, … }
 */
export const robotPin = S.decodeUnknownEffect(RobotLock)(lock)

/** One place the machine may keep a Java, and the version found there: none when no Java answers there. */
export class JavaFound extends S.Opaque<JavaFound, { readonly brand: unique symbol }>()(
  S.Struct({
    where: S.String.pipe(S.annotateKey({ description: "The path of the java looked at" })),
    version: S.Option(S.String).pipe(
      S.annotateKey({ description: "The version it says it is; none when nothing answers there" })
    )
  }).pipe($I.annoteSchema("JavaFound", { description: "One place a Java may be, and the version found there" }))
) {}

/** The jar as the machine holds it: the sha256 and the size of its bytes. */
export class JarFound extends S.Opaque<JarFound, { readonly brand: unique symbol }>()(
  S.Struct({
    sha256: S.String.pipe(S.annotateKey({ description: "The sha256 of the bytes on the machine, in hex" })),
    bytes: S.Int.check(S.isGreaterThanOrEqualTo(0)).pipe(S.annotateKey({ description: "How many bytes are there" }))
  }).pipe($I.annoteSchema("JarFound", { description: "The jar as the machine holds it" }))
) {}

/** What a command of ROBOT came to: its exit code and everything it printed. */
export class RobotResult extends S.Opaque<RobotResult, { readonly brand: unique symbol }>()(
  S.Struct({
    code: S.Int.pipe(S.annotateKey({ description: "The exit code; a command that never ran, or was stopped, has 1" })),
    output: S.String.pipe(S.annotateKey({ description: "Everything the command printed, both streams" }))
  }).pipe($I.annoteSchema("RobotResult", { description: "What one command of ROBOT came to" }))
) {}

/**
 * No Java of the pinned major version is on the machine. `found` is each place looked at with what answered there.
 *
 * @category errors
 */
export class JavaNotPinned extends S.TaggedError<JavaNotPinned, { readonly brand: unique symbol }>($I`JavaNotPinned`)(
  "JavaNotPinned",
  {
    major: S.Int.pipe(S.annotateKey({ description: "The major version the pin names" })),
    found: S.Array(S.String).pipe(S.annotateKey({ description: "Each place looked at and what answered there" }))
  },
  $I.annoteError<JavaNotPinned>("JavaNotPinned", { description: "No Java of the pinned major version is installed." })
) {}

/**
 * The jar is not on the machine and could not be fetched from the pinned address.
 *
 * @category errors
 */
export class JarNotFetched extends S.TaggedError<JarNotFetched, { readonly brand: unique symbol }>($I`JarNotFetched`)(
  "JarNotFetched",
  {
    url: S.String.pipe(S.annotateKey({ description: "The address the jar was asked of" })),
    reason: S.String.pipe(S.annotateKey({ description: "What the fetch came to" }))
  },
  $I.annoteError<JarNotFetched>("JarNotFetched", { description: "The reasoner's jar could not be fetched." })
) {}

/**
 * The jar on the machine is not the one approved: its bytes do not hash to the pin.
 *
 * @category errors
 */
export class JarNotPinned extends S.TaggedError<JarNotPinned, { readonly brand: unique symbol }>($I`JarNotPinned`)(
  "JarNotPinned",
  {
    expected: S.String.pipe(S.annotateKey({ description: "The sha256 the pin names" })),
    found: S.String.pipe(S.annotateKey({ description: "The sha256 of the jar on the machine" })),
    bytes: S.Int.pipe(S.annotateKey({ description: "The size of the jar on the machine" }))
  },
  $I.annoteError<JarNotPinned>("JarNotPinned", { description: "The reasoner's jar is not the approved file." })
) {}

/**
 * A run did not come to what it must. `output` is what ROBOT printed.
 *
 * @category errors
 */
export class RunRefused extends S.TaggedError<RunRefused, { readonly brand: unique symbol }>($I`RunRefused`)(
  "RunRefused",
  {
    run: S.String.pipe(S.annotateKey({ description: "The run, by its name" })),
    reason: S.String.pipe(S.annotateKey({ description: "What it must come to and what it came to" })),
    output: S.String.pipe(S.annotateKey({ description: "What ROBOT printed" }))
  },
  $I.annoteError<RunRefused>("RunRefused", { description: "A run of the reasoner did not come to what it must." })
) {}

/**
 * The machine gate 9 runs on: the Javas it has, the jar it holds, the fetch of the jar, and ROBOT itself.
 *
 * @category services
 */
export class Machine extends Context.Service<
  Machine,
  {
    /** Each place a Java may be, in the order they are tried, with the version that answers there. */
    readonly javas: Effect.Effect<ReadonlyArray<JavaFound>>
    /** The jar kept outside the repository, if it is there. */
    readonly jar: Effect.Effect<O.Option<JarFound>>
    /** Fetches the jar from `url` to where `jar` reads it. */
    readonly fetch: (url: string) => Effect.Effect<void, JarNotFetched>
    /** Runs one command of ROBOT on one Turtle document, with the Java at `java`. */
    readonly robot: (input: {
      readonly java: string
      readonly command: "validate-profile" | "reason"
      readonly document: string
    }) => Effect.Effect<RobotResult>
  }
>()($I`Machine`) {}

/** What a reasoner run must come to. */
export const Verdict = LiteralKit(["consistent", "inconsistent"]).pipe(
  $I.annoteSchema("Verdict", { description: "What the reasoner must find: consistent, or inconsistent" })
)
/** Runtime type of {@link Verdict}. */
export type Verdict = typeof Verdict.Type

/** One run: the files it joins, what the reasoner must find, and the forbidden conclusion it stands for. */
export class Run extends S.Opaque<Run, { readonly brand: unique symbol }>()(
  S.Struct({
    name: S.String.pipe(S.annotateKey({ description: "What the run is called in the gate's output" })),
    ban: S.String.pipe(
      S.annotateKey({
        description: "The forbidden conclusion it stands for and which side of it, or the fixture it holds consistent"
      })
    ),
    files: S.Array(S.String).pipe(S.annotateKey({ description: "The Turtle texts it joins, the ontology first" })),
    must: Verdict.pipe(S.annotateKey({ description: "What the reasoner must find for the gate to pass" }))
  }).pipe($I.annoteSchema("Run", { description: "One run of the reasoner and what it must come to" }))
) {}

const thread: ReadonlyArray<string> = [ontology, graph]

/** Where the party slice's fixtures live (decision 148): a run is named by its file there. */
const packet = "cq/"

/**
 * The runs. First the thread's five (the goal's forbidden conclusions 1 and 2): two that must be consistent and three
 * that must not, each the generated ontology and the thread's graph, the three refusals and one near miss with one
 * file more. Then the party slice's eleven (PLAN step 13): each hand-written fixture with the generated ontology and
 * nothing else, the closure decision 28 names, CQ-P05's beside CQ-P04's as its question reads it; and decision 34's
 * refusal, a tenant's record also typed an organization, beside CQ-P01's fixture, whose own run is its near miss.
 */
export const runs: ReadonlyArray<Run> = [
  Run.make({
    name: "the thread's graph",
    ban: "ban 1, the near miss: the same person is a member of two tenants",
    files: thread,
    must: "consistent"
  }),
  Run.make({
    name: "fixtures/reason/entry-names-member.ttl",
    ban: "ban 2, the near miss: an audit entry names a member of the person, in the tenant",
    files: [...thread, entryNamesMember],
    must: "consistent"
  }),
  Run.make({
    name: "fixtures/reason/person-is-tenant.ttl",
    ban: "ban 1, refused: a person is a tenant",
    files: [...thread, personIsTenant],
    must: "inconsistent"
  }),
  Run.make({
    name: "fixtures/reason/entry-is-person.ttl",
    ban: "ban 2, refused: an audit entry is the person it is about",
    files: [...thread, entryIsPerson],
    must: "inconsistent"
  }),
  Run.make({
    name: "fixtures/reason/entry-is-tenant.ttl",
    ban: "ban 2, refused: an audit entry is the organization it is about",
    files: [...thread, entryIsTenant],
    must: "inconsistent"
  }),
  Run.make({
    name: `${packet}bare-type.fixture.ttl`,
    ban: "slice 1, step 5's fixture: a node typed only a tenant",
    files: [ontology, bareTypeFixture],
    must: "consistent"
  }),
  Run.make({
    name: `${packet}CQ-P01.fixture.ttl`,
    ban: "decision 34, the near miss: each tenant's record of an organization is of it, and is not it",
    files: [ontology, tradingFixture],
    must: "consistent"
  }),
  Run.make({
    name: `${packet}CQ-P02.fixture.ttl`,
    ban: "slice 1, CQ-P02's fixture: records that state no trading role, and the open reading, which states no flag",
    files: [ontology, rolelessFixture],
    must: "consistent"
  }),
  Run.make({
    name: `${packet}CQ-P09.fixture.ttl`,
    ban: "slice 1, CQ-P09's fixture: a record held by one tenant, one held by none and one held by two",
    files: [ontology, tenancyFixture],
    must: "consistent"
  }),
  Run.make({
    name: `${packet}CQ-P04.fixture.ttl`,
    ban: "slice 1, CQ-P04's fixture: a tenant's decisions on its records, each at its date-time",
    files: [ontology, identityFixture],
    must: "consistent"
  }),
  Run.make({
    name: `${packet}CQ-P05.fixture.ttl`,
    ban: "slice 1, CQ-P05's fixture beside CQ-P04's: two records stated the same, the way identity is never stated",
    files: [ontology, identityFixture, samenessFixture],
    must: "consistent"
  }),
  Run.make({
    name: `${packet}model-call.ttl`,
    ban: "slice 1, model-call.ttl: one model call of each purpose",
    files: [ontology, modelCallFixture],
    must: "consistent"
  }),
  Run.make({
    name: `${packet}CQ-P07.fixture.ttl`,
    ban: "slice 1, CQ-P07's fixture: a tenant with an active admin, one whose only admin is revoked, one with no members",
    files: [ontology, stewardshipFixture],
    must: "consistent"
  }),
  Run.make({
    name: `${packet}CQ-P03.fixture.ttl`,
    ban: "slice 1, CQ-P03's fixture: contacts at two accounts, each for its purpose",
    files: [ontology, contactsFixture],
    must: "consistent"
  }),
  Run.make({
    name: `${packet}sutton-party.ttl`,
    ban: "slice 1, sutton-party.ttl: one record of each Sutton type the coverage table places",
    files: [ontology, suttonPartyFixture],
    must: "consistent"
  }),
  Run.make({
    name: "fixtures/reason/record-is-organization.ttl",
    ban: "decision 34, refused: a tenant's record of an organization is that organization",
    files: [ontology, tradingFixture, recordIsOrganization],
    must: "inconsistent"
  })
]

/**
 * The major version a Java's version text names: `17.0.2` is 17, and the old form `1.8.0_292` is 8.
 *
 * @example majorOf("17.0.21.1") // O.some(17)
 */
export const majorOf = (version: string): O.Option<number> =>
  pipe(
    // The old form names its major after "1.": tried first, so `1.8.0_292` is 8 and a plain `17.0.2` is 17.
    O.orElse(Str.match(/^1\.(\d+)/)(version), () => Str.match(/^(\d+)/)(version)),
    O.flatMap(A.get(1)),
    O.map(Number),
    O.filter((major) => Number.isSafeInteger(major) && major > 0)
  )

/** The first Java of the pinned major version, with the version it said it is, or the refusal naming every place
 * looked at. */
const pinnedJava = Effect.fnUntraced(function* (pin: RobotLock) {
  const machine = yield* Machine
  const found = yield* machine.javas
  const pinned = A.findFirst(found, (java) =>
    O.map(
      O.filter(java.version, (version) => O.contains(majorOf(version), pin.javaMajor)),
      (version) => ({ where: java.where, version })
    )
  )
  if (O.isNone(pinned)) {
    return yield* JavaNotPinned.make({
      major: pin.javaMajor,
      found: A.map(
        found,
        (java) => `${java.where}: ${O.match(java.version, { onNone: () => "no Java answers there", onSome: identity })}`
      )
    })
  }
  return pinned.value
})

/** Holds the jar to the pin: fetched when the machine has none, and refused when its bytes are not the approved ones. */
const pinnedJar = Effect.fnUntraced(function* (pin: RobotLock) {
  const machine = yield* Machine
  const kept = yield* machine.jar
  if (O.isNone(kept)) {
    yield* machine.fetch(pin.url)
  }
  const held = O.isSome(kept) ? kept : yield* machine.jar
  if (O.isNone(held)) {
    return yield* JarNotFetched.make({ url: pin.url, reason: "the fetch ended and no jar is there" })
  }
  if (held.value.sha256 !== pin.sha256 || held.value.bytes !== pin.bytes) {
    return yield* JarNotPinned.make({ expected: pin.sha256, found: held.value.sha256, bytes: held.value.bytes })
  }
  return O.isNone(kept)
})

/**
 * The files of a run as one Turtle document. ROBOT's own `merge` reads each file alone, and a file of data alone
 * declares no property, so its statements are read as annotations and the profile check refuses the merge
 * (tried on v1.9.11). In one document the ontology's declarations come first. A later file's `@base` and prefixes
 * are read from where they stand, so the document states the triples the files state apart, which a test holds.
 *
 * @example documentOf(runs[0]) // the generated ontology, then the thread's graph
 */
export const documentOf = (run: Run): string => A.join(run.files, "\n")

/** One run: the profile check, then the reasoner, held to what the run must come to. Answers its line of the report. */
const reasonOne = Effect.fnUntraced(function* (java: string, run: Run) {
  const machine = yield* Machine
  const document = documentOf(run)
  const profile = yield* machine.robot({ java, command: "validate-profile", document })
  if (profile.code !== 0) {
    return yield* RunRefused.make({
      run: run.name,
      reason: "the joined files must be in the OWL 2 DL profile, and the profile check refused them",
      output: profile.output
    })
  }
  const reasoned = yield* machine.robot({ java, command: "reason", document })
  const inconsistent = reasoned.code !== 0 && Str.includes("The ontology is inconsistent")(reasoned.output)
  if (run.must === "consistent" && reasoned.code !== 0) {
    return yield* RunRefused.make({
      run: run.name,
      reason: inconsistent
        ? "it must be consistent, and the reasoner reports an inconsistency"
        : "it must be consistent, and the reasoner stopped for another reason",
      output: reasoned.output
    })
  }
  if (run.must === "inconsistent" && !inconsistent) {
    return yield* RunRefused.make({
      run: run.name,
      reason:
        reasoned.code === 0
          ? "the reasoner must report an inconsistency, and it found the files consistent"
          : "the reasoner must report an inconsistency, and it stopped for another reason",
      output: reasoned.output
    })
  }
  return `${run.ban}: ${run.name} is ${
    run.must === "consistent" ? "in the DL profile and consistent" : "in the DL profile and reported inconsistent"
  }`
})

/**
 * Gate 9: reads the pin, holds Java and the jar to it, and makes every run. Answers the lines of its report, one for
 * the tools, naming the version the Java that ran said it is, and one for each run, each naming the forbidden
 * conclusion or the fixture it stands for.
 *
 * It fails with `JavaNotPinned`, `JarNotFetched`, `JarNotPinned` or `RunRefused`, and with the pin's own decoding
 * error when `robot.lock.json` is not a pin.
 *
 * @example reason() // seventeen lines when the machine has Java 17 and the approved jar
 */
export const reason = Effect.fn("ontology.reason")(function* () {
  const pin = yield* robotPin
  const java = yield* pinnedJava(pin)
  const fetched = yield* pinnedJar(pin)
  const lines = yield* Effect.forEach(runs, (run) => reasonOne(java.where, run), { concurrency: 1 })
  return [
    `ROBOT ${pin.release} (sha256 ${pin.sha256}${fetched ? ", fetched now" : ""}) with HermiT under Java ${java.version} at ${java.where}`,
    ...lines
  ]
})

/**
 * A refusal of gate 9 as a sentence for whoever ran it: what was looked for, what was found, and what to do.
 *
 * @example refusalSentence(JavaNotPinned.make({ major: 17, found: ["java: 27.0.1"] })) // "Java 17 is not installed: …"
 */
export const refusalSentence = (refusal: unknown): string => {
  if (S.is(JavaNotPinned)(refusal)) {
    return `Java ${refusal.major} is not installed, and the pin names it (decision 113). Looked at ${A.join(refusal.found, "; ")}. Install Java ${refusal.major} or set JAVA_HOME to it.`
  }
  if (S.is(JarNotFetched)(refusal)) {
    return `The reasoner's jar is not on this machine and could not be fetched from ${refusal.url}: ${refusal.reason}`
  }
  if (S.is(JarNotPinned)(refusal)) {
    return `The reasoner's jar is not the approved file (decision 112): its sha256 is ${refusal.found} over ${refusal.bytes} bytes, and the pin names ${refusal.expected}. Delete it and run again to fetch the pinned one.`
  }
  if (S.is(RunRefused)(refusal)) {
    return `${refusal.run}: ${refusal.reason}.\n${refusal.output}`
  }
  return `robot.lock.json is not a pin, or the gate stopped for a reason of its own: ${String(refusal)}`
}
