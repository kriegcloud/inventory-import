import { appRuntime } from "./api.ts"

/**
 * The browser's runtime for work that is not an API call: reading a chosen file, restoring saved progress. It is the
 * same runtime as the API client's (`appRuntime`), so a fiber started here can be interrupted from anywhere (Cancel)
 * and Effect DevTools, when switched on in development, has one connection for the tab.
 */
export const browserRuntime = appRuntime
