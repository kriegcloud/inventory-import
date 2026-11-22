import { describe, expect, it } from "@effect/vitest"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as Str from "effect/String"
import { refCallbacks, refCallbacksSentence } from "../src/commands/Laws/RefCallbacks.rules.ts"
import { Repo } from "../src/Repo.service.ts"
import { render } from "../src/Report.schema.ts"
import { inTree, json, printed } from "./support/tree.ts"

// git answers "every file git would commit", so the folder is made a repository first.
const inRepository = Effect.gen(function* () {
  const repo = yield* Repo
  yield* repo.run("git", ["init", "-q"])
  const found = yield* refCallbacks()
  return render(refCallbacksSentence)(found)
})

/** The places a report refuses, each as "file:line  the first words of why". */
const refusals = (report: { readonly lines: ReadonlyArray<{ readonly to: string; readonly text: string }> }) =>
  A.map(A.drop(printed(report), 1), (line) => A.join(A.take(Str.split(" ")(line), 6), " "))

const steady = `import { useAtomSubscribe, useAtomValue } from "@effect/atom-react"
import { useRef } from "react"
import { scope, steps } from "./atoms"
const intoView = (node: HTMLElement | null) => node?.scrollIntoView()
function measured(node: HTMLElement | null) {
  node?.focus()
}
const page = { attach: (node: HTMLElement | null) => node?.focus() }
export function List(props: { region: { attach: (node: HTMLElement | null) => void } }) {
  const frame = useRef<HTMLDivElement>(null)
  const held = useAtomValue(scope)
  const { attach } = held
  const again = held.attach
  useAtomSubscribe(steps, held.settle)
  useAtomSubscribe(steps, intoView)
  return (
    <section ref={props.region.attach}>
      <div ref={frame} />
      <p ref={intoView} />
      <p ref={measured} />
      <p ref={page.attach} />
      <p ref={held.attach} />
      <p ref={attach} />
      <p ref={again} />
      <p ref={frame as never} />
      <p ref={undefined} />
    </section>
  )
}
`

// One line per form a callback can be made on each draw in.
const perDraw = `import { useAtomSubscribe } from "@effect/atom-react"
import { makeRef, makeRefs, steps } from "./atoms"
export function List(props: { rows: ReadonlyArray<string>; lead: boolean; attach: (node: HTMLElement | null) => void }) {
  const plain = (node: HTMLElement | null) => node?.focus()
  const typed: React.RefCallback<HTMLElement> = (node) => {
    node?.focus()
  }
  const generic = <T extends HTMLElement>(node: T | null) => node?.focus()
  const broken =
    (node: HTMLElement | null) => node?.focus()
  function declared(node: HTMLElement | null) {
    node?.scrollIntoView()
  }
  var old = function (node: HTMLElement | null) {
    node?.focus()
  }
  const returned = makeRef(props.rows)
  const refs = { drawn: (node: HTMLElement | null) => node?.focus() }
  const { taken } = makeRefs()
  const renamed = plain
  useAtomSubscribe(steps, (step) => step)
  useAtomSubscribe(steps, plain)
  return (
    <section>
      <p ref={plain} />
      <p ref={typed} />
      <p ref={generic} />
      <p ref={broken} />
      <p ref={declared} />
      <p ref={old} />
      <p ref={returned} />
      <p ref={refs.drawn} />
      <p ref={taken} />
      <p ref={renamed} />
      <p ref={(node) => node?.focus()} />
      <p ref={function (node) { node?.focus() }} />
      <p ref={makeRef(props.rows)} />
      <p ref={props.attach.bind(null)} />
      <p ref={props.lead ? props.attach : undefined} />
      <p ref={props.lead && props.attach} />
      <p
        ref={
          plain
        }
      />
    </section>
  )
}
`

// A ref handed down: the row gives its \`measure\` prop to a ref, under its own name and taken out of the props; the
// list hands the row a function made on each draw, and the page hands the list's own prop on.
const row = `export function Row(props: { measure: (node: HTMLElement | null) => void }) {
  return <tr ref={props.measure} />
}
export function Cell({ focus }: { focus: (node: HTMLElement | null) => void }) {
  return <td ref={focus} />
}
`
const list = `import { Cell, Row } from "./Row"
import { steadyMeasure } from "./atoms"
export function List(props: { onRow: (node: HTMLElement | null) => void }) {
  const measure = (node: HTMLElement | null) => node?.focus()
  return (
    <table>
      <Row measure={measure} />
      <Row measure={(node) => node?.focus()} />
      <Row measure={steadyMeasure} />
      <Row measure={props.onRow} />
      <Cell focus={measure} />
    </table>
  )
}
`
const page = `import { List } from "./List"
const steadyRow = (node: HTMLElement | null) => node?.focus()
export function Page() {
  const onRow = (node: HTMLElement | null) => node?.focus()
  return (
    <main>
      <List onRow={onRow} />
      <List onRow={steadyRow} />
    </main>
  )
}
`

// The forms that once passed for steady, one each: a parameter's member two steps down (judged as the caller's prop,
// which its caller makes in the draw), an element of a list of functions made in the draw, a row object's function
// made in the draw, a module \`let\` the component sets again, a helper named as a hook that is not one, and a
// subscription through a namespace import.
const hidden = `import * as AtomReact from "@effect/atom-react"
import { steps } from "./atoms"
let current = (node: HTMLElement | null) => node?.focus()
function useNodeRef() {
  return (node: HTMLElement | null) => node?.focus()
}
export function Nested(props: { on: { measure: (node: HTMLElement | null) => void } }) {
  return <p ref={props.on.measure} />
}
export function List(props: { items: ReadonlyArray<string> }) {
  const fns = props.items.map(() => (node: HTMLElement | null) => node?.focus())
  const rows = props.items.map((item) => ({ item, measure: (node: HTMLElement | null) => node?.focus() }))
  current = (node: HTMLElement | null) => node?.scrollIntoView()
  AtomReact.useAtomSubscribe(steps, (step) => step)
  return (
    <section>
      <Nested on={{ measure: (node) => node?.focus() }} />
      <ul>{fns.map((fn) => <li ref={fn} />)}</ul>
      <ul>{rows.map((row) => <li ref={row.measure} />)}</ul>
      <p ref={current} />
      <p ref={useNodeRef()} />
    </section>
  )
}
`

// What still passes in those shapes: a list a hook holds, a module \`let\` nothing sets again, a hook through a
// namespace import, and a steady prop handed down two steps.
const heldLists = `import * as AtomReact from "@effect/atom-react"
import { rowsAtom, steps } from "./atoms"
let kept = (node: HTMLElement | null) => node?.focus()
const handlers = { measure: kept }
function Nested(props: { on: { measure: (node: HTMLElement | null) => void } }) {
  return <p ref={props.on.measure} />
}
export function List() {
  const rows = AtomReact.useAtomValue(rowsAtom)
  AtomReact.useAtomSubscribe(steps, kept)
  return (
    <section>
      <Nested on={handlers} />
      <ul>{rows.map((row) => <li ref={row.measure} />)}</ul>
      <p ref={kept} />
    </section>
  )
}
`

// The forms the second review found passing, one each: a module record a function fills in place (a cache by hand),
// a function kept in a useRef and handed over as \`.current\` (taken out by a pattern too), a \`use…\` name from a
// module that only sits in a \`components\` or \`hooks\` folder, and a value followed past the depth limit.
const deeper = A.join(
  A.makeBy(11, (at) => `  const d${at + 1} = d${at}`),
  "\n"
)
const cached = `import { useRef } from "react"
import { useStable } from "./components/stable"
import { useHeld } from "../hooks/held"
const refs: Record<string, (node: HTMLElement | null) => void> = {}
export function List(props: { id: string }) {
  refs[props.id] ??= (node) => node?.focus()
  const holder = useRef((node: HTMLElement | null) => node?.focus())
  const { current } = useRef((node: HTMLElement | null) => node?.focus())
  const d0 = useHeld()
${deeper}
  return (
    <section>
      <p ref={refs[props.id]} />
      <p ref={holder.current} />
      <p ref={current} />
      <p ref={useStable((node: HTMLElement | null) => node?.focus())} />
      <p ref={d11} />
    </section>
  )
}
`

// What still passes in those shapes: a module record nothing fills, a DOM ref from useRef, a hook of the vendored kit
// imported by the exact path its package exports, and a file of hooks named \`*.hook.ts\` imported by its path.
const exactHooks = `import { useRef } from "react"
import { useDataTable } from "@x/ui/hooks/use-data-table"
import { useKept } from "@x/review/KeptHook"
import { useSaved } from "./Saved.hook.ts"
const refs: Record<string, (node: HTMLElement | null) => void> = { lead: (node) => node?.focus() }
export function List() {
  const frame = useRef<HTMLDivElement>(null)
  const table = useDataTable()
  const kept = useKept()
  const saved = useSaved()
  return (
    <section ref={frame}>
      <p ref={refs.lead} />
      <p ref={table.measure} />
      <p ref={kept.attach} />
      <p ref={saved.attach} />
    </section>
  )
}
`

// A module record filled in place by other means the third review found passing: through `Object.assign`, through
// another name a component gives it, and read through another name the module gives it.
const aliased = `const refs: Record<string, (node: HTMLElement | null) => void> = {}
const kept: Record<string, (node: HTMLElement | null) => void> = {}
const shared = kept
export function List(props: { id: string }) {
  Object.assign(refs, { [props.id]: (node: HTMLElement | null) => node?.focus() })
  const r = kept
  r[props.id] ??= (node) => node?.focus()
  return (
    <section>
      <p ref={refs[props.id]} />
      <p ref={kept[props.id]} />
      <p ref={shared[props.id]} />
    </section>
  )
}
`

// What still passes beside them: a record copied into a new object, and a record read through another name.
const aliasedSteady = `const refs: Record<string, (node: HTMLElement | null) => void> = { lead: (node) => node?.focus() }
export function List() {
  const r = refs
  const copy = Object.assign({}, refs)
  return (
    <section>
      <p ref={r.lead} />
      <p ref={refs.lead} />
      <p title={String(copy.lead === undefined)} />
    </section>
  )
}
`

// Two names for two parts of one module record are not one record: a write into one part leaves the other's refs
// steady. A part written into is refused, and so is the part of the record it is, read from the record.
const parts = `type Fn = (node: HTMLElement | null) => void
const big: { a: Record<string, Fn>; b: Record<string, Fn> } = { a: {}, b: { lead: (node) => node?.focus() } }
const a = big.a
const b = big.b
export function List(props: { id: string }) {
  a[props.id] ??= (node) => node?.focus()
  return (
    <section>
      <p ref={b.lead} />
      <p ref={big.b.lead} />
      <p ref={a[props.id]} />
      <p ref={big.a[props.id]} />
    </section>
  )
}
`

// A module record filled in place by the forms the fourth review found passing: \`Object.assign\` taken out of
// \`Object\` by name or read by its key, a record assigned to a name declared with another value, and a record
// given through \`??\`.
const filledOtherwise = `type Fn = (node: HTMLElement | null) => void
const one: Record<string, Fn> = {}
const two: Record<string, Fn> = {}
const three: Record<string, Fn> = {}
const four: Record<string, Fn> = {}
const { assign } = Object
export function List(props: { id: string }) {
  assign(one, { [props.id]: (node: HTMLElement | null) => node?.focus() })
  Object["assign"](two, { [props.id]: (node: HTMLElement | null) => node?.focus() })
  let r: Record<string, Fn> = {}
  r = three
  r[props.id] ??= (node) => node?.focus()
  const s = four ?? {}
  s[props.id] ??= (node) => node?.focus()
  return (
    <section>
      <p ref={one[props.id]} />
      <p ref={two[props.id]} />
      <p ref={three[props.id]} />
      <p ref={four[props.id]} />
    </section>
  )
}
`

/** The workspaces whose exports name modules of hooks: the vendored kit's `src/hooks`, and a `*.hook.ts` file. */
const hookPackages = {
  "packages/ui/package.json": json({
    name: "@x/ui",
    exports: { "./hooks/use-data-table": "./src/hooks/use-data-table.ts", "./Table": "./src/Table.tsx" }
  }),
  "packages/review/package.json": json({ name: "@x/review", exports: { "./KeptHook": "./src/Kept.hook.ts" } })
}

// A module variable filled lazily, read back in every function that fills it, by two names that follow each other:
// following such names once per assignment at every step grew without bound (24 s, then out of memory, at six).
const lazy = `let current: ((node: HTMLElement | null) => void) | undefined
let previous: ((node: HTMLElement | null) => void) | undefined
const make = () => (node: HTMLElement | null) => node?.focus()
${A.join(
  A.makeBy(
    8,
    (n) => `export function F${n}() {
  previous = current
  current = current ?? previous ?? make()
  return <p ref={current} />
}`
  ),
  "\n"
)}
`

describe("laws ref-callbacks", () => {
  it.effect("refuses a module record filled in place, a useRef's .current, a use* only by folder, past the depth", () =>
    Effect.gen(function* () {
      const report = yield* inTree({ "src/List.tsx": cached }, inRepository)
      expect(report.failed).toBe(true)
      expect(refusals(report)).toEqual([
        "err: src/List.tsx:23  ref: refs is",
        "err: src/List.tsx:24  ref: holder reads",
        "err: src/List.tsx:25  ref: current reads",
        "err: src/List.tsx:26  ref: useStable is",
        "err: src/List.tsx:27  ref: followed more"
      ])
    })
  )

  it.effect("refuses a module record filled by Object.assign or through another name, and read through one", () =>
    Effect.gen(function* () {
      const report = yield* inTree({ "src/List.tsx": aliased }, inRepository)
      expect(report.failed).toBe(true)
      expect(refusals(report)).toEqual([
        "err: src/List.tsx:10  ref: refs is",
        "err: src/List.tsx:11  ref: kept is",
        "err: src/List.tsx:12  ref: shared is"
      ])
    })
  )

  it.effect("refuses only the part of a module record a function writes into, never a part beside it", () =>
    Effect.gen(function* () {
      const report = yield* inTree({ "src/List.tsx": parts }, inRepository)
      expect(report.failed).toBe(true)
      expect(refusals(report)).toEqual(["err: src/List.tsx:11  ref: a is", "err: src/List.tsx:12  ref: big is"])
    })
  )

  it.effect("refuses a record filled by Object.assign by another name or key, an assigned name, and a ?? default", () =>
    Effect.gen(function* () {
      const report = yield* inTree({ "src/List.tsx": filledOtherwise }, inRepository)
      expect(report.failed).toBe(true)
      expect(refusals(report)).toEqual([
        "err: src/List.tsx:17  ref: one is",
        "err: src/List.tsx:18  ref: two is",
        "err: src/List.tsx:19  ref: three is",
        "err: src/List.tsx:20  ref: four is"
      ])
    })
  )

  it.effect("passes a record copied into a new object and a record read through another name", () =>
    Effect.gen(function* () {
      const report = yield* inTree({ "src/List.tsx": aliasedSteady }, inRepository)
      expect(printed(report)).toEqual([
        "out: refs:check OK  every ref is a DOM ref or a callback that stays the same across draws"
      ])
    })
  )

  it.effect("passes a record nothing fills, a DOM ref, and hooks from the exact modules a package names", () =>
    Effect.gen(function* () {
      const report = yield* inTree({ ...hookPackages, "src/List.tsx": exactHooks }, inRepository)
      expect(printed(report)).toEqual([
        "out: refs:check OK  every ref is a DOM ref or a callback that stays the same across draws"
      ])
    })
  )

  it.effect("refuses each form that once passed: deep props, mapped lists, a module let set again, a false hook", () =>
    Effect.gen(function* () {
      const report = yield* inTree({ "src/List.tsx": hidden }, inRepository)
      expect(report.failed).toBe(true)
      expect(refusals(report)).toEqual([
        "err: src/List.tsx:14  useAtomSubscribe: a function",
        "err: src/List.tsx:18  ref: fn is",
        "err: src/List.tsx:19  ref: row is",
        "err: src/List.tsx:20  ref: current is",
        "err: src/List.tsx:21  ref: useNodeRef is",
        "err: src/List.tsx:17  on is handed"
      ])
    })
  )

  it.effect("passes the same shapes when the list, the variable and the prop are steady", () =>
    Effect.gen(function* () {
      const report = yield* inTree({ "src/List.tsx": heldLists }, inRepository)
      expect(printed(report)).toEqual([
        "out: refs:check OK  every ref is a DOM ref or a callback that stays the same across draws"
      ])
    })
  )

  it.effect("passes a DOM ref, a module-level callback, what a hook holds, and a member of each", () =>
    Effect.gen(function* () {
      const report = yield* inTree({ "src/List.tsx": steady }, inRepository)
      expect(printed(report)).toEqual([
        "out: refs:check OK  every ref is a DOM ref or a callback that stays the same across draws"
      ])
    })
  )

  it.effect("refuses every form a callback is made on each draw in, by where the file binds the name", () =>
    Effect.gen(function* () {
      const report = yield* inTree({ "src/List.tsx": perDraw }, inRepository)
      expect(report.failed).toBe(true)
      expect(refusals(report)).toEqual([
        "err: src/List.tsx:21  useAtomSubscribe: a function",
        "err: src/List.tsx:22  useAtomSubscribe: plain is",
        "err: src/List.tsx:25  ref: plain is",
        "err: src/List.tsx:26  ref: typed is",
        "err: src/List.tsx:27  ref: generic is",
        "err: src/List.tsx:28  ref: broken is",
        "err: src/List.tsx:29  ref: declared is",
        "err: src/List.tsx:30  ref: old is",
        "err: src/List.tsx:31  ref: returned is",
        "err: src/List.tsx:32  ref: refs is",
        "err: src/List.tsx:33  ref: taken is",
        "err: src/List.tsx:34  ref: plain is",
        "err: src/List.tsx:35  ref: a function",
        "err: src/List.tsx:36  ref: a function",
        "err: src/List.tsx:37  ref: a call",
        "err: src/List.tsx:38  ref: a call",
        "err: src/List.tsx:39  ref: a ref",
        "err: src/List.tsx:40  ref: a ref",
        "err: src/List.tsx:42  ref: plain is"
      ])
    })
  )

  it.effect("follows a ref handed down as a prop to every place that hands it, through a prop handed on", () =>
    Effect.gen(function* () {
      const report = yield* inTree({ "src/Row.tsx": row, "src/List.tsx": list, "src/Page.tsx": page }, inRepository)
      expect(report.failed).toBe(true)
      expect(refusals(report)).toEqual([
        "err: src/List.tsx:7  measure is handed",
        "err: src/List.tsx:8  measure is handed",
        "err: src/List.tsx:11  focus is handed",
        "err: src/Page.tsx:7  onRow is handed"
      ])
    })
  )

  it.effect("fails when git cannot list the screens, instead of reading that as none", () =>
    Effect.gen(function* () {
      // Not made a repository: git answers with an error, not with an empty list.
      const report = yield* inTree(
        { "src/List.tsx": perDraw },
        Effect.map(refCallbacks(), render(refCallbacksSentence))
      )
      expect(report.failed).toBe(true)
      expect(printed(report)[1]).toContain("git could not list the screens")
    })
  )

  it.effect("follows a module variable read back in the functions that fill it in bounded time", () =>
    Effect.gen(function* () {
      const started = yield* Effect.clockWith((clock) => clock.currentTimeMillis)
      const report = yield* inTree({ "src/Lazy.tsx": lazy }, inRepository)
      const ended = yield* Effect.clockWith((clock) => clock.currentTimeMillis)
      // Refused (a module variable set again), and in well under a second.
      expect([report.failed, ended - started < 2000]).toEqual([true, true])
    })
  )

  it.effect("leaves the vendored kit to itself", () =>
    Effect.gen(function* () {
      const report = yield* inTree({ "packages/ui/src/components/list.tsx": perDraw }, inRepository)
      expect(report.failed).toBe(false)
    })
  )
})
