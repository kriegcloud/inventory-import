/**
 * What a member may do, and the one comparison of roles the server decides with.
 *
 * @packageDocumentation
 */
import { LiteralKit } from "@beep/schema/LiteralKit"
import { dual } from "effect/Function"
import { $KernelId } from "./internal/identity.ts"

const $I = $KernelId.create("Role")

/**
 * What a member may do, from least to most access: a viewer reads, an editor also writes, an admin also manages
 * people.
 *
 * @category schemas
 */
export const Role = LiteralKit(["viewer", "editor", "admin"]).pipe(
  $I.annoteSchema("Role", {
    description: "What a member may do: a viewer reads, an editor also writes, an admin also manages people.",
    examples: ["editor"]
  })
)

/**
 * One of the three roles.
 *
 * @category models
 */
export type Role = typeof Role.Type

/** The role's place in `Role`'s list: 0 for a viewer, 2 for an admin. */
const rank = (role: Role): number => Role.match(role, { viewer: () => 0, editor: () => 1, admin: () => 2 })

/**
 * True when `role` is at least `minimum`. The server is the only place this decides anything; the browser uses it to
 * hide a button the server would refuse. Works data-first and in a pipe.
 *
 * **Example** (Compare roles)
 *
 * ```ts
 * import { hasRole } from "@inventory/kernel/Role"
 * import { pipe } from "effect/Function"
 *
 * hasRole("editor", "viewer") // true: an editor can do what a viewer can
 * hasRole("viewer", "editor") // false
 * pipe("admin", hasRole("editor")) // true
 * ```
 *
 * @category predicates
 */
export const hasRole: {
  (minimum: Role): (role: Role) => boolean
  (role: Role, minimum: Role): boolean
} = dual(2, (role: Role, minimum: Role): boolean => rank(role) >= rank(minimum))
