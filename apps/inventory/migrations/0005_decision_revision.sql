-- The draft's revision each stored decision was saved at. A match that is worked out again (something it read changed in
-- between) keeps what its first try found of a Replace that stood, and asks again about one made in between, even to the
-- same decision: the stored text alone cannot tell the two apart, its revision can. A row saved before this column has
-- 0, a constant default, and gets a revision with its next decision.
ALTER TABLE importDecision ADD COLUMN savedRevision INTEGER NOT NULL DEFAULT 0;
