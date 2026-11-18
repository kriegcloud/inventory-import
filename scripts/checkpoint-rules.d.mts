// Types for scripts/checkpoint-rules.mjs, so the tests in test/scripts/ can import it under the strict check.

export type Bump = "minor" | "patch"

export interface Slot {
  readonly n: number
  readonly by: number
  readonly what: string
}

export declare const SCHEDULE: ReadonlyArray<Slot>

export declare function slotOf(minute: number): number

export declare function scheduleStatus(input: { readonly minute: number; readonly made: ReadonlyArray<number> }): {
  readonly next: Slot | undefined
  readonly overdue: boolean
  readonly buildingStopped: boolean
}

export declare function decisionRound(input: {
  readonly minute: number
  readonly made: ReadonlyArray<number>
}): Slot | undefined

export declare function parseVersion(
  text: string
): { readonly major: number; readonly minor: number; readonly patch: number } | undefined

export declare function sortVersions(versions: ReadonlyArray<string>): Array<string>

export declare function bumpOf(subject: string): Bump

export declare function isBreaking(subject: string): boolean

export declare function isReleaseCommit(subject: string): boolean

export declare function nextVersion(input: {
  readonly current: string
  readonly first: boolean
  readonly subjects: ReadonlyArray<string>
}):
  | {
      readonly version: string
      readonly bump: Bump
      readonly notes: ReadonlyArray<string>
      readonly error?: undefined
    }
  | { readonly error: string; readonly version?: undefined }

export declare function oneLine(text: string, max?: number): string

export interface TimelineRow {
  readonly minute: string
  readonly version: string
  readonly commit: string | undefined
  readonly contents: string
  readonly upload: string
}

export declare function timelineRow(input: {
  readonly minute: number | string
  readonly version: string
  readonly commit?: string
  readonly contents: string
  readonly upload: string
  readonly keep?: boolean
}): string

export declare function parseTimeline(text: string): ReadonlyArray<TimelineRow>

export declare function addTimelineRow(text: string, row: string): string

export declare function isOwnUploadNote(note: string | undefined): boolean

export declare function fillUploadNote(
  note: string | undefined,
  upload: string | undefined
): { readonly note: string | undefined; readonly kept: boolean }

export declare function updateTimelineRow(
  text: string,
  version: string,
  change: { readonly commit?: string; readonly upload?: string }
): string

export declare function recordsAgree(input: {
  readonly decisions: string | undefined
  readonly versions: ReadonlyArray<string>
}): ReadonlyArray<string>

export declare function waitingDecisions(text: string | undefined): number

export declare function setLockfileVersion(text: string, version: string): string

export declare function setPackageVersion(text: string, version: string): string

/** One line of `.session/checkpoints.jsonl`: `ev` is "checkpoint", "upload" or "uploads". */
export interface LogLine {
  readonly ev: string
  readonly [field: string]: unknown
}

export declare function readCheckpointLog(text: string): ReadonlyArray<LogLine>

export declare function uploadMode(input: {
  readonly lines: ReadonlyArray<LogLine>
  readonly sid: string | undefined
}): {
  readonly mode: "not asked" | "auto" | "manual"
  readonly reason: string
  readonly firstPending: boolean
  readonly lastConfirmed: string | undefined
  /** "auto" was turned on in another session: this one reads "not asked". */
  readonly elsewhere: boolean
  readonly unconfirmed: ReadonlyArray<string>
}

export interface BriefFinding {
  readonly key: string
  readonly text: string
}

export declare function briefFindings(input: {
  readonly received: ReadonlyArray<{ readonly path: string; readonly blob: string; readonly commit: string }>
  readonly head: Readonly<Record<string, string>>
  readonly worktree: ReadonlyArray<string>
  readonly rewritten: ReadonlyArray<{
    readonly commit: string
    readonly start: boolean
    readonly differs: ReadonlyArray<string>
  }>
}): Array<BriefFinding>

export declare function openBriefFindings(input: {
  readonly findings: ReadonlyArray<BriefFinding>
  readonly lines: ReadonlyArray<LogLine>
}): {
  readonly open: ReadonlyArray<BriefFinding>
  readonly asIs: ReadonlyArray<BriefFinding>
  readonly said: ReadonlyArray<string>
}

export declare function lastLook(input: { readonly lines: ReadonlyArray<LogLine> }): LogLine | undefined

export interface InUseMark {
  readonly version: string
  readonly by: string
  readonly t: number
  readonly pid?: number
}

export declare const IN_USE_STALE_MINUTES: number

export interface InUse {
  readonly live: ReadonlyArray<InUseMark & { readonly minutes: number }>
  readonly stale: ReadonlyArray<InUseMark & { readonly minutes: number; readonly why: string }>
}

export declare function inUseStatus(input: {
  readonly marks: ReadonlyArray<InUseMark>
  readonly now: number
  readonly running: ReadonlyArray<string>
  readonly pidAlive?: (pid: number) => boolean
}): InUse

export declare function inUseLines(input: InUse): ReadonlyArray<string>

export declare function inUseRefusal(input: InUse & { readonly step: string }): string

export declare function hasTimeline(text: string | undefined): boolean

export declare const WRITEUP_BUDGET: { readonly readme: number; readonly decisions: number }

export declare function readmeWriteup(text: string): string

export declare function writeupStyle(input: {
  readonly files: Readonly<Record<string, string | undefined>>
  readonly budget?: { readonly readme: number; readonly decisions: number }
}): ReadonlyArray<string>

export declare function uploadWords(result: string | undefined): string

export declare const OWN_UPLOAD_NOTES: ReadonlyArray<string>

export declare const UPLOAD_LIMIT: number

export declare function uploadLimit(env: { readonly [name: string]: string | undefined } | undefined): number

export declare function sizeText(bytes: number): string

export interface UploadState {
  readonly version: string
  readonly result: string | undefined
  readonly state: "uploaded" | "pending" | "held" | "not asked" | "not uploaded"
  readonly final: boolean
  readonly zip: string | undefined
  readonly loud: boolean
  readonly why: string | undefined
}

export declare function uploadState(input: {
  readonly lines: ReadonlyArray<LogLine>
  readonly version: string
}): UploadState

export declare function notUploadedLine(input: {
  readonly version: string
  readonly final: boolean
  readonly why: string | undefined
  readonly zip: string
}): string

export declare function checkpointLine(input: {
  readonly version: string
  readonly minute: number
  readonly commit: string
  readonly zip: string
  readonly bytes: number
  readonly seconds: number
  readonly upload: string
}): string

export declare function isImage(path: string): boolean

export declare function partOf(path: string): string

export interface ZipPart {
  readonly name: string
  readonly bytes: number
  readonly files: number
  readonly history: number
  readonly count: number
  readonly images: number
}

export declare function largestParts(input: {
  readonly files: ReadonlyArray<{ readonly path: string; readonly bytes: number }>
  readonly history: ReadonlyArray<{ readonly path?: string | undefined; readonly bytes: number }>
  readonly top?: number
}): ReadonlyArray<ZipPart>

export declare const ZIP_WARN: number

export declare function weightLines(input: {
  readonly bytes: number
  readonly parts: ReadonlyArray<ZipPart>
  readonly warn?: number
}): ReadonlyArray<string>

export declare function seededPeople(sqlTexts: ReadonlyArray<string>): number

export declare function writeupProblems(input: {
  readonly files: Readonly<Record<string, string | undefined>>
  readonly tests: number | undefined
  readonly people: number | undefined
}): { readonly fail: ReadonlyArray<string>; readonly warn: ReadonlyArray<string> }
