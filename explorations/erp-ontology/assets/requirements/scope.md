---
type: Scope
title: ERP ontology scope for the thin thread
description: What the first audit of terms covers, what it leaves out, and the upper ontology, for the foundational auditor.
---

# Scope: the thin thread

This is the scope the foundational auditor reads. It covers the thin thread only (decision 8); report 14 is the
thread's specification and report 04 holds the full requirements.

Upper ontology: gist (projection), release 14.1.0 (decisions 4 and 13 to 16).

## In scope

- Who belongs to an organization that uses this system, and with which role: the organization, the tenant it is, the
  person, the membership, the role and the grant of a role (decisions 34, 38, 40, 41, 94, 96).
- The audit trail's entries: who did what, when, and in which tenant (decisions 46 and 98).
- The records that hold these today: the kernel's `Member`, `Role` and `Activity`, and the access contract's records
  that are views of them (decision 99).

## Out of scope

- Items, imports, stock, locations, commitments and their terms: later slices.
- A member's or an organization's name, a sign-in email and the date a member joined: placed by the party slice
  (decisions 93 and 100).
- Agents and agent runs, permissions and what a role permits: the party slice (decisions 41 and 98).
- Customers, vendors, contacts and source records: the party slice (decisions 34 and 39).
- Transport, request, screen and error shapes of the API: they stand for no term (decision 21).

## Constraints

- OWL 2 DL; no `owl:sameAs`, `owl:inverseOf`, `owl:equivalentClass`, `owl:hasKey` or cardinality (project profile).
- Every IRI is under the `example.org` placeholder (decisions 7 and 10).
- A term is a proposal until Benjamin ratifies it; identity is never a name or an email.

## Stakeholder

Benjamin, the owner and the steward of every term.
