-- Who last saved each stored decision, and the draft's revision that save was made on, changed or not. A save that
-- sends exactly what is stored changes nothing of the decision: who decided it, its `savedRevision` and the draft's
-- revision stay. But that person decided the row too, and a row that waited over what somebody else decided is never
-- written unasked: a decision last saved by somebody else on or after the revision the waiting row was made on is never
-- the sender's own, whatever it reads. `lastSavedRevision` is the revision the draft was at when the save came, before
-- it moved it: a screen at a later revision is from after that save; one at the same revision may be from before it.
-- A row stored before these columns cannot say who last saved it: no name, and the revision its draft is at now.
ALTER TABLE importDecision ADD COLUMN lastSavedById TEXT;
ALTER TABLE importDecision ADD COLUMN lastSavedRevision INTEGER NOT NULL DEFAULT 0;
UPDATE importDecision SET lastSavedRevision = (SELECT d.revision FROM importDraft d
  WHERE d.organizationId = importDecision.organizationId AND d.id = importDecision.importId);
-- How many saves have named a row of the draft, changed or not: a row that waited is compared with what is stored and
-- written in one batch only while no save came between, even one that moved no revision.
ALTER TABLE importDraft ADD COLUMN saves INTEGER NOT NULL DEFAULT 0;
