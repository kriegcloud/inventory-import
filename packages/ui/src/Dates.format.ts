import * as DateTime from "effect/DateTime"
import * as O from "effect/Option"
// Dates as the person reads them. A module of its own, with nothing else in it, so a screen that shows one date (the
// upload screen's "Continue" card) does not load the table code that the other formatting helpers bring in.

const dateTime = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" })

/** A moment from the server (an instant, or its ISO text) as the person's own date and time. */
export const when = (at: string | DateTime.Utc): string => {
  const parsed = DateTime.make(at)
  const date = O.isSome(parsed) ? DateTime.toDateUtc(parsed.value) : undefined
  return date === undefined ? String(at) : dateTime.format(date)
}

const dayTime = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit"
})

/** A date and time for a table column: the year is left out while it is this year ("Nov 14, 5:28 AM"). */
export const whenShort = (at: string | DateTime.Utc): string => {
  const parsed = DateTime.make(at)
  const date = O.isSome(parsed) ? DateTime.toDateUtc(parsed.value) : undefined
  if (date === undefined) return String(at)
  return (date.getFullYear() === DateTime.toDateUtc(DateTime.nowUnsafe()).getFullYear() ? dayTime : dateTime).format(
    date
  )
}

const dayOnly = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" })
const dayAndYear = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" })

/** A moment as the person's own date, for a column too narrow for the time. The year shows once it is not this one. */
export const day = (at: string | DateTime.Utc): string => {
  const parsed = DateTime.make(at)
  const date = O.isSome(parsed) ? DateTime.toDateUtc(parsed.value) : undefined
  if (date === undefined) return String(at)
  return (date.getFullYear() === DateTime.toDateUtc(DateTime.nowUnsafe()).getFullYear() ? dayOnly : dayAndYear).format(
    date
  )
}
