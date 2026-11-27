-- A table with a check, so the second statement of a batch can fail and the first must not land.
CREATE TABLE note (
  id TEXT NOT NULL PRIMARY KEY,
  body TEXT NOT NULL CHECK (length(body) > 0)
);
