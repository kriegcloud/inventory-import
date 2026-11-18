// Types for scripts/check-images.mjs, so the tests can import it under the strict check.

export declare const ASSET_PLACES: ReadonlyArray<string>

export declare const MAX_EVIDENCE: number

export declare const EVIDENCE_FOLDER: string

export declare function imageProblems(input: {
  readonly paths: ReadonlyArray<string>
  readonly shown: ReadonlyArray<string>
  readonly ffmpeg: boolean
}): { readonly evidence: ReadonlyArray<string>; readonly problems: ReadonlyArray<string> }

export declare function shownIn(texts: ReadonlyArray<string>, paths: ReadonlyArray<string>): Array<string>

export declare function candidates(root?: string): Array<string>

export declare function hasWebpEncoder(): boolean
