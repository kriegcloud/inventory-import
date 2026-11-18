// Types for scripts/session-log.mjs, so the tests in test/scripts/ can import it under the strict check.

/**
 * Where redaction applies. Defaults: this repo's folder, the home folder and the user name of this machine, and the
 * private markers in the file TAKEHOME_PRIVATE_MARKERS names (lower case).
 */
export interface Where {
  readonly root?: string
  readonly home?: string
  readonly user?: string
  readonly hosts?: ReadonlyArray<string>
  readonly markers?: ReadonlyArray<string>
}

/** What a private marker becomes in the record: `[private]`. */
export declare const PRIVATE: string

/** One marker per line, lower case; blank lines and lines starting with # are skipped. */
export declare function parseMarkers(text: string): ReadonlyArray<string>

/** The markers in the file TAKEHOME_PRIVATE_MARKERS names in `env` (default: this process); none when it is unset. */
export declare function markersFromEnv(env?: Readonly<Record<string, string | undefined>>): ReadonlyArray<string>

/** Every marker in `text` replaced with `[private]`, ignoring case. */
export declare function hideMarkers(text: string, markers: ReadonlyArray<string>): string

/** One line of the raw log. `by` is "person", "main", "sub" or "harness"; the other fields depend on `ev`. */
export interface RecordLine {
  readonly t: string
  readonly min: number | null
  readonly by: string
  readonly ev: string
  readonly [field: string]: unknown
}

export declare function redact(text: string, where?: Where): string

export declare function summarize(
  payload: unknown,
  context?: {
    readonly now?: number
    readonly minute?: number | null
    readonly where?: Where
    /** The session's checkout relative to this project: "." here, ".claude/worktrees/x" for a worktree. */
    readonly dir?: string
  }
): RecordLine | null

/** Which record an event belongs in, from the checkout its session works in; undefined for none. */
export declare function recordPlace(input: {
  readonly project: string
  readonly toplevel: string | undefined
}): { readonly root: string; readonly dir: string } | undefined

/** A file the brief brings: anything under brief/ except brief/README.md. */
export declare function isBriefFile(path: string): boolean

/** The commit the hour starts at: the first, oldest first, that adds a brief file; undefined before the brief. */
export declare function clockStartOf<C extends { readonly added: ReadonlyArray<string> }>(
  commits: ReadonlyArray<C>
): C | undefined

/** The same, read from git in `root` (default: this project). `ct` is in seconds. */
export declare function readClockStart(
  root?: string,
  timeout?: number
): { readonly hash: string; readonly ct: number; readonly subject: string } | undefined
