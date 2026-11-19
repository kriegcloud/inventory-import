-- Applied after 0001: it needs the note table.
ALTER TABLE note ADD COLUMN tag TEXT NOT NULL DEFAULT 'none';
