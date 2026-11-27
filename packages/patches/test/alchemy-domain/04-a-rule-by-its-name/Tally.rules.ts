// The rules of a tally, each in a file of its own and named: the aggregates beside this one list them by name.
/** A tally: how many were counted. */
type Counted = { readonly count: number }
/** One step of a tally: the states around a command. */
type Step = { readonly before: Counted; readonly after: Counted }

/** A count is never below zero. */
export const ACountIsNeverNegative = (tally: Counted): boolean => tally.count >= 0

/** A count never falls. */
export const ACountNeverFalls: (step: Step) => boolean = ({ before, after }) => after.count >= before.count

/** A count never falls by more than one: less than `ACountNeverFalls` says. */
export const ACountFallsByOneAtMost: (step: Step) => boolean = ({ before, after }) => after.count >= before.count - 1

/** A count is never below minus one: less than `ACountIsNeverNegative` says. */
export const ACountIsNeverBelowMinusOne = (tally: Counted): boolean => tally.count >= -1
