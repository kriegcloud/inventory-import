# Auditor outputs

Moved verbatim from `SKILL.md` (Outputs) to keep it under 500 lines. In this repository every location is under
`explorations/erp-ontology/assets/audit/<name>/` (read `../../_shared/project-profile.md` first).

| Artifact | Location + filename pattern | Authority |
|---|---|---|
| Run manifest | `work/run-manifest.yaml` | Deterministic |
| `SourceObservation` | `work/observations/so-<sha12>.yaml` (id keeps the FULL digest) | Deterministic (script-produced) |
| `ProseObservation` | `work/prose-observations/po-<sha12>.yaml` | Source text (quotation) |
| `DenotationHypothesis` | `work/hypotheses/dh-<slug>-<nnn>.yaml` | Proposal only |
| `IdentityCard` / `FoundationalAnalysis` | `work/foundational/ic-…​.yaml` / `fa-…​.yaml` | Proposal only |
| Alternative-seat `ic-`/`fa-` records | `work/alternative/ic-…​.yaml` / `fa-…​.yaml` (blinded seat; joined on `hypothesis_ref`) | Proposal only |
| `OntologyTermProposal` | `work/proposals/otp-<slug>-<nnn>.yaml` | Proposal only |
| Adversary review dispositions | `work/proposals/otp-<slug>-<nnn>[-r2].review.yaml` (latest per target governs) | Proposal only |
| Dispositions index | `work/dispositions.index.yaml` | Deterministic (validator-enforced totality) |
| Rejection ledger | `work/rejections/rej-<nnn>.yaml` | Steward decision |
| Ratifications | `governance/ratifications/rat-<nnn>.yaml` | HUMAN — authoritative |
