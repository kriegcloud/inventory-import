/** Vite's inline asset loader preserves the fixture's bytes in a base64 data URL. */
declare module "*?url&inline" {
  const dataUrl: string
  export default dataUrl
}
