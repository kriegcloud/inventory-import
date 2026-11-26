# Error Handling

Moved here verbatim from `SKILL.md` so that file stays under 500 lines; the rows are unchanged from beep-effect.

| Error | Likely cause | Recovery |
|---|---|---|
| Parser cannot resolve a symbol | Generated/excluded source, syntax level too weak | Fall back one level (AST → generic parser → quoted prose); mark `epistemic_status` honestly; never guess facts |
| Hypothesis has no CQ warrant | Term is bookkeeping or the CQ suite has a gap | DEFAULT: disposition as `implementation_artifact_only`/`unresolved`. The candidate-CQ escape to `ontology-requirements` is legal ONLY when you can name the concrete decision the new CQ would serve — an unnamed "might need it" keeps the null standing, and a hypothesis may not idle on `semantic_support_for` waiting for a warrant |
| Category unresolved after analysis | Genuinely ambiguous referent | `verdict: explicitly_deferred` with the discriminating evidence named — a first-class outcome |
| Two proposals collide on one referent | Rival models both viable | Keep both, blinded adversarial comparison, steward picks; never merge silently |
| Steward unavailable | — | Everything stays `proposed`; downstream skills must refuse unratified input |
