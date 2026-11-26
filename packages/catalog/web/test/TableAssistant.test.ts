// When an assistant's answer may still change the table. The request outlives the screen that asked, and the table
// it would be applied through writes into the address of whatever the person is on by then: so an answer is applied
// only on the very drawing of the assistant that asked, for the same person in the same organization. The address
// cannot say that: back on the table by the sidebar, or switched to another organization, the path is the same.
import { describe, expect, it } from "@effect/vitest"
import * as O from "effect/Option"
import * as Atom from "effect/reactivity/Atom"
import * as AtomRegistry from "effect/reactivity/AtomRegistry"
import { vi } from "vitest"
import { provideMember } from "@inventory/client/MemberAtoms"
import { MemberId, OrganizationId } from "@inventory/kernel/Ids"
import { Member } from "@inventory/kernel/Member"
import { DisplayName } from "@inventory/kernel/Text"
import { conversationKey, emptyConversation, writeConversation } from "../src/Conversation.machine.ts"
import { keptColumns } from "../src/ItemsPage.screen.tsx"
import {
  askingFrom,
  assistantPresent,
  assistantScreen,
  stillAsked,
  useTableView
} from "../src/TableAssistant.screen.tsx"

// The page's module asks how wide the window is when it is first read: a desk-wide page with no sidebar cookie.
vi.hoisted(() => {
  const kept: Record<string, string> = {}
  Object.assign(globalThis, {
    localStorage: {
      getItem: (key: string) => kept[key] ?? null,
      setItem: (key: string, value: string) => {
        kept[key] = value
      },
      removeItem: (key: string) => {
        delete kept[key]
      }
    },
    document: { cookie: "" },
    window: { innerWidth: 1440, addEventListener: () => undefined, removeEventListener: () => undefined }
  })
})
vi.mock("sonner", () => ({ toast: Object.assign(() => 0, { dismiss: () => undefined, error: () => 0 }) }))

const memberOf = (organization: string) =>
  O.some(
    Member.make({
      id: MemberId.make("mem_dana"),
      name: DisplayName.make("Dana Whitfield"),
      role: "admin",
      organizationId: OrganizationId.make(organization),
      organizationName: DisplayName.make(organization)
    })
  )

const table = "Items"

/** A registry as the app makes it, with what it puts off run when the test says. */
const world = () => {
  const signedIn = Atom.make(memberOf("org_prairie"))
  const tasks: Array<() => void> = []
  const registry = AtomRegistry.make({
    initialValues: [provideMember(signedIn)],
    defaultIdleTTL: 400,
    scheduleTask: (task) => {
      tasks.push(task)
      return () => undefined
    }
  })
  const settle = () => {
    for (const task of tasks.splice(0)) task()
  }
  /** The assistant comes on screen; the function takes it off again. */
  const draw = () => {
    const leave = registry.mount(assistantPresent(table))
    return () => {
      leave()
      settle()
    }
  }
  const applies = (asked: ReturnType<typeof askingFrom>) => stillAsked({ registry, table, asked })
  return { registry, signedIn, draw, applies }
}

describe("an assistant's answer", () => {
  it("is applied on the drawing that asked, while the same person is signed in to the same organization", () => {
    const t = world()
    t.draw()
    const asked = askingFrom(t.registry, table)
    expect(O.isSome(asked.screen)).toBe(true)
    expect(t.applies(asked)).toBe(true)
  })

  it("is not applied once the person has left the table, nor on the table opened again", () => {
    const t = world()
    const leave = t.draw()
    const asked = askingFrom(t.registry, table)
    // To Activity: the assistant is off the screen at once, not after the registry's idle time.
    leave()
    expect(t.registry.get(assistantScreen(table))).toEqual(O.none())
    expect(t.applies(asked)).toBe(false)
    // Back to Items by the sidebar, before the answer: the address is the same, the drawing is another.
    t.draw()
    expect(t.applies(asked)).toBe(false)
    // What is asked from there is applied there.
    expect(t.applies(askingFrom(t.registry, table))).toBe(true)
  })

  it("is not applied after a switch to another organization, though the address has not changed", () => {
    const t = world()
    t.draw()
    const asked = askingFrom(t.registry, table)
    t.registry.set(t.signedIn, memberOf("org_lakeside"))
    expect(t.applies(asked)).toBe(false)
  })

  it("hides and shows columns for the person in the organization it was asked in, and for nobody else", () => {
    const t = world()
    const hidden = { vendors: false }
    writeConversation(conversationKey({ organizationId: "org_prairie", memberId: "mem_dana" }, table), {
      ...emptyConversation,
      visibility: hidden
    })
    // The Items table stays drawn through a switch of organization answered at once.
    t.registry.mount(keptColumns)
    expect(t.registry.get(keptColumns)).toEqual(O.some(hidden))
    t.registry.set(t.signedIn, memberOf("org_lakeside"))
    expect(t.registry.get(keptColumns)).toEqual(O.some({}))
  })

  it("is not applied when it was asked with no assistant drawn", () => {
    const t = world()
    expect(t.applies(askingFrom(t.registry, table))).toBe(false)
  })
})

describe("the assistant's table state boundary", () => {
  it("keeps configured filters and leaves malformed values out of its snapshot without changing the table", () => {
    const valid = {
      id: "category",
      value: ["components"],
      variant: "select" as const,
      operator: "inArray" as const,
      filterId: "category-0"
    }
    const held: ReadonlyArray<unknown> = [valid, { ...valid, value: 42 }]
    const view = useTableView(
      {
        atoms: {
          sorting: { get: () => [] },
          columnFilters: { get: () => held },
          columnVisibility: { get: () => ({}) }
        },
        setSorting: () => undefined,
        setColumnFilters: () => undefined,
        setColumnVisibility: () => undefined,
        setGlobalFilter: () => undefined
      },
      false
    )
    expect(view.read().filters).toEqual([valid])
    expect(held).toHaveLength(2)
  })
})
