---
type: Exploration
title: ERP ontology
description: A taxonomy and ontology for an operations ERP and WMS such as Sutton, built from published ontologies and what is public about Sutton, and tied to this repository's domain model.
status: active
stage: shape
next: Take the thin thread to Benjamin for brief review. None of the 63 open decisions blocks it.
goals: []
---

# ERP ontology

The question: what are the things an operations ERP and WMS like Sutton deals in, how do they relate, and how does
this repository's domain model point at them?

The thin thread is the first deliverable (decision 8). Slice 1, the party slice, follows it. Benjamin will take each
of the 63 open decisions with a concrete record when the slice that needs it is specified.

The thread answers one question: who belongs to this organization and with which role? The fixture has one person
who is an admin in one organization and a viewer in another. Each `Member` links to the same `Person` under
`gist:Person`, with no name or email paths (decision 94). Its `membershipIn` points to a `Tenant`, the role class
under `Organization` keyed by `OrganizationId` (decision 38). The thread takes the gist parents of its terms and
their named ancestors (decisions 13 and 14).

`Role` has no gist parent. Each role shares its IRI with a `MemberRoleScheme` concept (viewer, editor or admin),
identified by scheme and notation. `permits` waits for the party slice (decision 41). The `Grant` lifted from the
member record links to the member by `grantedTo`, the role by `grantsRole` and the one `GrantScopeKindScheme`
concept, organization, by `grantScope` (decisions 40 and 96). The audit record's key is `AuditEntry`, with “Activity”
as an alternative label (decision 46).

Every field of a record that points at a term carries a pointer or `noTerm` with a reason (decision 22). The member's
copied names and sign-in email use `noTerm` with reason `screen` (decision 93). The thread carries the pointers
through to generated OWL and SKOS. It builds gates 1 to 9 and shows each failing once on a planted mistake. Gates 5
and 7 cover only the access contract and the four kernel records (decision 95). N3.js re-parses the output and
Oxigraph runs the SPARQL queries (decision 26). Gate 10 remains open (pending Q27). The stored-sample SHACL check
(11) and the alignment check (12) wait for their slices. The SHACL slice adds shacl-engine for the closed shapes.

| Report | Headline |
| --- | --- |
| [01 A starting model](research/01-starting-model.md) | A small gist core, a party model neither seed has, the seeds' stock and commitment distinctions kept whole, and every domain class carrying the IRI of its term. |
| [02 Schema as the source](research/02-schema-as-source.md) | TypeScript is the only hand-written source and Turtle is generated, but the terms live in one vocabulary module that records point at, not in the record schemas. |
| [03 The ontology skills reviewed](research/03-skills-review.md) | 121 checked findings in beep-effect's ontology skills: commands that fail or run backwards, a shared folder never copied here, and a BFO and hand-edited-Turtle design that this packet's decisions replace. |
| [04 Scope and competency questions](research/04-requirements.md) | Fifty competency questions from the repository's records and Sutton's public documents, 22 of them must, ten with drafted SPARQL (twelve query blocks that parse), and the import's provenance terms left to 09. |
| [05 The term model](research/05-term-model.md) | The vocabulary module's own schemas: class, property, scheme, concept, disjoint group and alignment entries, typed pointers and lift paths from records, and 26 rules one test can hold. |
| [06 Party and access terms](research/06-party-and-access-terms.md) | CQ-P01 reads customer and vendor flags on the tenant's `SourceRecord`, not on the `Organization` (decision 34; two more flags pending Q89). A `ContactAssignment` links a person to an account and carries the purpose and contact point (decisions 39 and 43). |
| [07 Catalog and value terms](research/07-catalog-and-value-terms.md) | The item as a specification with identifiers that never decide identity, bills, routings and price lists, and quantities, money and cost observations that keep the unit and the exact digits. |
| [08 Warehouse and stock terms](research/08-warehouse-and-stock-terms.md) | Places, lots, labels and serial units kept apart, stock positions whose measures overlap by stated arithmetic, and a flour pallet worked through every term. |
| [09 Commitment and event terms](research/09-commitment-and-event-terms.md) | Orders and lines met by events through allocations, EPCIS-shaped execution events, the accounting boundary, the import's own events, and how each meets the Alchemy domain layer. |
| [10 Taxonomies](research/10-taxonomies.md) | Forty concept schemes, each concept's notation equal to the record's literal, with sample counts and the code lists that get no scheme. |
| [11 The gist projection and alignments](research/11-gist-projection-and-alignments.md) | A gist 14.1.0 name enters when a slice needs it. Only stated disjointness pairs between admitted classes enter (24 across the full design, decisions 13 to 15). The four contact alignment rows return (decisions 39 and 43). |
| [12 Projection and checks](research/12-projection-and-checks.md) | The projector's mapping from every term-model construct to OWL, SKOS and SHACL, its determinism rules, and the twelve gates of decision 6 with what each catches. |
| [13 Term index](research/13-term-index.md) | Terms and properties across the nine designs, with counts, the collisions resolved and the Sutton-only or later terms not proposed. Which properties get a local name remains open (pending Q19). |

Inputs kept outside the repository: the two seed reports of 2026-11-22, and Benjamin's earlier private notes (a
first class list, a decision log and a product model read from public sources).

## Trail

- 2026-11-22: packet opened from Benjamin's request ([CAPTURE.md](CAPTURE.md)); first model written; four opening
  questions put to Benjamin ([DECISIONS.md](DECISIONS.md)).
- 2026-11-22: answers 1, 3 and 4 recorded (3 against the recommendation: Account is an Organization with role
  flags); beep-effect read and question 2 argued both ways ([02](research/02-schema-as-source.md)).
- 2026-11-22: questions 2 and 5 to 7 answered: a TypeScript vocabulary module is the source, a local projector
  writes the Turtle, a reasoner runs from the start, the namespace stays `example.org` for now.
- 2026-11-22: beep-effect's ontology skills reviewed before use ([03](research/03-skills-review.md)); nothing
  edited yet.
- 2026-11-22: the skills' defects fixed upstream in a beep-effect worktree (branch `fix/ontology-skills-review`,
  uncommitted); the adaptation for this repository not started.
- 2026-11-22: upstream fixes opened as beep-effect pull request 3480; the fixed skills and `_shared` copied here
  and adapted (`.agents/skills/_shared/project-profile.md` holds this packet's decisions for them).
- 2026-11-22: reports 04 to 12 designed in parallel and reconciled into report 13; their 106 questions, one new
  question and the brief's appetite merged into open decisions 8 to 87; the [brief](BRIEF.md) written; stage moved
  to shape.
- 2026-11-22: a sceptic's review of the whole design checked against the reports, gist 14.1.0 and the repository;
  the real problems fixed in place (report 13, "Changes after the sceptic review"), the recommendations of decisions
  34, 74 and 77 changed, and four questions added (88 to 91).
- 2026-11-22: Benjamin answered nineteen decisions, including the new decision 93, and chose the thin thread before
  the party slice. The [decision log](DECISIONS.md) records the answers.
- 2026-11-22: seven more answers (22, 26, 38, 46 and 94 to 96) settled the thread's terms, field pointers, engines
  and gates. None of the 63 open decisions blocks the thread.
