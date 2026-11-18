// Types for scripts/session-report.mjs, so the tests in test/scripts/ can import it under the strict check.
import type { Where } from "./session-log.mjs"

/**
 * One commit from `git log`, oldest first: the root is the template (its message is never read). `start` marks the
 * commit that added the brief (`readClockStart` in scripts/session-log.mjs): minute 0. Without one the timer has not
 * started, whatever came before it.
 */
export interface Commit {
  readonly hash: string
  readonly ct: number
  readonly subject: string
  readonly start?: boolean
}

/** A raw-log line after parsing: allow-listed fields, redacted strings, and its time in milliseconds. */
export interface ParsedEvent {
  readonly time: number
  readonly [field: string]: unknown
}

export interface MarkerSource {
  readonly where: string
  readonly text: string
  readonly lines?: ReadonlyArray<number>
  /** What the whole source is ("a commit message"). */
  readonly kind?: string
  /** What each line is, by index ("a prompt Benjamin typed"). */
  readonly kinds?: ReadonlyArray<string>
}

/** A place a marker was found, with the kind of thing that held it: never the marker. */
export interface MarkerHit {
  readonly where: string
  readonly line: number
  readonly kind: string
}

/** The kind of one events.jsonl line, in words. */
export declare function eventKind(line: string): string

/** The kind of each line of TIMELINE.md or SUMMARY.md, from the `[eN]` it or the nearest line above it cites. */
export declare function renderedKinds(text: string, events: string): ReadonlyArray<string>

export declare function parseLog(
  text: string,
  where?: Where
): { readonly events: ReadonlyArray<ParsedEvent>; readonly skipped: number }

export declare function commandKind(cmd: string): string

export declare function buildRecord(input: {
  readonly events: ReadonlyArray<ParsedEvent>
  readonly commits: ReadonlyArray<Commit>
  readonly skipped?: number
  /** Lines of `.session/checkpoints.jsonl` (scripts/checkpoint-rules.mjs `readCheckpointLog`). */
  readonly checkpoints?: ReadonlyArray<{ readonly ev: string; readonly [field: string]: unknown }>
}): {
  readonly timeline: string
  readonly summary: string
  readonly events: string
  readonly counts: {
    readonly events: number
    readonly prompts: number
    readonly subagents: number
    readonly checks: number
  }
}

export declare function parseMarkers(text: string): ReadonlyArray<string>

export declare function findMarkers(input: {
  readonly markers: ReadonlyArray<string>
  readonly sources: ReadonlyArray<MarkerSource>
}): ReadonlyArray<MarkerHit>

export declare function markerAdvice(
  hits: ReadonlyArray<{ readonly where: string; readonly line: number }>
): ReadonlyArray<string>

export declare function guard(root: string, file: string | undefined): number
