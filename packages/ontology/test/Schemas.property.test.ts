// Every named schema of the ontology package generates only values it accepts (schema-first rule SF-7): the graph's
// nodes, what a Turtle text states, the gates' findings, the enrolment list and the reasoner's pin, runs and results.
import { describe, expect, it } from "@effect/vitest"
import * as Arbitrary from "effect/Arbitrary"
import * as R from "effect/Record"
import * as S from "effect/Schema"
import { ConstructFinding, ConstructRule, Difference, FileKind, Reparse } from "../src/Constructs.rules.ts"
import { Iri, IriNode, LiteralNode, ObjectNode, TextNode, Triple } from "../src/Graph.schema.ts"
import {
  CollectionEntry,
  Enrolment,
  EnrolmentEntry,
  Placement,
  PointerFinding,
  PointerRule,
  RecordEntry,
  SchemeEntry
} from "../src/Pointers.rules.ts"
import { JarFound, JavaFound, RobotLock, RobotResult, Run, Verdict } from "../src/Reason.ts"
import { BlankNode, ParsedNode, ParsedTriple } from "../src/Turtle.ts"

const runs = { arbitrary: { runs: 30 } }
const schemas = {
  Iri,
  IriNode,
  LiteralNode,
  TextNode,
  ObjectNode,
  Triple,
  BlankNode,
  ParsedNode,
  ParsedTriple,
  FileKind,
  Difference,
  Reparse,
  ConstructRule,
  ConstructFinding,
  RecordEntry,
  SchemeEntry,
  CollectionEntry,
  EnrolmentEntry,
  Enrolment,
  PointerRule,
  PointerFinding,
  Placement,
  RobotLock,
  JavaFound,
  JarFound,
  RobotResult,
  Verdict,
  Run
}

describe("every schema of the ontology package generates only valid values", () => {
  for (const [name, schema] of R.toEntries(schemas)) {
    it.prop(
      name,
      [Arbitrary.schema(schema)],
      ([value]) => {
        expect(S.is(schema)(value)).toBe(true)
      },
      runs
    )
  }
})
