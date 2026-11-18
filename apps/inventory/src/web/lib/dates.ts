// Dates as the person reads them. A module of its own, with nothing else in it, so a screen that shows one date (the
// upload screen's "Continue" card) does not load the table code that the other formatting helpers bring in.

const dateTime = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" })

/** An ISO timestamp from the server as the person's own date and time. */
export const when = (iso: string): string => {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? iso : dateTime.format(date)
}

const dayTime = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit"
})

/** A date and time for a table column: the year is left out while it is this year ("Nov 14, 5:28 AM"). */
export const whenShort = (iso: string): string => {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return (date.getFullYear() === new Date().getFullYear() ? dayTime : dateTime).format(date)
}

const dayOnly = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" })
const dayAndYear = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" })

/** An ISO timestamp as the person's own date, for a column too narrow for the time. The year shows once it is not this one. */
export const day = (iso: string): string => {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return (date.getFullYear() === new Date().getFullYear() ? dayOnly : dayAndYear).format(date)
}
