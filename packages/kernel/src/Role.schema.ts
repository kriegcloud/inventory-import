/**
 * What a member may do, and the one comparison of roles the server decides with. A union of three scalars, so a
 * plain `S.Literals` (rule SF-6 asks for a `LiteralKit` only where a set names the cases of a tagged union).
 *
 * @packageDocumentation
 */
import { dual } from "effect/Function"
import * as S from "effect/Schema"
import { $KernelId } from "./internal/identity.ts"

const $I = $KernelId.create("Role")

/**
 * What a member may do, from least to most access: a viewer reads, an editor also writes, an admin also manages
 * people.
 *
 * @category schemas
 */
export const Role = S.Literals(["viewer", "editor", "admin"]).pipe(
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
const rank = (role: Role): number => {
  switch (role) {
    case "viewer":
      return 0
    case "editor":
      return 1
    case "admin":
      return 2
  }
}

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
