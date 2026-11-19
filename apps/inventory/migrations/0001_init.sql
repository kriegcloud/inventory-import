-- The database, from empty, in one file: sign-in, tenants, the import and the items it creates, the day's model
-- calls and the items' search index. A later change is a new numbered file after this one; a local database made by
-- an earlier version of this file is made again with `bun run db:reset`. The parts keep this order, which matters in
-- one place: Better Auth's tables come first, so a member can reference its sign-in account.
--
-- Two rules hold throughout. Every table of customer data has organizationId, its key and indexes start with it, and
-- it points at another tenant table by (organizationId, id), so SQL itself refuses a row of one organization that
-- names a row of another. And a statement ends at a semicolon that ends a line (a trigger's body ends on its END
-- line), so the file can be split into statements there.

-- ===================================================================================================================
-- 1. Sign-in: Better Auth's own tables, first, because `member.userId` below references `user`
-- ===================================================================================================================

-- Sign-in with Better Auth (docs/auth.md): its own tables, exactly as its migration planner writes them for SQLite.
-- `bun run auth:schema` prints anything its configuration still needs on top of migrations/, and
-- test/server/AuthSchema.slow.test.ts keeps that at nothing. `invitation` is the plugin's table; the app does not use it
-- (people are added from People), and its indexes are the ones Better Auth's performance guide asks for.
create table "user" ("id" text not null primary key, "name" text not null, "email" text not null unique, "emailVerified" integer not null, "image" text, "createdAt" date not null, "updatedAt" date not null);

create table "session" ("id" text not null primary key, "expiresAt" date not null, "token" text not null unique, "createdAt" date not null, "updatedAt" date not null, "ipAddress" text, "userAgent" text, "userId" text not null references "user" ("id") on delete cascade, "activeOrganizationId" text);

create table "account" ("id" text not null primary key, "accountId" text not null, "providerId" text not null, "userId" text not null references "user" ("id") on delete cascade, "accessToken" text, "refreshToken" text, "idToken" text, "accessTokenExpiresAt" date, "refreshTokenExpiresAt" date, "scope" text, "password" text, "createdAt" date not null, "updatedAt" date not null);

create table "verification" ("id" text not null primary key, "identifier" text not null, "value" text not null, "expiresAt" date not null, "createdAt" date not null, "updatedAt" date not null);

create table "invitation" ("id" text not null primary key, "organizationId" text not null references "organization" ("id") on delete cascade, "email" text not null, "role" text, "status" text not null, "expiresAt" date not null, "createdAt" date not null, "inviterId" text not null references "user" ("id") on delete cascade);

create table "rateLimit" ("id" text not null primary key, "key" text not null unique, "count" integer not null, "lastRequest" bigint not null);

create index "session_userId_idx" on "session" ("userId");

create index "account_userId_idx" on "account" ("userId");

create index "verification_identifier_idx" on "verification" ("identifier");

create index "invitation_organizationId_idx" on "invitation" ("organizationId");

create index "invitation_email_idx" on "invitation" ("email");

-- ===================================================================================================================
-- 2. Tenants: organizations, members, the activity trail, and the two seeded organizations
-- ===================================================================================================================

-- The tenants and who belongs to them. Every table of customer data has organizationId, its indexes start with it,
-- and it points at another tenant table by (organizationId, id), so SQL itself refuses a row of one organization
-- that names a row of another. `member` carries UNIQUE (organizationId, id) for exactly that reason.
--
-- `organization` and `member` are shared with Better Auth's organization plugin (src/server/authOptions.ts): their
-- columns are the ones it reads and writes, and scripts/auth-schema.mjs checks that nothing it needs is missing.

-- The tenant itself. `slug` and `createdAt` are the plugin's; the seeded organizations fill them in below.
CREATE TABLE organization (
  id TEXT NOT NULL PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  logo TEXT,
  createdAt DATE NOT NULL,
  metadata TEXT
);

CREATE UNIQUE INDEX organization_slug_uidx ON organization (slug);

-- A person in one organization. `userId` is their sign-in account; it is empty for a seeded person nobody has
-- signed in as yet, and for a member who was removed (`removedAt`): the row stays, because the audit trail, the
-- imports and the decisions they made point at it.
CREATE TABLE member (
  id TEXT NOT NULL PRIMARY KEY,
  organizationId TEXT NOT NULL REFERENCES organization (id),
  userId TEXT REFERENCES "user" (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'editor', 'viewer')),
  createdAt DATE NOT NULL,
  removedAt TEXT,
  UNIQUE (organizationId, id)
);

-- One membership per person per organization. The plugin checks this before inserting; the index makes it true.
CREATE UNIQUE INDEX member_organizationId_userId_uidx ON member (organizationId, userId);
-- Better Auth's own lookup of a person's memberships across organizations, which the sign-in needs before any
-- organization is known: the one index of a tenant table that does not start with organizationId.
CREATE INDEX member_userId_idx ON member (userId);

-- Append-only record of who did what and when. `agent` names the agent that acted for the person (`asAgent` in @inventory/kernel/Agent);
-- null when the person did it themselves.
CREATE TABLE activity (
  id TEXT NOT NULL,
  organizationId TEXT NOT NULL REFERENCES organization (id),
  actorId TEXT NOT NULL,
  actorName TEXT NOT NULL,
  action TEXT NOT NULL,
  detail TEXT NOT NULL,
  agent TEXT,
  createdAt TEXT NOT NULL,
  PRIMARY KEY (organizationId, id),
  FOREIGN KEY (organizationId, actorId) REFERENCES member (organizationId, id)
);

CREATE INDEX activity_org_createdAt ON activity (organizationId, createdAt DESC);


-- ===================================================================================================================
-- 3. Imports and items
-- ===================================================================================================================

-- Bringing a file in, and the items it creates. Every table here belongs to one organization: its key and its
-- indexes start with organizationId, and it names its parent by (organizationId, id), so an upload, an import, a
-- confirm or an item can only ever point at rows of its own organization.

-- A file on its way in, sent in pieces so a large one never blocks a screen or a request. An upload is not an
-- import: nothing but the upload endpoints reads these two tables, and an upload becomes an importDraft (with the
-- same id) only whole, in the batch that deletes it from here. A cancelled upload is deleted at once; one left
-- unfinished is deleted by its organization's next upload after an hour. `requestKey` is chosen by the browser for
-- each file it starts to send, so a begin sent twice (a retry after a lost answer) starts one upload, not two.
CREATE TABLE importUpload (
  id TEXT NOT NULL,
  organizationId TEXT NOT NULL REFERENCES organization (id),
  actorId TEXT NOT NULL,
  actorName TEXT NOT NULL,
  requestKey TEXT NOT NULL,
  fileName TEXT NOT NULL,
  -- The staged file without its rows (StagedHead), as JSON: the same value importDraft.headJson will hold.
  headJson TEXT NOT NULL,
  rowCount INTEGER NOT NULL,
  chunkCount INTEGER NOT NULL,
  createdAt TEXT NOT NULL,
  PRIMARY KEY (organizationId, id),
  UNIQUE (organizationId, actorId, requestKey),
  FOREIGN KEY (organizationId, actorId) REFERENCES member (organizationId, id)
);

CREATE INDEX importUpload_org ON importUpload (organizationId, createdAt);

-- One piece of an upload's rows. The primary key is what makes sending a piece again harmless.
CREATE TABLE importUploadChunk (
  organizationId TEXT NOT NULL REFERENCES organization (id),
  uploadId TEXT NOT NULL,
  seq INTEGER NOT NULL,
  rowCount INTEGER NOT NULL,
  rowsJson TEXT NOT NULL,
  PRIMARY KEY (organizationId, uploadId, seq),
  FOREIGN KEY (organizationId, uploadId) REFERENCES importUpload (organizationId, id)
);

-- A file being brought in. headJson is the file's name, sheet, columns and the reader's notes; the rows are in
-- importChunk. Nothing here is an item: items are written only by a confirm, which flips status to 'imported' in
-- the same atomic batch; a take-back flips it to 'takenBack'. `revision` goes up with every saved decision, so a
-- screen can tell that the draft changed somewhere else; `needsAtStart` is the "of 42" in "12 of 42 decided";
-- `choicesJson` is which file column people gave to a field.
CREATE TABLE importDraft (
  id TEXT NOT NULL,
  organizationId TEXT NOT NULL REFERENCES organization (id),
  actorId TEXT NOT NULL,
  actorName TEXT NOT NULL,
  fileName TEXT NOT NULL,
  headJson TEXT NOT NULL,
  rowCount INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('open', 'imported', 'takenBack')),
  importedBy TEXT,
  importedAt TEXT,
  revision INTEGER NOT NULL DEFAULT 0,
  needsAtStart INTEGER NOT NULL DEFAULT 0,
  choicesJson TEXT NOT NULL DEFAULT '[]',
  createdAt TEXT NOT NULL,
  PRIMARY KEY (organizationId, id),
  FOREIGN KEY (organizationId, actorId) REFERENCES member (organizationId, id)
);

CREATE INDEX importDraft_org ON importDraft (organizationId, status, createdAt DESC);

-- The file's rows, 500 to a chunk, as JSON. A D1 value may hold 2 MB at most, so a file is never one value.
CREATE TABLE importChunk (
  organizationId TEXT NOT NULL REFERENCES organization (id),
  importId TEXT NOT NULL,
  seq INTEGER NOT NULL,
  rowsJson TEXT NOT NULL,
  PRIMARY KEY (organizationId, importId, seq),
  FOREIGN KEY (organizationId, importId) REFERENCES importDraft (organizationId, id)
);

-- The draft of a review: what the person has decided about each row, saved as it is decided, so a refresh or
-- another device finds it. One row per file row, so two people (or two tabs) deciding different rows never
-- overwrite each other, and each decision keeps the name of whoever made it.
CREATE TABLE importDecision (
  organizationId TEXT NOT NULL REFERENCES organization (id),
  importId TEXT NOT NULL,
  rowId TEXT NOT NULL,
  decisionJson TEXT NOT NULL,
  decidedById TEXT NOT NULL,
  decidedByName TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  PRIMARY KEY (organizationId, importId, rowId),
  FOREIGN KEY (organizationId, importId) REFERENCES importDraft (organizationId, id),
  FOREIGN KEY (organizationId, decidedById) REFERENCES member (organizationId, id)
);

-- What a model, or a rule when there is no model, suggested for an import where the fixed rules have no answer: a
-- name for a row with none, a category for a row whose category is not listed, a file column for a field no heading
-- matched. A suggestion never changes a row: the review shows it as a proposal and the person accepts or rejects
-- it. One per row and field (rowId is '' for a column), so asking twice stores nothing twice and an accepted
-- suggestion can never come to mean another value.
CREATE TABLE importSuggestion (
  id TEXT NOT NULL,
  organizationId TEXT NOT NULL REFERENCES organization (id),
  importId TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('name', 'category', 'column')),
  rowId TEXT NOT NULL,
  rowNumber INTEGER,
  field TEXT NOT NULL,
  fromValue TEXT NOT NULL,
  toValue TEXT NOT NULL,
  columnIndex INTEGER,
  madeBy TEXT NOT NULL CHECK (madeBy IN ('model', 'rule')),
  model TEXT,
  confidence TEXT NOT NULL CHECK (confidence IN ('medium', 'low')),
  basis TEXT NOT NULL,
  askedById TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  PRIMARY KEY (organizationId, id),
  UNIQUE (organizationId, importId, rowId, field),
  FOREIGN KEY (organizationId, importId) REFERENCES importDraft (organizationId, id),
  FOREIGN KEY (organizationId, askedById) REFERENCES member (organizationId, id)
);

-- One confirm of an import: who confirmed it and when, and what it did, counted from the rows it stored in the same
-- batch. A take-back of the import marks the confirms it reversed (takeBackId, the same for every confirm one
-- take-back reversed) with who took them back and when, how many of their items it removed, how many stored items it
-- had replaced it put back as they were (restored), and how many it kept because someone had changed them since. A
-- confirm with takenBackAt null is in force.
CREATE TABLE importBatch (
  id TEXT NOT NULL,
  organizationId TEXT NOT NULL REFERENCES organization (id),
  importId TEXT NOT NULL,
  confirmedById TEXT NOT NULL,
  confirmedByName TEXT NOT NULL,
  confirmedAt TEXT NOT NULL,
  created INTEGER NOT NULL DEFAULT 0,
  updated INTEGER NOT NULL DEFAULT 0,
  already INTEGER NOT NULL DEFAULT 0,
  notImported INTEGER NOT NULL DEFAULT 0,
  takeBackId TEXT,
  takenBackById TEXT,
  takenBackByName TEXT,
  takenBackAt TEXT,
  removed INTEGER NOT NULL DEFAULT 0,
  restored INTEGER NOT NULL DEFAULT 0,
  kept INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (organizationId, id),
  FOREIGN KEY (organizationId, importId) REFERENCES importDraft (organizationId, id),
  FOREIGN KEY (organizationId, confirmedById) REFERENCES member (organizationId, id),
  FOREIGN KEY (organizationId, takenBackById) REFERENCES member (organizationId, id),
  CHECK ((takeBackId IS NULL) = (takenBackAt IS NULL))
);

CREATE INDEX importBatch_import ON importBatch (organizationId, importId, confirmedAt);
CREATE INDEX importBatch_takeBack ON importBatch (organizationId, takeBackId);

-- One inventory item of one organization. skuKey is the SKU without spaces, upper-cased: the unique index on it is
-- what makes "one item per SKU" and "a second import adds nothing" true. unitCost is a decimal string read from the
-- file's digits (up to 4 decimals, never through a float); a date is ISO text; tags, dimensions and vendors are JSON
-- text, decoded through the Schemas of src/domain/Item.ts on the way out as they were checked on the way in.
-- importId, batchId, sourceRow and sourcePart say which file row and which confirm an item came from, so a result
-- can tell "created by this import" from "was there" and a take-back removes exactly what one confirm created.
-- `revision` is 1 as created and goes up with every change (an edit, or a later import the person let replace it):
-- an item a take-back may remove is one still at revision 1.
CREATE TABLE item (
  id TEXT NOT NULL,
  organizationId TEXT NOT NULL REFERENCES organization (id),
  sku TEXT NOT NULL,
  skuKey TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL CHECK (category IN ('raw-materials', 'components', 'finished-goods', 'packaging', 'supplies')),
  uom TEXT NOT NULL CHECK (uom IN ('EA', 'BX', 'KG', 'M', 'L')),
  unitCost TEXT NOT NULL,
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

CREATE INDEX item_import ON item (organizationId, importId, sourceRow, sourcePart);
CREATE INDEX item_batch ON item (organizationId, batchId, sourceRow, sourcePart);

-- The Items table's own order (by SKU, ignoring case, the id breaking ties; src/server/Items.ts), so a page is
-- read off the index instead of every item of the organization being sorted to return ten. Read backwards for
-- SKU Z to A. The only other index on `item` on purpose: each one is paid at every confirm and take-back, and
-- with no statistics SQLite may pick a new one for a scan it does not suit; check the plans before adding another.
CREATE INDEX item_org_sku ON item (organizationId, sku COLLATE NOCASE, id);

-- A stored item as it was just before a confirm replaced it with a file's row (the person chose "replace"), so taking
-- that confirm back can put every value back, its revision and who last changed it included. revisionAfter is the
-- item's revision right after the replace: a take-back restores the item only while it is still there, and keeps it
-- (restored stays 0) once someone edited it or a later import replaced it again. The copy goes with its item.
CREATE TABLE importReplaced (
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
  unitCost TEXT NOT NULL,
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
  FOREIGN KEY (organizationId, itemId) REFERENCES item (organizationId, id) ON DELETE CASCADE
);

CREATE INDEX importReplaced_import ON importReplaced (organizationId, importId);
CREATE INDEX importReplaced_item ON importReplaced (organizationId, itemId);

-- What the confirms did with each row of the file: created an item, found the SKU already there, did not import
-- it (with the reason), or created an item a take-back then removed. One row per item of the file (`part` 0 when
-- its row is one item, 1, 2, ... when the row holds several), so the result survives a reload and can be
-- downloaded; a later confirm of the same import writes over it.
CREATE TABLE importOutcome (
  organizationId TEXT NOT NULL REFERENCES organization (id),
  importId TEXT NOT NULL,
  rowNumber INTEGER NOT NULL,
  part INTEGER NOT NULL DEFAULT 0,
  sku TEXT NOT NULL,
  name TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('created', 'updated', 'already', 'notImported', 'takenBack')),
  reason TEXT NOT NULL,
  decidedBy TEXT CHECK (decidedBy IN ('person', 'nobody')),
  decidedByName TEXT,
  PRIMARY KEY (organizationId, importId, rowNumber, part),
  FOREIGN KEY (organizationId, importId) REFERENCES importDraft (organizationId, id)
);

-- Every value a confirm wrote that differs from the file: what it was, what it became, where the new value came
-- from (a rule or the person) and who put it in force. Written by the confirm, in the same batch as the
-- items, so the item cannot disagree with them; kept when the confirm is taken back, which the Activity page says.
CREATE TABLE importChange (
  organizationId TEXT NOT NULL REFERENCES organization (id),
  importId TEXT NOT NULL,
  batchId TEXT NOT NULL,
  rowNumber INTEGER NOT NULL,
  part INTEGER NOT NULL DEFAULT 0,
  sku TEXT NOT NULL,
  field TEXT NOT NULL,
  fromValue TEXT NOT NULL,
  toValue TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('rule', 'model', 'person')),
  decidedBy TEXT NOT NULL CHECK (decidedBy IN ('person', 'rule')),
  decidedByName TEXT,
  how TEXT NOT NULL,
  basis TEXT,
  confidence TEXT CHECK (confidence IN ('high', 'medium', 'low')),
  createdAt TEXT NOT NULL,
  PRIMARY KEY (organizationId, batchId, rowNumber, part, field),
  FOREIGN KEY (organizationId, importId) REFERENCES importDraft (organizationId, id),
  FOREIGN KEY (organizationId, batchId) REFERENCES importBatch (organizationId, id)
);

CREATE INDEX importChange_org ON importChange (organizationId, createdAt DESC);
-- An import's changes, found by the import: removing an import deletes them, and its foreign key is checked, without
-- reading every change of the organization.
CREATE INDEX importChange_import ON importChange (organizationId, importId);

-- ===================================================================================================================
-- 4. The day's model calls
-- ===================================================================================================================

-- One row per model call an organization is allowed to make, written BEFORE the call. The day's allowance is
-- counted here, so a call that fails or times out still counts, and two requests cannot both take the last one.
CREATE TABLE modelCall (
  id TEXT NOT NULL,
  organizationId TEXT NOT NULL REFERENCES organization (id),
  actorId TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('view', 'check', 'suggest')),
  createdAt TEXT NOT NULL,
  PRIMARY KEY (organizationId, id),
  FOREIGN KEY (organizationId, actorId) REFERENCES member (organizationId, id)
);

CREATE INDEX modelCall_org ON modelCall (organizationId, createdAt DESC);

-- ===================================================================================================================
-- 5. Finding a person by email
-- ===================================================================================================================

-- People are added by the email they signed up with, matched whatever its case (src/server/People.ts compares
-- lower(email)). Without this index that comparison reads every user.
CREATE INDEX user_email_lower_idx ON "user" (lower(email));

-- ===================================================================================================================
-- 6. The Items search index
-- ===================================================================================================================

-- The Items page's search box: a full-text index over the text a person looks an item up by (its name, SKU and
-- description), kept in step with the item table by triggers, so every writer (a confirm, an edit, a take-back, and
-- any written later) keeps it current without knowing it is there.
--
-- FTS5 with the trigram tokenizer finds a run of three or more characters anywhere in a value ("brack" in "bracket",
-- "BLT-0" in "BLT-0042"), ignoring case and, with remove_diacritics, accents ("ecrou" finds "Écrou"). Both were
-- checked in the local D1 before this file was written; the search falls back to nothing else.
--
-- The rules not to break: every query of this table also says `organizationId = ?` and joins back to an item of the
-- same organization, so one organization never matches another's rows; and a row here is the item's row by rowid,
-- written, changed and deleted only by the triggers below. If the item table were ever rebuilt with new rowids, the
-- index is rebuilt by emptying it (`DELETE FROM itemSearch`) and running the last statement of this file again.
CREATE VIRTUAL TABLE itemSearch USING fts5(
  name,
  sku,
  description,
  organizationId UNINDEXED,
  itemId UNINDEXED,
  tokenize = 'trigram remove_diacritics 1'
);

-- Each trigger's one statement ends on its END line, so the file splits into statements at a semicolon that ends a
-- line; wrangler, which applies them locally and deployed, reads both.
CREATE TRIGGER item_search_insert AFTER INSERT ON item BEGIN
  INSERT INTO itemSearch (rowid, name, sku, description, organizationId, itemId)
  VALUES (new.rowid, new.name, new.sku, COALESCE(new.description, ''), new.organizationId, new.id); END;

CREATE TRIGGER item_search_update AFTER UPDATE OF name, sku, description ON item BEGIN
  UPDATE itemSearch SET name = new.name, sku = new.sku, description = COALESCE(new.description, '')
  WHERE rowid = old.rowid; END;

CREATE TRIGGER item_search_delete AFTER DELETE ON item BEGIN
  DELETE FROM itemSearch WHERE rowid = old.rowid; END;

-- The items there already. Run again after emptying the index, it rebuilds it.
INSERT INTO itemSearch (rowid, name, sku, description, organizationId, itemId)
SELECT rowid, name, sku, COALESCE(description, ''), organizationId, id FROM item;
