// A match and a save that fall into each other, on the real handlers and SQL, a fresh D1. Benjamin's answer "Server
// refuses, screen says so" holds only if nothing can land between a match's parts, or between a save's check of the
// choices and its write. A stand-in around the real store runs the other person's write once, at the moment the
// handler has read the import and the store is about to write: the one place another request can fall.
import { expect, layer } from "@effect/vitest"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as MutableRef from "effect/MutableRef"
import * as O from "effect/Option"
import * as R from "effect/Record"
import * as Str from "effect/String"
import * as HttpApiTest from "effect/http-api/HttpApiTest"
import { decisionFromFlags } from "@inventory/catalog-contract/Decision"
import { ImportStore } from "@inventory/catalog-model/ImportStore"
import { MemberId, OrganizationId } from "@inventory/kernel/Ids"
import { Member } from "@inventory/kernel/Member"
import messy from "../../public/samples/items_messy.csv?raw"
import { Api } from "../../src/api/v1/Api.ts"
import { as, testAppAround } from "./support/app.ts"
import { stage } from "./support/files.ts"
import { upload } from "./support/upload.ts"

type Step = "matchColumn" | "decide"
type Between = { readonly before: Step; readonly run: (store: ImportStore["Service"]) => Effect.Effect<unknown> }

/** What runs once, just before the store's next write of that kind. */
const between = MutableRef.make(O.none<Between>())
const putBetween = (before: Step, run: Between["run"]) =>
  Effect.sync(() => MutableRef.set(between, O.some({ before, run })))

const Around = Layer.effect(
  ImportStore,
  Effect.gen(function* () {
    const inner = yield* ImportStore
    const first = (step: Step) =>
      Effect.suspend(() =>
        O.match(
          O.filter(MutableRef.get(between), (waiting) => waiting.before === step),
          {
            onNone: () => Effect.void,
            onSome: (waiting) => {
              MutableRef.set(between, O.none())
              return Effect.asVoid(waiting.run(inner))
            }
          }
        )
      )
    return ImportStore.of({
      ...inner,
      matchColumn: Effect.fn("Around.matchColumn")(function* (
        ...args: Parameters<ImportStore["Service"]["matchColumn"]>
      ) {
        yield* first("matchColumn")
        return yield* inner.matchColumn(...args)
      }),
      decide: Effect.fn("Around.decide")(function* (...args: Parameters<ImportStore["Service"]["decide"]>) {
        yield* first("decide")
        return yield* inner.decide(...args)
      })
    })
  })
)

const App = testAppAround(Around)

const prairie = OrganizationId.make("org_prairie")
const person = (id: string, name: string, role: "admin" | "editor") =>
  Member.make({
    id: MemberId.make(id),
    name,
    role,
    organizationId: prairie,
    organizationName: "Example Works (test)"
  })
const marcusAsMember = person("mem_marcus", "Marcus Oyelaran", "editor")
const danaAsMember = person("mem_dana", "Dana Whitfield", "admin")

/** The messy sample staged by Marcus, and the file's unit cost column. */
const staged = Effect.gen(function* () {
  const client = yield* HttpApiTest.groups(Api, ["imports", "items"])
  const view = yield* upload({ client, table: yield* stage(new File([messy], "items_messy.csv")) }).pipe(
    as("mem_marcus")
  )
  const table = yield* client.imports.table({ params: { id: view.id } }).pipe(as("mem_dana"))
  const cost = O.getOrThrow(A.findFirst(table.columns, (column) => Str.includes("cost")(Str.toLowerCase(column.label))))
  return { client, view, params: { id: view.id }, cost }
})

layer(App)("a match and a save that fall into each other", (it) => {
  it.effect(
    "a save between the match's read and its write: the match is stamped with the revision it writes, so an accept made on the save's revision is not applied",
    () =>
      Effect.gen(function* () {
        const { client, view, params, cost } = yield* staged
        // Marcus leaves row 3 out at the moment Dana's match has read the import and is about to write.
        yield* putBetween("matchColumn", (store) =>
          Effect.flatMap(store.find(prairie, view.id), (draft) =>
            store.decide(marcusAsMember, O.getOrThrow(draft), {
              set: { "row-3": decisionFromFlags({ out: true }) },
              clear: []
            })
          )
        )
        const matched = yield* client.imports
          .match({ params, payload: { field: "unitCost", column: O.some(cost.index) } })
          .pipe(as("mem_dana"))
        // Two revisions on: Marcus's save, then the match; the choice names the match's own.
        expect(matched.revision).toBe(view.revision + 2)
        expect(
          O.map(
            A.findFirst(matched.choices, (choice) => choice.field === "unitCost"),
            (choice) => choice.at
          )
        ).toEqual(O.some(view.revision + 2))
        // Marcus's screen took his own save's picture and never saw the match: he accepts row 55's cost on it.
        const saved = yield* client.imports
          .decide({
            params,
            payload: {
              madeOn: { "row-55": view.revision + 1 },
              set: { "row-55": decisionFromFlags({ accepted: ["unitCost"] }) },
              clear: []
            }
          })
          .pipe(as("mem_marcus"))
        expect(saved.notApplied).toEqual([{ rowId: "row-55", field: "unitCost", kind: "accept" }])
        const after = yield* client.imports.get({ params }).pipe(as("mem_marcus"))
        expect([R.get(after.decisions, "row-55"), R.get(after.decisions, "row-3")]).toEqual([
          O.some(decisionFromFlags({})),
          O.some(decisionFromFlags({ out: true }))
        ])
      })
  )

  it.effect(
    "a match between a save's check and its write: the save is checked again, and its accept is named and not applied",
    () =>
      Effect.gen(function* () {
        const { client, view, params, cost } = yield* staged
        // Dana's match lands once Marcus's save has been checked against the choices and is about to be written.
        yield* putBetween("decide", (store) =>
          Effect.flatMap(store.find(prairie, view.id), (draft) =>
            store.matchColumn(danaAsMember, O.getOrThrow(draft), { field: "unitCost", column: cost.index }, "unit cost")
          )
        )
        const saved = yield* client.imports
          .decide({
            params,
            payload: {
              madeOn: { "row-55": view.revision },
              set: { "row-55": decisionFromFlags({ accepted: ["unitCost"] }) },
              clear: []
            }
          })
          .pipe(as("mem_marcus"))
        expect(saved.notApplied).toEqual([{ rowId: "row-55", field: "unitCost", kind: "accept" }])
        const after = yield* client.imports.get({ params }).pipe(as("mem_marcus"))
        expect(R.get(after.decisions, "row-55")).toEqual(O.some(decisionFromFlags({})))
        expect(after.revision).toBe(saved.revision)
      })
  )

  it.effect(
    "a save just before a match's write: the match takes the accept out of the row as that save left it, and keeps the rest",
    () =>
      Effect.gen(function* () {
        const { client, view, params, cost } = yield* staged
        // Dana had accepted row 55's cost on the staged picture.
        yield* client.imports
          .decide({
            params,
            payload: {
              madeOn: { "row-55": view.revision },
              set: { "row-55": decisionFromFlags({ accepted: ["unitCost"] }) },
              clear: []
            }
          })
          .pipe(as("mem_dana"))
        // Marcus also leaves row 55 out, at the moment Dana's match is about to write.
        yield* putBetween("matchColumn", (store) =>
          Effect.flatMap(store.find(prairie, view.id), (draft) =>
            store.decide(marcusAsMember, O.getOrThrow(draft), {
              set: { "row-55": decisionFromFlags({ out: true, accepted: ["unitCost"] }) },
              clear: []
            })
          )
        )
        yield* client.imports
          .match({ params, payload: { field: "unitCost", column: O.some(cost.index) } })
          .pipe(as("mem_dana"))
        // His leave-out stands; only the accept of the column matched again is gone.
        const after = yield* client.imports.get({ params }).pipe(as("mem_marcus"))
        expect(R.get(after.decisions, "row-55")).toEqual(O.some(decisionFromFlags({ out: true })))
      })
  )
})
