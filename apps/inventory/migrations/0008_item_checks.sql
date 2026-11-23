-- The item table holds only what the import's schema would write: a cost is digits with up to four decimals and
-- twelve whole digits (the contract's `decimalPattern`, "12.5", never "-1", "1e3" or "12."), in `item` and in the copy
-- a replace keeps in `importReplaced`; a SKU is in the contract's form (`skuPattern`, three capitals, a hyphen, four
-- digits); and `skuKey` is the SKU itself, which is the key the import compares (upper case, no spaces) for every SKU
-- in that form. So the unique index that makes "one item per SKU" true compares the key the import compared, whoever
-- writes the row. The key is not worked out again here: SQLite's `upper` knows only ASCII, and the import's key drops
-- every Unicode space and upper-cases every letter.
--
-- SQLite adds a CHECK to a table only by building it again. `item` is built again with its rowids kept, so the search
-- index (`itemSearch`, by rowid) still points at the same items, and rebuilt all the same from the table at the end.
-- `importReplaced` refers to `item` and goes with it (ON DELETE CASCADE), so it is built again first, against the new
-- table, and its rows are copied before the old `item` is dropped. Foreign keys are checked at the end of the
-- migration, not at each step. A stored row that breaks a new CHECK stops the migration and changes nothing.
PRAGMA defer_foreign_keys = true;

CREATE TABLE item_new (
  id TEXT NOT NULL,
  organizationId TEXT NOT NULL REFERENCES organization (id),
  sku TEXT NOT NULL CHECK (sku GLOB '[A-Z][A-Z][A-Z]-[0-9][0-9][0-9][0-9]'),
  skuKey TEXT NOT NULL CHECK (skuKey = sku),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL CHECK (category IN ('raw-materials', 'components', 'finished-goods', 'packaging', 'supplies')),
  uom TEXT NOT NULL CHECK (uom IN ('EA', 'BX', 'KG', 'M', 'L')),
  unitCost TEXT NOT NULL CHECK (typeof(unitCost) = 'text' AND unitCost NOT GLOB '*[^0-9.]*' AND (
    (instr(unitCost, '.') = 0 AND length(unitCost) BETWEEN 1 AND 12)
    OR (instr(unitCost, '.') BETWEEN 2 AND 13 AND instr(substr(unitCost, instr(unitCost, '.') + 1), '.') = 0
      AND length(unitCost) - instr(unitCost, '.') BETWEEN 1 AND 4))),
  quantityOnHand INTEGER NOT NULL DEFAULT 0 CHECK (quantityOnHand >= 0),
  reorderPoint INTEGER CHECK (reorderPoint IS NULL OR reorderPoint >= 0),
  isActive INTEGER NOT NULL DEFAULT 1 CHECK (isActive IN (0, 1)),
  lotTracked INTEGER NOT NULL DEFAULT 0 CHECK (lotTracked IN (0, 1)),
  tags TEXT NOT NULL DEFAULT '[]',
  firstReceivedOn TEXT,
  discontinuedOn TEXT,
  dimensions TEXT,
  vendors TEXT NOT NULL DEFAULT '[]',
  importId TEXT NOT NULL,
  batchId TEXT NOT NULL,
  sourceRow INTEGER NOT NULL,
  sourcePart INTEGER NOT NULL DEFAULT 0,
  createdById TEXT NOT NULL,
  createdBy TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision >= 1),
  updatedById TEXT,
  updatedBy TEXT,
  updatedAt TEXT,
  PRIMARY KEY (organizationId, id),
  UNIQUE (organizationId, skuKey),
  CHECK (discontinuedOn IS NULL OR isActive = 0),
  FOREIGN KEY (organizationId, importId) REFERENCES importDraft (organizationId, id),
  FOREIGN KEY (organizationId, batchId) REFERENCES importBatch (organizationId, id),
  FOREIGN KEY (organizationId, createdById) REFERENCES member (organizationId, id),
  FOREIGN KEY (organizationId, updatedById) REFERENCES member (organizationId, id)
);

INSERT INTO item_new (rowid, id, organizationId, sku, skuKey, name, description, category, uom, unitCost,
  quantityOnHand, reorderPoint, isActive, lotTracked, tags, firstReceivedOn, discontinuedOn, dimensions, vendors,
  importId, batchId, sourceRow, sourcePart, createdById, createdBy, createdAt, revision, updatedById, updatedBy,
  updatedAt)
SELECT rowid, id, organizationId, sku, skuKey, name, description, category, uom, unitCost,
  quantityOnHand, reorderPoint, isActive, lotTracked, tags, firstReceivedOn, discontinuedOn, dimensions, vendors,
  importId, batchId, sourceRow, sourcePart, createdById, createdBy, createdAt, revision, updatedById, updatedBy,
  updatedAt
FROM item;

CREATE TABLE importReplaced_new (
  organizationId TEXT NOT NULL REFERENCES organization (id),
  importId TEXT NOT NULL,
  batchId TEXT NOT NULL,
  itemId TEXT NOT NULL,
  sourceRow INTEGER NOT NULL,
  sourcePart INTEGER NOT NULL DEFAULT 0,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  uom TEXT NOT NULL,
  unitCost TEXT NOT NULL CHECK (typeof(unitCost) = 'text' AND unitCost NOT GLOB '*[^0-9.]*' AND (
    (instr(unitCost, '.') = 0 AND length(unitCost) BETWEEN 1 AND 12)
    OR (instr(unitCost, '.') BETWEEN 2 AND 13 AND instr(substr(unitCost, instr(unitCost, '.') + 1), '.') = 0
      AND length(unitCost) - instr(unitCost, '.') BETWEEN 1 AND 4))),
  quantityOnHand INTEGER NOT NULL,
  reorderPoint INTEGER,
  isActive INTEGER NOT NULL,
  lotTracked INTEGER NOT NULL,
  tags TEXT NOT NULL,
  firstReceivedOn TEXT,
  discontinuedOn TEXT,
  dimensions TEXT,
  vendors TEXT NOT NULL,
  revision INTEGER NOT NULL,
  updatedById TEXT,
  updatedBy TEXT,
  updatedAt TEXT,
  revisionAfter INTEGER NOT NULL,
  restored INTEGER NOT NULL DEFAULT 0 CHECK (restored IN (0, 1)),
  PRIMARY KEY (organizationId, batchId, itemId),
  FOREIGN KEY (organizationId, importId) REFERENCES importDraft (organizationId, id),
  FOREIGN KEY (organizationId, batchId) REFERENCES importBatch (organizationId, id),
  FOREIGN KEY (organizationId, updatedById) REFERENCES member (organizationId, id),
  FOREIGN KEY (organizationId, itemId) REFERENCES item_new (organizationId, id) ON DELETE CASCADE
);

INSERT INTO importReplaced_new (organizationId, importId, batchId, itemId, sourceRow, sourcePart, name, description,
  category, uom, unitCost, quantityOnHand, reorderPoint, isActive, lotTracked, tags, firstReceivedOn, discontinuedOn,
  dimensions, vendors, revision, updatedById, updatedBy, updatedAt, revisionAfter, restored)
SELECT organizationId, importId, batchId, itemId, sourceRow, sourcePart, name, description,
  category, uom, unitCost, quantityOnHand, reorderPoint, isActive, lotTracked, tags, firstReceivedOn, discontinuedOn,
  dimensions, vendors, revision, updatedById, updatedBy, updatedAt, revisionAfter, restored
FROM importReplaced;

-- The old copies go before the old items, so dropping the items deletes nothing a replace kept; the search triggers
-- go first, so dropping the items empties nothing of the index either.
DROP TABLE importReplaced;
DROP TRIGGER item_search_insert;
DROP TRIGGER item_search_update;
DROP TRIGGER item_search_delete;
DROP TABLE item;

-- Renaming the new item table renames the reference to it in `importReplaced_new` too.
ALTER TABLE item_new RENAME TO item;
ALTER TABLE importReplaced_new RENAME TO importReplaced;

CREATE INDEX item_import ON item (organizationId, importId, sourceRow, sourcePart);
CREATE INDEX item_batch ON item (organizationId, batchId, sourceRow, sourcePart);
CREATE INDEX item_org_sku ON item (organizationId, sku COLLATE NOCASE, id);
CREATE INDEX importReplaced_import ON importReplaced (organizationId, importId);
CREATE INDEX importReplaced_item ON importReplaced (organizationId, itemId);

CREATE TRIGGER item_search_insert AFTER INSERT ON item BEGIN
  INSERT INTO itemSearch (rowid, name, sku, description, organizationId, itemId)
  VALUES (new.rowid, new.name, new.sku, COALESCE(new.description, ''), new.organizationId, new.id); END;

CREATE TRIGGER item_search_update AFTER UPDATE OF name, sku, description ON item BEGIN
  UPDATE itemSearch SET name = new.name, sku = new.sku, description = COALESCE(new.description, '')
  WHERE rowid = old.rowid; END;

CREATE TRIGGER item_search_delete AFTER DELETE ON item BEGIN
  DELETE FROM itemSearch WHERE rowid = old.rowid; END;

-- The search index built again from the items as they now are, as 0001_init.sql says to after a rebuild.
DELETE FROM itemSearch;
INSERT INTO itemSearch (rowid, name, sku, description, organizationId, itemId)
SELECT rowid, name, sku, COALESCE(description, ''), organizationId, id FROM item;
