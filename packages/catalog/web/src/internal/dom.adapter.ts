import * as O from "effect/Option"

/** The shell's DOM slot is null until its element is mounted and after it is removed. */
export const Dom = { portalTarget: (target: HTMLElement | null): O.Option<HTMLElement> => O.fromNullOr(target) }
