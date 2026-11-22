-- The long lists one write of an import carries (the decisions of a save, every SKU key and stored item a judgement
-- read), in pieces, while that write's own batch runs: D1 binds at most 100 values to a statement and holds at most 2 MB
-- in one, so a list of 50,000 rows travels as several rows here, and the statements that need the whole of it read it
-- back with json_each, binding the same few values however long it is (packages/catalog/host/src/ImportStore.adapter.ts).
-- The batch deletes its rows before it ends, so the table is empty outside a batch. `writeId` is new for every batch;
-- `list` says which of the write's lists a piece belongs to; `piece` is a JSON array.
CREATE TABLE importWriteList (
  organizationId TEXT NOT NULL REFERENCES organization (id),
  importId TEXT NOT NULL,
  writeId TEXT NOT NULL,
  list TEXT NOT NULL CHECK (list IN ('sets', 'clears', 'keys', 'items', 'created', 'suggestions')),
  seq INTEGER NOT NULL,
  piece TEXT NOT NULL,
  PRIMARY KEY (organizationId, writeId, list, seq),
  FOREIGN KEY (organizationId, importId) REFERENCES importDraft (organizationId, id)
);
