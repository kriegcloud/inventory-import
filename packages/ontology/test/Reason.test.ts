// Gate 9's checks, on a machine written for each case (report 14 section 6.9): the gate fails, never skips, when no
// Java of the pinned version is installed, when the jar cannot be fetched and when its bytes are not the approved
// ones, and it fails when a run does not come to what it must. No Java and no jar is used here: the real run is the
// package's `reason` task, in `bun run check:full`.
import { describe, expect, it } from "@effect/vitest"
import { assertSome, assertTrue } from "@effect/vitest/utils"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as Ref from "effect/Ref"
import * as Result from "effect/Result"
import * as S from "effect/Schema"
import * as Str from "effect/String"
import {
  JarNotFetched,
  JarNotPinned,
  JavaNotPinned,
  Machine,
  Run,
  RunRefused,
  documentOf,
  packetFolder,
  majorOf,
  reason,
  refusalSentence,
  robotPin,
  runs,
  JarFound,
  JavaFound,
  RobotResult
} from "../src/Reason.ts"
import { linesOf } from "../src/Graph.schema.ts"
import { threadHandWritten } from "../src/Thread.ts"
import { readTurtle } from "../src/Turtle.ts"
import threadGraph from "../generated/fixtures/CQ-P06.graph.ttl?raw"
import recordIsOrganization from "../fixtures/reason/record-is-organization.ttl?raw"
import { handWrittenFixtures, ontology, roleless, trading } from "./support/fixtures.ts"

const java17 = JavaFound.make({ where: "/opt/java-17/bin/java", version: O.some("17.0.2") })
const java27 = JavaFound.make({ where: "java", version: O.some("27.0.1.1") })
const absent = JavaFound.make({ where: "/opt/none/bin/java", version: O.none() })

/** What ROBOT prints for an inconsistency (v1.9.11, tried by hand), and its exit code. */
const inconsistent = RobotResult.make({
  code: 1,
  output: "ERROR org.obolibrary.robot.ReasonerHelper - The ontology is inconsistent. TIP: use a tool like Protege"
})
const fine = RobotResult.make({ code: 0, output: "" })

type Case = {
  readonly javas?: ReadonlyArray<JavaFound>
  /** The jar before a fetch, and after one. */
  readonly jar?: O.Option<JarFound>
  readonly fetched?: O.Option<JarFound>
  readonly fetchFails?: O.Option<string>
  /** What ROBOT answers: by default the profile passes and the reasoner refuses the three files that state a ban. */
  readonly robot?: (command: "validate-profile" | "reason", document: string) => RobotResult
}

const refusedFiles = [
  "test_Ravi> a inv:Tenant",
  "inv:AuditEntry , inv:Person",
  "inv:AuditEntry , inv:Tenant",
  "test_WorksCoPacker> a inv:Organization"
]
const honest = (command: "validate-profile" | "reason", document: string): RobotResult =>
  command === "reason" && A.some(refusedFiles, (text) => Str.includes(text)(document)) ? inconsistent : fine

/** Runs the gate on the machine of one case; answers what it came to, each call ROBOT got, and the fetches. */
const gate = Effect.fn("gate")(function* (asked: Case) {
  const pin = yield* robotPin
  const approved = JarFound.make({ sha256: pin.sha256, bytes: pin.bytes })
  // What a case leaves out is the machine that passes: both Javas, the approved jar, a fetch that works, honest ROBOT.
  const given = {
    javas: [java27, java17],
    jar: O.some(approved),
    fetched: O.some(approved),
    fetchFails: O.none(),
    robot: honest,
    ...asked
  }
  const calls = yield* Ref.make<ReadonlyArray<string>>([])
  const fetches = yield* Ref.make<ReadonlyArray<string>>([])
  const machine = Machine.of({
    javas: Effect.succeed(given.javas),
    jar: Effect.map(Ref.get(fetches), (made) => (A.isReadonlyArrayEmpty(made) ? given.jar : given.fetched)),
    fetch: Effect.fnUntraced(function* (url: string) {
      yield* O.match(given.fetchFails, {
        onNone: () => Effect.void,
        onSome: (reason) => Effect.fail(JarNotFetched.make({ url, reason }))
      })
      yield* Ref.update(fetches, A.append(url))
    }),
    robot: Effect.fnUntraced(function* ({ command, document, java }) {
      yield* Ref.update(calls, A.append(`${java} ${command}`))
      return given.robot(command, document)
    })
  })
  const result = yield* Effect.result(Effect.provideService(reason(), Machine, machine))
  return { result, calls: yield* Ref.get(calls), fetches: yield* Ref.get(fetches), pin }
})

/** The refusal a case ends in, as its sentence; "" when the gate passed. */
const refusalOf = (given: Case) =>
  Effect.map(gate(given), (run) => {
    assertTrue(Result.isFailure(run.result), "expected the tested value to be present")
    return { ...run, refusal: O.some(run.result.failure), sentence: refusalSentence(run.result.failure) }
  })

/** A run's path in the packet, as gate 9 names it. */
const inPacket = (file: string): string => `${packetFolder}${file}`
const refusedName = "fixtures/reason/record-is-organization.ttl"
const nearMissName = inPacket("CQ-P01.fixture.ttl")
const named = (given: ReadonlyArray<Run>, name: string) => A.findFirst(given, (run) => run.name === name)
const sameFiles = A.makeEquivalence(Str.Equivalence)

/** A plant: the runs with the one named `name` made again by `change`. */
const withRun = (given: ReadonlyArray<Run>, name: string, change: (run: Run) => Run): ReadonlyArray<Run> =>
  A.map(given, (run) => (run.name === name ? change(run) : run))

/** A plant: the runs with the files of the two named runs swapped, their names and verdicts left as they are. */
const swapped = (given: ReadonlyArray<Run>, one: string, other: string): ReadonlyArray<Run> => {
  const filesOf = (name: string) => A.flatMap(A.fromOption(named(given, name)), (run) => run.files)
  return A.map(given, (run) =>
    run.name === one
      ? Run.make({ ...run, files: filesOf(other) })
      : run.name === other
        ? Run.make({ ...run, files: filesOf(one) })
        : run
  )
}

/** Whether decision 34's refusal joins its near miss's files and the refused file after them, both runs there. */
const pairedWithNearMiss = (given: ReadonlyArray<Run>): boolean =>
  O.exists(O.all([named(given, refusedName), named(given, nearMissName)]), ([refused, nearMiss]) =>
    sameFiles(refused.files, [...nearMiss.files, recordIsOrganization])
  )

/** The runs of the packet whose last file is not the hand-written fixture of the file their name names, by name. */
const misjoined = (given: ReadonlyArray<Run>): ReadonlyArray<string> =>
  A.map(
    A.filter(
      given,
      (run) =>
        Str.startsWith(packetFolder)(run.name) &&
        !A.some(
          handWrittenFixtures,
          ([name, text]) => inPacket(name) === run.name && O.contains(A.last(run.files), text)
        )
    ),
    (run) => run.name
  )

/**
 * The texts of `handWrittenFixtures` no run of their own holds consistent, by name: a run that must be consistent and
 * joins the text last. A text that is only another run's file, or a file of a run that must be inconsistent, is not.
 */
const unrun = (given: ReadonlyArray<Run>): ReadonlyArray<string> =>
  A.map(
    A.filter(
      handWrittenFixtures,
      ([, text]) => !A.some(given, (run) => run.must === "consistent" && O.contains(A.last(run.files), text))
    ),
    ([name]) => name
  )

describe("gate 9, the reasoner's checks", () => {
  it.effect("passes on Java 17 and the approved jar: every run, each named for its ban or its fixture", () =>
    Effect.gen(function* () {
      const run = yield* gate({})
      assertTrue(Result.isSuccess(run.result), "expected the tested value to be present")
      expect(run.result.success).toStrictEqual([
        `ROBOT v1.9.11 (sha256 ${run.pin.sha256}) with HermiT under Java 17.0.2 at /opt/java-17/bin/java`,
        "ban 1, the near miss: the same person is a member of two tenants: the thread's graph is in the DL profile and consistent",
        "ban 2, the near miss: an audit entry names a member of the person, in the tenant: fixtures/reason/entry-names-member.ttl is in the DL profile and consistent",
        "ban 1, refused: a person is a tenant: fixtures/reason/person-is-tenant.ttl is in the DL profile and reported inconsistent",
        "ban 2, refused: an audit entry is the person it is about: fixtures/reason/entry-is-person.ttl is in the DL profile and reported inconsistent",
        "ban 2, refused: an audit entry is the organization it is about: fixtures/reason/entry-is-tenant.ttl is in the DL profile and reported inconsistent",
        "slice 1, step 5's fixture: a node typed only a tenant: explorations/erp-ontology/assets/requirements/cq/bare-type.fixture.ttl is in the DL profile and consistent",
        "decision 34, the near miss: each tenant's record of an organization is of it, and is not it: explorations/erp-ontology/assets/requirements/cq/CQ-P01.fixture.ttl is in the DL profile and consistent",
        "slice 1, CQ-P02's fixture: records that state no trading role, and the open reading, which states no flag: explorations/erp-ontology/assets/requirements/cq/CQ-P02.fixture.ttl is in the DL profile and consistent",
        "slice 1, CQ-P09's fixture: a record held by one tenant, one held by none and one held by two: explorations/erp-ontology/assets/requirements/cq/CQ-P09.fixture.ttl is in the DL profile and consistent",
        "slice 1, CQ-P04's fixture: a tenant's decisions on its records, each at its date-time: explorations/erp-ontology/assets/requirements/cq/CQ-P04.fixture.ttl is in the DL profile and consistent",
        "slice 1, CQ-P05's fixture beside CQ-P04's: two records stated the same, the way identity is never stated: explorations/erp-ontology/assets/requirements/cq/CQ-P05.fixture.ttl is in the DL profile and consistent",
        "slice 1, model-call.ttl: one model call of each purpose: explorations/erp-ontology/assets/requirements/cq/model-call.ttl is in the DL profile and consistent",
        "slice 1, CQ-P07's fixture: a tenant with an active admin, one whose only admin is revoked, one with no members: explorations/erp-ontology/assets/requirements/cq/CQ-P07.fixture.ttl is in the DL profile and consistent",
        "slice 1, CQ-P03's fixture: contacts at two accounts, each for its purpose: explorations/erp-ontology/assets/requirements/cq/CQ-P03.fixture.ttl is in the DL profile and consistent",
        "slice 1, sutton-party.ttl: one record of each Sutton type the coverage table places: explorations/erp-ontology/assets/requirements/cq/sutton-party.ttl is in the DL profile and consistent",
        "decision 34, refused: a tenant's record of an organization is that organization: fixtures/reason/record-is-organization.ttl is in the DL profile and reported inconsistent"
      ])
      // Each run is the profile check and then the reasoner, with the pinned Java and no other.
      expect(run.calls).toStrictEqual(
        A.flatMap(runs, () => ["/opt/java-17/bin/java validate-profile", "/opt/java-17/bin/java reason"])
      )
      expect(run.fetches).toStrictEqual([])
    })
  )

  it.effect("the pin is what decisions 112 and 113 approved", () =>
    Effect.gen(function* () {
      const pin = yield* robotPin
      expect({ ...pin }).toStrictEqual({
        tool: "ROBOT",
        release: "v1.9.11",
        file: "robot.jar",
        url: "https://github.com/ontodev/robot/releases/download/v1.9.11/robot.jar",
        bytes: 82708624,
        sha256: "53cd275c8e4c0dad1fc2c1c34174876795cd7d6b6926e1444adcbb0cb3c7ab26",
        javaMajor: 17
      })
    })
  )

  it.effect("refusal 1: no Java is installed", () =>
    Effect.gen(function* () {
      const run = yield* refusalOf({ javas: [absent] })
      expect(O.exists(run.refusal, S.is(JavaNotPinned))).toBe(true)
      expect(run.sentence).toContain("Java 17 is not installed")
      expect(run.sentence).toContain("/opt/none/bin/java: no Java answers there")
      expect(run.calls).toStrictEqual([])
    })
  )

  it.effect("refusal 2: Java is installed and is not 17", () =>
    Effect.gen(function* () {
      const run = yield* refusalOf({
        javas: [java27, JavaFound.make({ where: "/opt/java-8/bin/java", version: O.some("1.8.0_292") }), absent]
      })
      expect(O.exists(run.refusal, S.is(JavaNotPinned))).toBe(true)
      expect(run.sentence).toContain("java: 27.0.1.1; /opt/java-8/bin/java: 1.8.0_292")
      expect(run.calls).toStrictEqual([])
      expect(run.fetches).toStrictEqual([])
    })
  )

  it.effect("refusal 3: the jar is not there and cannot be fetched", () =>
    Effect.gen(function* () {
      const run = yield* refusalOf({ jar: O.none(), fetchFails: O.some("no route to host") })
      expect(O.exists(run.refusal, S.is(JarNotFetched))).toBe(true)
      expect(run.sentence).toContain(`could not be fetched from ${run.pin.url}: no route to host`)
      expect(run.calls).toStrictEqual([])
      // A fetch that ends with no jar is the same refusal, not a pass.
      const empty = yield* refusalOf({ jar: O.none(), fetched: O.none() })
      expect(O.exists(empty.refusal, S.is(JarNotFetched))).toBe(true)
      expect(empty.calls).toStrictEqual([])
    })
  )

  it.effect("refusal 4: the jar's bytes do not hash to the pin, kept or just fetched", () =>
    Effect.gen(function* () {
      const other = JarFound.make({ sha256: Str.repeat(64)("0"), bytes: 82708624 })
      const kept = yield* refusalOf({ jar: O.some(other) })
      expect(O.exists(kept.refusal, S.is(JarNotPinned))).toBe(true)
      expect(kept.sentence).toContain("is not the approved file")
      expect(kept.fetches).toStrictEqual([])
      expect(kept.calls).toStrictEqual([])
      const fetched = yield* refusalOf({ jar: O.none(), fetched: O.some(other) })
      expect(O.exists(fetched.refusal, S.is(JarNotPinned))).toBe(true)
      expect(fetched.fetches).toStrictEqual([fetched.pin.url])
      expect(fetched.calls).toStrictEqual([])
      // The right hash over another size is not the approved file either.
      const short = yield* refusalOf({ jar: O.some(JarFound.make({ sha256: kept.pin.sha256, bytes: 1 })) })
      expect(O.exists(short.refusal, S.is(JarNotPinned))).toBe(true)
    })
  )

  it.effect("fetches the jar once when it is missing, and says so", () =>
    Effect.gen(function* () {
      const run = yield* gate({ jar: O.none() })
      expect(run.fetches).toStrictEqual([run.pin.url])
      assertTrue(Result.isSuccess(run.result), "expected the tested value to be present")
      expect(run.result.success[0]).toContain(", fetched now)")
    })
  )

  it.effect("fails when a run that must be inconsistent is found consistent", () =>
    Effect.gen(function* () {
      const run = yield* refusalOf({ robot: () => fine })
      expect(O.exists(run.refusal, S.is(RunRefused))).toBe(true)
      expect(run.sentence).toContain(
        "fixtures/reason/person-is-tenant.ttl: the reasoner must report an inconsistency, and it found the files consistent"
      )
    })
  )

  it.effect("fails when a run that must be inconsistent stops for another reason: a crash is no refusal", () =>
    Effect.gen(function* () {
      const run = yield* refusalOf({
        robot: (command, document) =>
          command === "reason" && honest(command, document).code !== 0
            ? RobotResult.make({ code: 1, output: "java.lang.OutOfMemoryError" })
            : fine
      })
      expect(run.sentence).toContain("must report an inconsistency, and it stopped for another reason")
      expect(run.sentence).toContain("java.lang.OutOfMemoryError")
    })
  )

  it.effect("fails when a refused file is not in the DL profile: the refusal must be the inconsistency", () =>
    Effect.gen(function* () {
      const run = yield* refusalOf({
        robot: (command, document) =>
          command === "validate-profile" && Str.includes("test_Ravi> a inv:Tenant")(document)
            ? RobotResult.make({ code: 1, output: "PROFILE VIOLATION ERROR" })
            : honest(command, document)
      })
      expect(run.sentence).toContain(
        "fixtures/reason/person-is-tenant.ttl: the joined files must be in the OWL 2 DL profile"
      )
      // The reasoner is not asked of a file the profile check refused: it stops at the third run.
      expect(A.filter(run.calls, Str.endsWith("reason"))).toHaveLength(2)
    })
  )

  it.effect("fails when a run that must be consistent is not, and when it stops for another reason", () =>
    Effect.gen(function* () {
      const all = yield* refusalOf({ robot: (command) => (command === "reason" ? inconsistent : fine) })
      expect(all.sentence).toContain(
        "the thread's graph: it must be consistent, and the reasoner reports an inconsistency"
      )
      const crashed = yield* refusalOf({
        robot: (command) =>
          command === "reason" ? RobotResult.make({ code: 2, output: "Unable to access jarfile" }) : fine
      })
      expect(crashed.sentence).toContain("it must be consistent, and the reasoner stopped for another reason")
    })
  )

  it.effect("a run's document states the triples its files state apart, no more and no fewer", () =>
    Effect.gen(function* () {
      const base = "https://example.invalid/unused/"
      const linesIn = (text: string) => Effect.map(readTurtle(base, text), linesOf)
      const each = yield* Effect.forEach(
        runs,
        (run) =>
          Effect.all(
            {
              apart: Effect.map(Effect.forEach(run.files, linesIn, { concurrency: 1 }), (parts) =>
                A.dedupe(A.flatten(parts))
              ),
              joined: linesIn(documentOf(run))
            },
            { concurrency: 1 }
          ),
        { concurrency: 1 }
      )
      for (const { apart, joined } of each) {
        expect(A.sort(joined, Str.Order)).toStrictEqual(A.sort(apart, Str.Order))
        expect(joined.length).toBeGreaterThan(100)
      }
    })
  )

  it("reads Java's major version from its version text, the old form too", () => {
    expect(A.map(["17.0.2", "17", "27.0.1.1", "1.8.0_292", "11.0.20+8", "x", ""], majorOf)).toStrictEqual([
      O.some(17),
      O.some(17),
      O.some(27),
      O.some(8),
      O.some(11),
      O.none(),
      O.none()
    ])
  })

  it("each run joins the generated ontology and its files: the thread's graph, or one fixture of the slice", () => {
    expect(A.map(runs, (run) => [run.name, run.must, run.files.length])).toStrictEqual([
      ["the thread's graph", "consistent", 2],
      ["fixtures/reason/entry-names-member.ttl", "consistent", 3],
      ["fixtures/reason/person-is-tenant.ttl", "inconsistent", 3],
      ["fixtures/reason/entry-is-person.ttl", "inconsistent", 3],
      ["fixtures/reason/entry-is-tenant.ttl", "inconsistent", 3],
      ["explorations/erp-ontology/assets/requirements/cq/bare-type.fixture.ttl", "consistent", 2],
      ["explorations/erp-ontology/assets/requirements/cq/CQ-P01.fixture.ttl", "consistent", 2],
      ["explorations/erp-ontology/assets/requirements/cq/CQ-P02.fixture.ttl", "consistent", 2],
      ["explorations/erp-ontology/assets/requirements/cq/CQ-P09.fixture.ttl", "consistent", 2],
      ["explorations/erp-ontology/assets/requirements/cq/CQ-P04.fixture.ttl", "consistent", 2],
      ["explorations/erp-ontology/assets/requirements/cq/CQ-P05.fixture.ttl", "consistent", 3],
      ["explorations/erp-ontology/assets/requirements/cq/model-call.ttl", "consistent", 2],
      ["explorations/erp-ontology/assets/requirements/cq/CQ-P07.fixture.ttl", "consistent", 2],
      ["explorations/erp-ontology/assets/requirements/cq/CQ-P03.fixture.ttl", "consistent", 2],
      ["explorations/erp-ontology/assets/requirements/cq/sutton-party.ttl", "consistent", 2],
      ["fixtures/reason/record-is-organization.ttl", "inconsistent", 3]
    ])
    expect(A.every(runs, (run) => O.exists(A.head(run.files), Str.includes("inv:Tenant a owl:Class")))).toBe(true)
  })

  it("decision 34's refusal joins its near miss's files and the refused file after them, both runs there", () => {
    assertSome(
      O.map(named(runs, nearMissName), (run) => run.files),
      [ontology, trading.fixture]
    )
    assertSome(
      O.map(named(runs, refusedName), (run) => run.files),
      [ontology, trading.fixture, recordIsOrganization]
    )
    expect(pairedWithNearMiss(runs)).toBe(true)
    // Planted: the near miss with another fixture in CQ-P01's place no longer differs from the refusal by one file.
    expect(
      pairedWithNearMiss(
        withRun(runs, nearMissName, (run) => Run.make({ ...run, files: [ontology, roleless.fixture] }))
      )
    ).toBe(false)
    // Planted: the refused run with another file after CQ-P01's fixture is not decision 34's refusal.
    expect(
      pairedWithNearMiss(
        withRun(runs, refusedName, (run) => Run.make({ ...run, files: [ontology, trading.fixture, roleless.fixture] }))
      )
    ).toBe(false)
    // Planted: with neither run there, nothing is compared, and the check says so.
    expect(pairedWithNearMiss(A.filter(runs, (run) => run.name !== refusedName && run.name !== nearMissName))).toBe(
      false
    )
  })

  it("each run of the packet joins, last, the fixture its name names", () => {
    expect(A.filter(runs, (run) => Str.startsWith(packetFolder)(run.name))).toHaveLength(10)
    expect(misjoined(runs)).toStrictEqual([])
    // Planted: CQ-P07's and model-call.ttl's files swapped, each run reports a fixture the reasoner did not read.
    expect(misjoined(swapped(runs, inPacket("CQ-P07.fixture.ttl"), inPacket("model-call.ttl")))).toStrictEqual([
      inPacket("model-call.ttl"),
      inPacket("CQ-P07.fixture.ttl")
    ])
    // Planted: a run named by a file the packet does not hold leads nowhere.
    expect(
      misjoined(
        withRun(runs, inPacket("CQ-P03.fixture.ttl"), (run) =>
          Run.make({ ...run, name: inPacket("CQ-P33.fixture.ttl") })
        )
      )
    ).toStrictEqual([inPacket("CQ-P33.fixture.ttl")])
  })

  it.effect("every hand-written fixture is held consistent by a run of its own, the thread's by its graph", () =>
    Effect.gen(function* () {
      const base = "https://example.invalid/unused/"
      // The thread's hand-written text is not a file of its own: the thread's graph, the lift beside it, holds it.
      expect(unrun(runs)).toStrictEqual(["CQ-P06.fixture.ttl"])
      const thread = yield* Effect.map(readTurtle(base, threadGraph), linesOf)
      const written = yield* Effect.map(readTurtle(base, threadHandWritten), linesOf)
      expect(written.length).toBeGreaterThan(0)
      expect(A.difference(written, thread)).toStrictEqual([])
      expect(O.exists(A.head(runs), (run) => A.contains(run.files, threadGraph))).toBe(true)
      const without = (name: string) => A.filter(runs, (run) => run.name !== name)
      // Planted: with CQ-P03's run left out, its fixture is reasoned over by no run, and the check names it.
      expect(unrun(without(inPacket("CQ-P03.fixture.ttl")))).toStrictEqual(["CQ-P06.fixture.ttl", "CQ-P03.fixture.ttl"])
      // Planted: CQ-P01's run left out, its text is still a file of the refused run, which must be inconsistent.
      expect(unrun(without(nearMissName))).toStrictEqual(["CQ-P06.fixture.ttl", "CQ-P01.fixture.ttl"])
      // Planted: CQ-P04's run left out, its text is still a file of CQ-P05's run, which holds CQ-P05's consistent.
      expect(unrun(without(inPacket("CQ-P04.fixture.ttl")))).toStrictEqual(["CQ-P06.fixture.ttl", "CQ-P04.fixture.ttl"])
      // Planted: CQ-P01's own run made one that must be inconsistent holds it consistent no more.
      expect(unrun(withRun(runs, nearMissName, (run) => Run.make({ ...run, must: "inconsistent" })))).toStrictEqual([
        "CQ-P06.fixture.ttl",
        "CQ-P01.fixture.ttl"
      ])
    })
  )
})
