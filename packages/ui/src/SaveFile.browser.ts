// A file handed to the person from the page: its text is made when they ask for it, never kept in a link while they
// do not.

/**
 * Saves text as a CSV file from the browser, under the name given. The text is made by the caller at the press, so a
 * list of thousands of rows is written out once, when it is wanted.
 *
 * @example saveCsv("not-imported.csv", "Row,Reason\n12,Cost is missing\n")
 */
export const saveCsv = (fileName: string, text: string): void => {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }))
  const link = document.createElement("a")
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}
