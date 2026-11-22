// A file read as text by the test runner (`import text from "./file.md?raw"`), where `node:fs` is refused.
declare module "*?raw" {
  const text: string
  export default text
}
