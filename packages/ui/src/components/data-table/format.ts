// Local change: `Option`, for the `try` statement upstream has here.
import * as O from "effect/Option"

export function formatDate(date: Date | string | number | undefined, opts: Intl.DateTimeFormatOptions = {}) {
  if (!date) return ""

  // Local change: `Option.liftThrowable` where upstream has a `try` statement (none in this repository); a date that
  // cannot be written (an invalid one) is "".
  return O.getOrElse(
    O.liftThrowable(() =>
      new Intl.DateTimeFormat("en-US", {
        month: opts.month ?? "long",
        day: opts.day ?? "numeric",
        year: opts.year ?? "numeric",
        ...opts
      }).format(new Date(date))
    )(),
    () => ""
  )
}
