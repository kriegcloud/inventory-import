-- What each match of an open import took back from the stored decisions (Benjamin, 2026-11-20: "the screen names it
-- as taken back"): `takenBackJson` is the draft's list of `MatchTakeBack`s, oldest first
-- (packages/catalog/contract/src/Import/Import.read.ts), one per match revision, re-matched field and kind, with the
-- count and the first 200 rows. A match writes it in the same statement as `choicesJson`, so it is in the match's own
-- atomic batch; a confirm empties it. A draft staged or matched before this column has none: '[]'.
ALTER TABLE importDraft ADD COLUMN takenBackJson TEXT NOT NULL DEFAULT '[]';
