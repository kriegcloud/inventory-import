// What the screen says of where the person's waiting decisions are: kept in this browser, or held by this page only
// because the browser refused to keep them (`waitingNotKept`). The one thing not to break: a decision the browser did
// not keep is never said to be kept, and the person is told what that costs them (closing or loading the page again
// before it is sent loses it).

/** The line above the review while decisions wait after a save that failed; `one` for a single decision. */
export const notSavedLine = (input: { readonly one: boolean; readonly kept: boolean }): string => {
  const { one, kept } = input
  const it = one ? "it" : "them"
  const is = one ? "It is" : "They are"
  const where = `Where someone decided ${one ? "that row" : "one of those rows"} otherwise meanwhile, you are asked which stands.`
  return kept
    ? `The server did not take ${it}. ${is} kept in this browser and sent with your next decision, or now. ${where}`
    : `The server did not take ${it}, and ${one ? "it" : "they"} could not be kept on this browser: ${one ? "it is" : "they are"} lost if this page is closed or loaded again before ${one ? "it is" : "they are"} sent. ${is} sent with your next decision, or now. ${where}`
}

/** What the person's last decision costs them if this page goes before it is sent, where the browser did not keep it. */
const lostIfGone = "it is lost if this page is closed or loaded again before it is sent."

/** The toast after a save the server did not take. */
export const notSavedToast = (kept: boolean): string =>
  kept
    ? "Your last decision is kept in this browser, and the server did not take it. Save again sends it now; where someone decided that row meanwhile, the review asks you which stands."
    : `Your last decision could not be kept on this browser, and the server did not take it: ${lostIfGone} Save again sends it now; where someone decided that row meanwhile, the review asks you which stands.`

/** The toast after a save that was not sent because the person is signed out, or `another` member is signed in. */
export const signedOutToast = (input: { readonly another: boolean; readonly kept: boolean }): string => {
  const then = "Sign in again as yourself in this tab, then Save again sends it."
  if (input.kept) {
    return input.another
      ? `Your last decision is kept in this browser for you, and was not sent as them. ${then}`
      : `Your last decision is kept in this browser. ${then}`
  }
  return input.another
    ? `Your last decision could not be kept on this browser, and was not sent as them: ${lostIfGone} ${then}`
    : `Your last decision could not be kept on this browser: ${lostIfGone} ${then}`
}

/** The toast after a confirm that was not sent because the person is signed out, or another member is signed in. */
export const notImportedToast = (kept: boolean): string =>
  kept
    ? "Nothing was confirmed. Your decisions are kept in this browser; confirm again once you are signed in as yourself."
    : "Nothing was confirmed. Your decisions could not be kept on this browser: they are lost if this page is closed or loaded again before they are sent. Confirm again once you are signed in as yourself."
