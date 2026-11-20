import { describe, expect, it } from "@effect/vitest"
import * as Effect from "effect/Effect"
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

const steady = `import { useRef } from "react"
const intoView = (node: HTMLElement | null) => node?.scrollIntoView()
export function List(props: { lead: boolean; region: { attach: (node: HTMLElement | null) => void } }) {
  const frame = useRef<HTMLDivElement>(null)
  return (
    <section ref={props.region.attach}>
      <div ref={frame} />
      <p ref={intoView} />
      <button ref={props.lead ? props.region.attach : undefined} />
    </section>
  )
}
`

const perDraw = `export function List(props: { rows: ReadonlyArray<string>; measure: (n: number) => (node: HTMLElement | null) => void }) {
  const drawn = (node: HTMLElement | null) => {
    if (node !== null) node.focus()
  }
  function measured(node: HTMLElement | null) {
    node?.scrollIntoView()
  }
  return (
    <section ref={drawn}>
      <div ref={(node) => node?.focus()} />
      <p ref={props.measure(props.rows.length)} />
      <span ref={measured} />
    </section>
  )
}
`

describe("laws ref-callbacks", () => {
  it.effect("passes a DOM ref, a module-level callback, a member and a choice between them and nothing", () =>
    Effect.gen(function* () {
      const report = yield* inTree({ "src/List.tsx": steady }, inRepository)
      expect(printed(report)).toEqual([
        "out: refs:check OK  every ref is a DOM ref or a callback that stays the same across draws"
      ])
    })
  )

  it.effect("refuses a function written in the element, a call, and a function made inside the component", () =>
    Effect.gen(function* () {
      const report = yield* inTree({ "src/List.tsx": perDraw }, inRepository)
      expect(report.failed).toBe(true)
      expect(printed(report).slice(1)).toEqual([
        "err: src/List.tsx:9  drawn is a function made inside the component",
        "err: src/List.tsx:10  ref={(node) => node?.focus()} is a function or a call written in the element",
        "err: src/List.tsx:11  ref={props.measure(props.rows.length)} is a function or a call written in the element",
        "err: src/List.tsx:12  measured is a function made inside the component"
      ])
    })
  )

  it.effect("leaves the vendored kit to itself", () =>
    Effect.gen(function* () {
      const report = yield* inTree({ "packages/ui/src/components/list.tsx": perDraw }, inRepository)
      expect(report.failed).toBe(false)
    })
  )
})
