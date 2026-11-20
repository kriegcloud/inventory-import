-- Which column each field read before each match: `movesJson` is the draft's list of `ColumnMove`s, oldest first
-- (packages/catalog/contract/src/Import/Mapping.read.ts). A match writes it in the same statement as `choicesJson`.
-- With it the server knows the column a field read at any past revision, and when a field last moved, so a decision
-- made before a match it rests on is not applied. A draft staged before this column has none: '[]'.
ALTER TABLE importDraft ADD COLUMN movesJson TEXT NOT NULL DEFAULT '[]';
