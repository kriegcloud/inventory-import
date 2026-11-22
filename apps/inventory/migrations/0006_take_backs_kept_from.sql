-- The revision from which a draft keeps what every match took back: `takenBackJson` holds the take-backs of each match
-- after it, and of none before. A confirm lets them go and moves it to its own revision; an import created since starts
-- at 0. A row that waited over a decision a match may have rewritten is judged from those take-backs, so a match at or
-- before this revision is one whose take-backs are not known, and such a row is never written over unasked. A draft
-- stored before this column is set to the revision it is at: its earlier matches may have taken back what no entry says.
ALTER TABLE importDraft ADD COLUMN takenBackFrom INTEGER NOT NULL DEFAULT 0;
UPDATE importDraft SET takenBackFrom = revision;
