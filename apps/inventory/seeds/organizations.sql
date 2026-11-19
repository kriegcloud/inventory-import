-- Two organizations and their people, for development, tests and previews: the app has someone to sign in as, and a
-- second tenant proves isolation. Never applied to production: a stage's plan says which seeds it gets
-- (packages/infra). They have no accounts here: seeds/accounts.sql links the local test accounts to them.
-- Safe to apply again (INSERT OR IGNORE).
INSERT OR IGNORE INTO organization (id, name, slug, createdAt) VALUES
  ('org_prairie', 'Example Works (test)', 'org_prairie', '2026-11-01T00:00:00.000Z'),
  ('org_northline', 'Sample Supply Co. (test)', 'org_northline', '2026-11-01T00:00:00.000Z');

INSERT OR IGNORE INTO member (id, organizationId, name, role, createdAt) VALUES
  ('mem_dana', 'org_prairie', 'Dana Whitfield', 'admin', '2026-11-01T00:00:00.000Z'),
  ('mem_marcus', 'org_prairie', 'Marcus Oyelaran', 'editor', '2026-11-01T00:00:00.001Z'),
  ('mem_priya', 'org_prairie', 'Priya Raman', 'viewer', '2026-11-01T00:00:00.002Z'),
  ('mem_elena', 'org_northline', 'Elena Sokolova', 'admin', '2026-11-01T00:00:00.003Z'),
  ('mem_tom', 'org_northline', 'Tom Becker', 'editor', '2026-11-01T00:00:00.004Z');
