import { describe, expect, it } from "@effect/vitest"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as Str from "effect/String"
import { refCallbacks, refCallbacksSentence } from "../src/commands/Laws/RefCallbacks.rules.ts"
import { Repo } from "../src/Repo.service.ts"
import { render } from "../src/Report.schema.ts"
import { inTree, printed } from "./support/tree.ts"

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

describe("laws ref-callbacks", () => {
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

  it.effect("leaves the vendored kit to itself", () =>
    Effect.gen(function* () {
      const report = yield* inTree({ "packages/ui/src/components/list.tsx": perDraw }, inRepository)
      expect(report.failed).toBe(false)
    })
  )
})
