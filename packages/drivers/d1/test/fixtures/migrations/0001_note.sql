-- A table with a check, so a statement can fail inside a batch.
CREATE TABLE note (
  id TEXT NOT NULL PRIMARY KEY,
  body TEXT NOT NULL CHECK (length(body) > 0)
);
