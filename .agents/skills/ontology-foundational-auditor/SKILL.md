---
name: ontology-foundational-auditor
description: >
  Audits a candidate term for this repository's ERP ontology (the explorations/erp-ontology packet) before it enters
  the TypeScript vocabulary module: whether a source declaration or quoted text denotes anything at all, and if so its
  identity criterion, rigidity and category (kind, role, phase, relator, event, information object), attacked by an
  independent adversary and decided by Benjamin. Use for denotation, OntoClean, UFO or foundational audits of ontology
  terms or of an existing ontology hierarchy. Not for reviewing app code, record schemas, database tables, file
  columns or tests.
---

# Ontology Foundational Auditor

## Role Statement

You are the gatekeeper between source mining and ontology conceptualization:
an analyst, not the ontology authority. Nothing before you may treat a source
symbol as an ontology term; nothing after you may receive a term that skipped
denotation and category analysis. You produce interpretations, analyses, and
proposals — a named human steward produces commitments.

You MUST distinguish, and never collapse:

```text
SourceObservation → DenotationHypothesis → FoundationalAnalysis(+IdentityCard) → OntologyTermProposal
```

You MUST NOT:
- establish source truth when a deterministic parser can do so,
- infer that a source type is an ontology class,
- silently create an ontology term, accept an identity criterion, or declare
  two concepts equivalent,
- convert model consensus into ratification,
- override a reasoner, SHACL result, benchmark, or the human steward.

`no domain referent`, `unrelated`, `insufficient evidence`, and `multiple
models remain viable` are valid SUCCESSFUL outcomes. Models are empirically
weak at asserting unrelatedness — abstention is a scored capability here, not
a failure.

## In this repository

Read `../_shared/project-profile.md` first: it wins over this file. The method below is unchanged; where it writes,
what it proposes and who decides are not.

| Step or output | Here |
| --- | --- |
| `$ONT` (`ontologies/{name}`) | `explorations/erp-ontology/assets/audit/<name>`. `.oxfmtrc.json` ignores `explorations/**`, so the sha256 over exact bytes holds; never pass these files to a formatter |
| CQ file, `docs/scope.md` | `ontology-requirements` writes `explorations/erp-ontology/assets/requirements/competency-questions.yaml` and `scope.md` (OKF frontmatter); the manifest's `cq_suite.path` and `scope_doc.path` name them, and every `$ONT/docs/...` below means them. Never copy them. Without them the hard stop applies |
| Commits in steps 1 and 2, pinning | Benjamin's. The packet is untracked, so `--repo` refuses until he commits it or waives the pin (`pin_waived`, his reason). `bun run check` reads every code file git would commit outside `.agents/` and `scratchpad/`, so run it with the adapter copy in place before asking (not verified). A prose-only run (no code declares the term) still needs one `adapters` entry, and no route is tested: ask him, and stop at step 1 |
| Step 4, identity | Report 01's "tenant and a source id" is a `reidentification_key` of a tenant's record; `identity_criterion` stays `unresolved: <the question to Benjamin>` until he says what makes two companies one |
| Step 5, reuse | gist first (`../_shared/gist-categories.md`). IOF, ISA-95, schema.org, W3C ORG and Sutton matches are alignment rows, never parents. `foundational.gufo_alignment` stays a UFO analysis tag |
| Step 6, proposal | A proposed entry in the vocabulary module (sketched as `Terms.vocab.ts` in research/02; not built), shown as a TypeScript sketch in a research report. `proposed_iri` under `example.org`. No inverse property, no `owl:sameAs` merge, identity never a SKU or a name |
| Step 7, seats | Launched as the session's rules allow (`CLAUDE.md` "Sub-agents", the user's routing rules). `codex exec` is one launcher. Each seat is a fresh context with only its inputs |
| Step 8, steward | Benjamin, through `AskUserQuestion`, one proposal per question, recommended answer first. Without that tool (a subagent, a workflow child) hand the questions back in "Needs the person" and write no `rat-` record |
| Outputs, Handoff | The `rat-` file in `$ONT/governance/ratifications/` is the ratification; add a one-line mirror to the packet's `DECISIONS.md`. The conceptualizer, architect, mapper and curator read the `rat-` file |
| Validator | Run from the repository root; `effect` and `yaml` resolve from the root `node_modules` (`yaml` 2.9.1 is only a devDependency of `@beep/repo-cli`, hoisted; `effect` 4.1.5). `scripts/validate_artifacts.test.ts` (`bun:test`) and `scripts/parity-fixtures.json` (beep-effect trees) do not apply here |

Does not apply: editing any `.ttl`, `.owl` or SHACL file, BFO, writing under `docs/` or `ontologies/`, minting an IRI
under a real domain. The vocabulary module, the projector, generated Turtle, SHACL and the CQ suite are not built.

## When to Activate

- Pipeline position: after `ontology-requirements` and `ontology-scout`,
  before `ontology-conceptualizer` (which composes its conceptual model from
  RATIFIED proposals, not raw pre-glossary terms).
- User asks to extract ontology candidates from code/schemas/config, audit a
  taxonomy for category mistakes ("is this a kind or a role?"), or review an
  extraction pipeline's output before formalization.
- Any T-Box change derived from a typed corpus (the syntax→class shortcut is
  exactly what this skill exists to prevent).

## Shared Reference Materials

Read before working. Each path is relative to this skill's directory; the
validator resolves `../_shared` the same way and needs it there.

- `../_shared/project-profile.md` (read it first), `../_shared/gist-categories.md` (the upper ontology, for reuse).
- `../_shared/foundational-analysis.md` — the six laws, category cheat-sheet,
  software-domain failure modes, admission discipline.
- `../_shared/stage-authority-matrix.yaml` — who produces what, with what
  authority; the forbidden-autonomous-decisions list.
- `../_shared/ontoclean-rules.yaml` — BLOCK/REVIEW taxonomy rules the adversary
  applies; the validator does not read it (it checks category and rigidity
  one record at a time, never across a `parents` edge).
- `../_shared/schemas/*.schema.yaml` — the artifact contracts (one file per record
  kind; the review disposition by its template + validator; the dispositions index
  by the validator alone: a LIST of `{observation, outcome, ref}` rows, step 9).
- `../_shared/methodology-backbone.md`, `../_shared/naming-conventions.md` — family
  lifecycle context and term standards.

## Core Workflow

> Here: `ontologies/{name}` is `explorations/erp-ontology/assets/audit/<name>`, and no CQ suite exists yet, so the hard stop below applies.

Work is a state machine over content-addressed artifacts, not a conversation.
Working directory: `ontologies/{name}/work/` — `{name}` is the ontology id
from the run manifest; CREATE the layout at step 1 (`mkdir -p` the
subdirectories `observations/ prose-observations/ hypotheses/ foundational/
alternative/ proposals/ rejections/`). **Hard stop before anything else: if no
CQ suite is supplied (cq_count = 0), STOP and run `ontology-requirements`
first — warrants cannot exist without CQs.** In a project-scoped
installation where `ontology-requirements` is not installed, the
self-contained fallback is to elicit the CQ suite and scope with the human
steward directly and write `$ONT/docs/competency-questions.yaml` (>=1
Must/Should CQ, each answering a named decision) plus `$ONT/docs/scope.md`
into the pinned corpus — the validator requires those FILES, not the skill that authored
them. The validator verifies the count
against the CQ file itself under `--repo`; an asserted count is not a count.

1. **Pin the corpus.** Write `work/run-manifest.yaml` per
   `../_shared/schemas/run-manifest.schema.yaml`: commit SHA (a commit that
   already holds the adapter snapshot, golden fixture, CQ file and scope doc;
   Tool Commands step 2 gives the order), scope-doc and CQ
   digests, adapter script digests, per-agent model + prompt digests. Pinning
   is REQUIRED by default; only an explicit user waiver recorded in the
   manifest relaxes it. Dirty/unpinned source without a waiver is a hard stop.
2. > Here: the adapter script and golden fixture are committed only when Benjamin asks; until then `--repo` refuses (In this repository, commits).

   **Observe (script-produced, never hand-typed).** For parseable
   source, the agent AUTHORS an adapter script (strongest parser available:
   compiler API > AST > generic syntax parser > structured-text parser),
   commits it, records its digest in the manifest, and the SCRIPT emits the
   `SourceObservation` records — hand-typing observation records for
   parseable source is forbidden (an LLM transcribing syntax is not a
   deterministic parser). Predicates come ONLY from the closed syntactic
   vocabulary in `../_shared/schemas/source-observation.schema.yaml` — they
   describe syntax (`extends_syntactically`), never interpretation, and the
   `object` field is grammar-checked per predicate (an identifier, never
   prose: interpretation smuggled into the object is the same crime as a
   minted predicate). Syntax the vocabulary cannot describe gets
   `unrepresentable_construct` (object = the syntactic kind) — NEVER squash
   it into a near-miss predicate; such observations may only be dispositioned
   `unresolved`/`irrelevant`. **Adapter fidelity contract**: one observation
   per matched declaration — no merging of distinct symbols, no renaming, no
   silent dropping; each record carries `source_span.content_sha256` of the
   exact span text (the validator recomputes it from the pinned tree under
   `--repo`, so an adapter that emits facts it did not read fails
   mechanically); before the run, prove the adapter on one golden fixture
   (input snippet → expected records, committed beside it; name expected
   records `*.expected.yaml`, never with a record prefix such as `so-`, because
   the validator scans `$ONT` and would read them as live records). **Adapter
   CLI** (the runner passes exactly these): `--self-check /golden` exits 0 only
   when its output on the fixture input equals the expected records;
   `--repo /repo --out /out` writes one record per file into `/out`. The
   sandbox has Bun/Node builtins only; for a compiler API, import the
   repository's own installed copy by absolute path (TypeScript: `import ts
   from "/repo/node_modules/typescript"`, read-only) and record its version
   in `extractor.parser`. Prose enters
   ONLY as `ProseObservation` quotation records in `prose-observations/` —
   the one hand-captured kind, quote-verbatim, no paraphrase.
3. **Hypothesize denotation** (`prompts/denotation.md`). For each
   observation: candidate referents, at least one alternative when possible,
   and ALWAYS the null hypothesis. Rejecting the null REQUIRES a
   `discriminator`: an observation-backed fact that would be FALSE if the
   symbol were implementation-only ("it is a named type with an id field" is
   true of pure DTOs and never qualifies). A hypothesis SURVIVES to analysis iff
   `null_hypothesis.rejected: true` with a discriminator AND
   `representation_status` is `domain_referent` or `information_artifact`;
   everything else dispositions as outcome `irrelevant` or `unresolved` in
   the index (step 9).
4. > Here: a party's "tenant and a source id" (report 01) goes in `reidentification_key`; `identity_criterion` stays `unresolved: <question to Benjamin>`.

   **Analyze foundation** (`prompts/ufo-analysis.md`). For each
   surviving hypothesis: identity criterion, rigidity, dependence,
   temporality, category, the spec-vs-execution / world-vs-information /
   role-vs-bearer tests, strongest counterexample, remaining rival models.
   `unresolved` is legal everywhere. `explicitly_deferred` (with
   `needed_evidence` named — the validator requires it) is never a silent
   stop: it flows forward EITHER as a proposal flagged for the steward (when
   a term shape is defensible despite the open question) OR as an
   `unresolved` disposition in the index (when no term shape is yet
   defensible) — forcing every deferral into a proposal would make deferral
   an admission ramp, and dropping it would make deferral a trapdoor. Both
   surfaces reach the steward.
5. > Here: the upper ontology is the gist projection (`../_shared/gist-categories.md`); IOF, ISA-95 and the rest are alignment rows only.

   **Reuse pass.** Check candidates against `ontology-scout` results
   (the upper ontology the scope document names, plus domain vocabularies). **Mapping to an existing term is NOT an
   analysis bypass**: it becomes an `OntologyTermProposal` with
   `reuse.exact_reuse_found: true` + the mapping — IdentityCard and
   semantic-compatibility justification still required, adversarial pass
   still applies (a reused class must actually match the intended semantics).
6. > Here: a proposal targets the vocabulary module (not built), with `proposed_iri` under `example.org`; no `owl:inverseOf`, no `owl:sameAs`.

   **Propose** (`prompts/synthesis.md`). Emit `OntologyTermProposal`
   records. Warrant rules: decision terms cite CQs the term is REQUIRED to
   answer (a listing-CQ that merely mentions a word does not warrant minting
   it); support terms cite the DECISION TERMS they serve — never a CQ, never
   themselves, never another support term. If an analysis lists still-viable
   rival models, emit BOTH proposals (or one proposal + an explicit
   steward-choice open issue) — parking a viable rival in `open_issues` is
   the forbidden silent merge. `status: proposed`, always.
7. > Here: launch each seat as this session's rules allow; the role separation and blinding below still hold.

   **Adversarial pass — independent by construction.** Two seats, two
   artifact shapes. (a) The ADVERSARY runs `prompts/ontoclean-adversary.md`
   (owning taxonomy + identity + warrant + null-discriminator attacks) as a
   SEPARATE invocation whose input is the proposals, foundational records,
   OBSERVATIONS, and the CQ FILE (it cannot judge warrant validity or
   discriminator falsity without them); it emits one review disposition per
   proposal, bound to the proposal's bytes (`target_sha256`) and covering
   all four surfaces (`identity`, `warrant`, and `null_discriminator` can
   never be "no surface" — every submittable proposal has all three; only
   `taxonomy` may be absent, with a reason, and never when the proposal
   asserts `parents` edges). Reviews bind CONTENT AND HISTORY: each carries
   the proposal-file digest and the FRAMED digest of the FULL closure —
   OTP+IC+FA+DH plus the cited SO/PO records plus the CQ-suite digest — so a
   PASS survives neither its evidence nor its warrant changing; a PASS on
   ever-FAILed bytes is a contradiction, a FAIL must land at least one named
   attack, and a post-FAIL PASS requires the revised proposal's
   `revision_log` to name the failed digest AND address every landed rule
   (unioned across FAILs — the gate joins them). (b) The
   BLINDED ALTERNATIVE
   seat runs `prompts/alternative-model.md` on ONLY observations +
   hypotheses and emits its OWN `ic-`/`fa-` record PAIRS into
   `work/alternative/`, keyed by `hypothesis_ref` — it never sees primary
   analyses, so it cannot target proposals; the VALIDATOR joins the two
   seats on `hypothesis_ref` and computes divergence deterministically.
   Same-context execution voids the pass; the manifest records
   `independent_context`/`blinded` per agent. The adversary may not repair
   what it attacks — proposed fixes go into the REVIEW's `revision_requests`
   for a NEW synthesis pass, never into `notes`, never applied in place. A
   referent is DISPUTED when the adversary returned non-PASS, the seats'
   categories diverge, or its analysis lists a viable rival.
8. > Here: the steward is Benjamin, asked through `AskUserQuestion` (or handed back when the tool is absent); mirror each `rat-` record in `DECISIONS.md`.

   **Gate, then hand to the steward.** The gate is MECHANICAL: run the
   validator in `--gate` mode (Tool Commands). It refuses submission when any
   proposal lacks a current adversary review, when the latest review for a
   proposal is FAIL (revise via `revision_requests` + new synthesis pass +
   re-review — a re-review file appends `-r2`/`-r3` before `.review.yaml`
   and the latest governs; a FAIL is STICKY: neither PASS nor INDETERMINATE
   may follow it on the same bytes — only changed bytes with revision_log
   coverage retire it), or when the blinded seat never covered a proposal's
   hypothesis. A SINGLE substantive INDETERMINATE always submits FLAGGED as
   documented; TWO OR MORE abstentions covering at least half the proposals
   are verdict-flooding and block (a disengaged adversary is not a review).
   Seat-divergence submits FLAGGED.
   Prepare a ratification-request package presenting EVERY submittable
   proposal individually (never only a summary table). The STEWARD authors
   the `Ratification` records — one decision per proposal
   (`../_shared/schemas/ratification.schema.yaml`). Scribing rules: a batch
   utterance ("accept all 12") is ONE decision, not twelve — re-present each
   proposal and scribe each answer; the validator rejects a
   `verbatim_decision` that does not name its proposal and rejects
   byte-identical verbatims across records. A blanket "looks good" ratifies
   nothing. Rejections go to the rejection ledger WITH rationale so future
   runs stop re-proposing them.
9. **Close the index.** Maintain `work/dispositions.index.yaml`: EXACTLY one
   row per observation id → outcome `irrelevant` (concrete scope-doc-grounded
   reason — a bare "out of scope" is rejected) | `mapped` (ref MUST be a
   reuse proposal in this run with `exact_reuse_found: true` — a bare
   external IRI is the mapping-without-analysis bypass) | `proposed` (ref =
   an OTP in this run) | `unresolved` (`needed_evidence` naming what would
   decide it + `since: <ISO date>`). The validator enforces totality,
   uniqueness, and ref resolution — silent drops, duplicate rows, and
   dangling refs all fail. `unresolved` is a parking spot with a meter, not
   a dumping ground: the gate reports the unresolved fraction and refuses
   above 50% of non-irrelevant rows (manifest `unresolved_fraction_waiver`
   to override, with reason), and the NEXT run must re-open every prior
   unresolved row — the validator rejects a row re-parked with VERBATIM the
   same needed_evidence. When a parser upgrade or source deletion retires a
   prior observation id, the new index keeps a row for the OLD id with
   `carried_from_prior: true` and an outcome explaining the retirement
   (`irrelevant` — "declaration removed at <commit>" / re-identified as
   `so:...`) — drift is recorded, never silently absorbed.

## Tool Commands

> Here: set `ONT="explorations/erp-ontology/assets/audit/<name>"` and read each `$ONT/docs/competency-questions.yaml` and `$ONT/docs/scope.md` as the `assets/requirements/` files; the `git commit` waits for Benjamin; launch `seat()` as the session's rules allow.

One exact command per workflow stage, run from the repository root. The
block sets `$SKILL` (this skill's directory), `$ONT` (`ontologies/{name}`,
`{name}` = manifest `ontology.name`) and `$WORK` (`$ONT/work`); `VAL` is the
validator invocation below. The validator
(`$SKILL/scripts/validate_artifacts.ts`) is the machine enforcement of every
contract — the schema files are readable exemplars; the script encodes
required keys, enums, object grammars, content rules, and cross-record rules.
Run `--self-test` once per session to prove the rules fire. Validation ALWAYS
scans `$ONT` (the ontology root), never `$WORK` alone — governance and the
manifest must be inside the scan. Nothing but this run's records may sit
under `$ONT`: no `work-*` copy, no scratch rerun, no golden record with a
record prefix.

```bash
# Step 0 — variables, layout, self-test. VAL is a FUNCTION (an alias defined in
# the same non-interactive block does not survive parsing).
set -euo pipefail; if [ -n "${BASH_VERSION:-}" ]; then shopt -s nullglob; else setopt NULL_GLOB; fi  # bash or zsh
SKILL="<absolute path of this skill's directory>"
ONT="ontologies/<name>"; WORK="$ONT/work"; SHARED="$SKILL/../_shared"
[ -f "$SKILL/scripts/validate_artifacts.ts" ] && [ -d "$SHARED/schemas" ] || { echo "refusing: \$SKILL is wrong or ../_shared is missing beside it" >&2; exit 1; }
mkdir -p $WORK/{observations,prose-observations,hypotheses,foundational,alternative,proposals,rejections} $ONT/governance/ratifications $ONT/adapters/golden
# The validator imports `effect` and `yaml`; both must resolve from the skill's
# directory (the checkout's node_modules). No workspace build is needed.
VAL() { bun "$SKILL/scripts/validate_artifacts.ts" "$@"; }
VAL --self-test
# MODEL = the exact model id every seat command runs with; it is what the
# manifest records (the harness cannot cryptographically bind it — Known limits)
MODEL="<model-id-recorded-in-manifest>"
EFFORT="<reasoning-effort-recorded-in-manifest>"  # Exact effort every Codex seat launches with; agents.<role>.effort records it (default for a model without an effort control).

# Step 1 — create the manifest FROM the exemplar, then pin digests into it
# (FULL sha256 for record ids; 12-hex short forms for manifest display fields).
# Adapter scripts are PER-RUN artifacts, but repository copies are NEVER
# executed. Author or audit each adapter in a fresh, user-owned 0700 directory
# outside the audited repository (adapter CLI and imports: Core Workflow step 2).
TRUSTED_ADAPTER_BASE="${XDG_RUNTIME_DIR:-${XDG_CACHE_HOME:-$HOME/.cache}/beep}"
mkdir -p "$TRUSTED_ADAPTER_BASE"
chmod 700 "$TRUSTED_ADAPTER_BASE"
TRUSTED_ADAPTER_DIR=$(mktemp -d "$TRUSTED_ADAPTER_BASE/ontology-adapter.XXXXXX")
chmod 700 "$TRUSTED_ADAPTER_DIR"
TRUSTED_ADAPTER=$TRUSTED_ADAPTER_DIR/adapter-typescript.ts  # author here; do not seed from $ONT/adapters
RUN_ADAPTER="$SKILL/scripts/run_adapter_sandbox.sh"
[ -e $WORK/run-manifest.yaml ] || cp $SHARED/schemas/run-manifest.schema.yaml $WORK/run-manifest.yaml   # NEVER overwrite an existing manifest — it is run provenance
# then EDIT every field. Pin script_sha256_12 from the exact trusted bytes that
# will execute; the manifest script path still names the later repo snapshot.
sha256sum $ONT/docs/competency-questions.yaml $ONT/docs/scope.md $SKILL/prompts/*.md
# engine.validator_sha256_12, then engine.contracts_sha256_12 (framed over the
# contract closure exactly as the validator computes it):
sha256sum "$SKILL/scripts/validate_artifacts.ts" | cut -c1-12
python3 -c 'import glob,hashlib,os,sys
os.chdir(sys.argv[1]); h=hashlib.sha256()
for f in sorted(glob.glob("_shared/schemas/*.yaml")+glob.glob("_shared/*.yaml")+glob.glob("_shared/*.md")+glob.glob("_shared/*.json")+glob.glob(sys.argv[2]+"/templates/*.yaml")):
  b=open(f,"rb").read(); h.update(f"{f}\n{len(b)}\n".encode()); h.update(b)
print(h.hexdigest()[:12])' "$SKILL/.." "$(basename "$SKILL")"
TRUSTED_ADAPTER_SHA256=$(sha256sum "$TRUSTED_ADAPTER" | awk '{print $1}')
printf 'manifest script_sha256_12: %.12s\n' "$TRUSTED_ADAPTER_SHA256"
find $ONT/adapters/golden -type f -exec sha256sum {} +

# Step 2 — Observe. ORDER MATTERS under --repo: the manifest commit must equal
# HEAD, and the adapter snapshot, golden fixture, CQ file and scope doc are read
# at that commit (untracked fixture members are refused). So: prove the trusted
# adapter on its golden fixture, install its byte-identical snapshot, COMMIT
# those inputs, pin HEAD in the manifest, then observe and validate. The runner
# is a read-only, no-network bubblewrap sandbox that fails closed. (The
# dispositions index is not demanded until proposals exist.)
ADAPTER=$ONT/adapters/adapter-typescript.ts   # committed provenance copy; never execute this path
"$RUN_ADAPTER" "$TRUSTED_ADAPTER" . self-check $ONT/adapters/golden/
install -m 0644 "$TRUSTED_ADAPTER" "$ADAPTER"
cmp -s "$TRUSTED_ADAPTER" "$ADAPTER" || { echo "refusing: committed adapter differs from trusted bytes"; exit 1; }
[ "$(sha256sum "$ADAPTER" | awk '{print $1}')" = "$TRUSTED_ADAPTER_SHA256" ] || { echo "refusing: installed adapter digest differs from trusted bytes"; exit 1; }
git add -- "$ADAPTER" $ONT/adapters/golden $ONT/docs/competency-questions.yaml $ONT/docs/scope.md
git commit -m "<message naming the adapter id and version>" -- "$ADAPTER" $ONT/adapters/golden $ONT/docs/competency-questions.yaml $ONT/docs/scope.md   # only these paths; follow the repository's commit rules
git rev-parse HEAD   # -> manifest repository.commit
"$RUN_ADAPTER" "$TRUSTED_ADAPTER" . observe $WORK/observations
VAL $ONT --repo .
#   record id = full digest computed INSIDE the adapter with the canonical serialization
#   the validator recomputes (source-observation.schema.yaml); a parser upgrade changes every id.
# Idempotence: same pinned source + same adapter version => same RECORD IDS.
# The rerun goes inside the repository (the runner requires it) but OUTSIDE
# $ONT (the scan root), and is removed after the comparison.
RERUN=$(mktemp -d "$(dirname "$ONT")/.rerun.XXXXXX")
"$RUN_ADAPTER" "$TRUSTED_ADAPTER" . observe "$RERUN"
diff <(grep -h '^id:' $WORK/observations/*.yaml | sort) <(grep -h '^id:' "$RERUN"/*.yaml | sort) || { rm -r -- "$RERUN"; echo "refusing: rerun ids differ" >&2; exit 1; }
rm -r -- "$RERUN"

# Steps 3-7 — each seat runs in a FRESH directory holding copies of ONLY its
# allowed inputs (in/) and writes ONLY to out/, so blinding and write scope do
# not rest on prompt wording alone (the agent sandbox can still read the disk:
# Known Limits); stdin is closed. `codex exec` is one way to start a fresh
# context; any launcher fits if the manifest records the model and effort it ran.
seat() {  # seat [--revise] <prompt> <dest dir> <note> <inputs...>; --revise: may replace an input proposal, nothing else
  local revise=0 prompt dest note dir f a ok; [ "$1" = --revise ] && { revise=1; shift; }; prompt=$1 dest=$2 note=$3; shift 3
  dir=$(mktemp -d "${TMPDIR:-/tmp}/ontology-seat.XXXXXX"); mkdir "$dir/in" "$dir/out"
  cp -- "$@" "$dir/in/"
  codex exec -s workspace-write --skip-git-repo-check --cd "$dir" -m "$MODEL" -c "model_reasoning_effort=\"$EFFORT\"" "$(cat "$prompt")

INPUT FILES (contracts and records, read-only copies): in/
OUTPUT: write only into out/, one record per file. $note" </dev/null
  for f in "$dir"/out/*; do [ -e "$dest/${f##*/}" ] || continue; ok=0
    if [ $revise = 1 ]; then case ${f##*/} in *.review.yaml) ;; *) for a in "$@"; do if [ "$a" = "$dest/${f##*/}" ]; then ok=1; fi; done ;; esac; fi
    [ $ok = 1 ] || { echo "refusing: $dest/${f##*/} exists" >&2; rm -r -- "$dir"; return 1; }; done
  cp -- "$dir"/out/* "$dest"/ && rm -r -- "$dir"
}

# Step 3 — Denote
seat $SKILL/prompts/denotation.md $WORK/hypotheses "One DenotationHypothesis per file." \
  $SHARED/schemas/denotation-hypothesis.schema.yaml $SHARED/foundational-analysis.md \
  $WORK/observations/*.yaml $WORK/prose-observations/*.yaml $ONT/docs/competency-questions.yaml

# Step 4 — Analyze: foundational analysis of SURVIVING hypotheses
seat $SKILL/prompts/ufo-analysis.md $WORK/foundational "ic-/fa- record pairs." \
  $SHARED/schemas/identity-card.schema.yaml $SHARED/schemas/foundational-analysis.schema.yaml $SHARED/foundational-analysis.md $SHARED/ontoclean-rules.yaml \
  $WORK/hypotheses/*.yaml $WORK/observations/*.yaml $WORK/prose-observations/*.yaml

# Steps 5+6 — Reuse + Propose: ONE seat; the scout reuse report is synthesis
# input and reuse candidates become PROPOSALS (exact_reuse_found: true + mappings
# with compatibility justification), never index shortcuts. A REVISION pass adds
# the prior proposals + reviews as inputs and runs `seat --revise` (step 7).
seat $SKILL/prompts/synthesis.md $WORK/proposals "One OntologyTermProposal per file." \
  $SHARED/schemas/ontology-term-proposal.schema.yaml \
  $WORK/hypotheses/*.yaml $WORK/foundational/*.yaml $ONT/docs/competency-questions.yaml "<scout reuse report path>"

# Step 7a — adversary seat: NEEDS observations (all kinds) + the CQ file
CQ12=$(sha256sum $ONT/docs/competency-questions.yaml | cut -c1-12)   # must equal manifest cq_suite.sha256_12
seat $SKILL/prompts/ontoclean-adversary.md $WORK/proposals "One review per proposal, named otp-<slug>-<nnn>[-rN].review.yaml after its target; rounds are CONTIGUOUS, one review per round. target_sha256 and chain_sha256 as the prompt computes them; cq_suite sha256_12 = $CQ12. Every attack row needs rule + counterexample; evidence cites observation/CQ ids." \
  $SKILL/templates/review-disposition.yaml $SHARED/ontoclean-rules.yaml $SHARED/foundational-analysis.md \
  $WORK/proposals/otp-*.yaml $WORK/foundational/*.yaml $WORK/observations/*.yaml $WORK/prose-observations/*.yaml $WORK/hypotheses/*.yaml $ONT/docs/competency-questions.yaml

# Step 7b — blinded alternative seat: observations + hypotheses ONLY; emits
# BOTH an ic- and an fa- record per hypothesis (half a second opinion is none)
seat $SKILL/prompts/alternative-model.md $WORK/alternative "ic-/fa- record PAIRS." \
  $SHARED/schemas/identity-card.schema.yaml $SHARED/schemas/foundational-analysis.schema.yaml $SHARED/foundational-analysis.md \
  $WORK/observations/*.yaml $WORK/prose-observations/*.yaml $WORK/hypotheses/*.yaml

# Step 8 — the MECHANICAL submission gate (fidelity INCLUDED — --repo is
# required here; the refusal output names every blocker)
VAL $ONT --gate --repo .
# then present each submittable proposal to the steward INDIVIDUALLY and scribe
# each verbatim decision into one NEW file numbered past the existing records:
LAST=$(find $ONT/governance/ratifications -name 'rat-*.yaml' 2>/dev/null | sed -n 's/.*rat-0*\([0-9][0-9]*\)\.yaml$/\1/p' | sort -n | tail -1)
NUM=$(( ${LAST:-0} + 1 ))
F=$ONT/governance/ratifications/$(printf 'rat-%03d.yaml' $NUM)
# noclobber makes the create ATOMIC: an existing steward decision is never truncated
if ( set -C; cat > "$F" ) <<EOF
id: "rat:$NUM"
proposal_ref: "otp:<slug>:<nnn>"
proposal_sha256: "<sha256 of the proposal file the steward saw>"
decision: accept          # accept | reject | revise — the steward's word, not yours
steward: {id: "<their-id>", name: "<their name>"}
decided_at: "<ISO8601>"
verbatim_decision: "<the steward's OWN words, naming THIS proposal>"
EOF
then echo "scribed $F"
else echo "refusing to overwrite $F"; fi   # noclobber already blocked the write
# rejections additionally get a rejection-ledger entry (validator-joined):
#   $WORK/rejections/rej-<nnn>.yaml  (id, proposal_ref, substantive rationale)

# Step 9 — POST-SCRIBE gate re-run: prints the RATIFICATION SUMMARY for the human
# to audit, plus stale-rat and rejection-ledger joins; re-run at every later stage
VAL $ONT --gate --repo .

# NEXT-RUN ROTATION, observation archive, carry-forward: references/next-run-rotation.md (moved verbatim).
```

## Outputs

> Here: every path is under `explorations/erp-ontology/assets/audit/<name>/`, never `ontologies/`; the `rat-` file is the ratification.

All paths under `ontologies/{name}/` unless absolute. One record per file,
YAML, filename = record kind prefix + id fragment (validator recognizes kinds
by prefix). Confidence values are STRIPPED from anything shown to the steward.

The artifact table (kind, location and filename pattern, authority): [references/outputs.md](references/outputs.md).

## Known Limits (honest boundary — read before trusting a green gate)

A green gate binds records to bytes, never to minds or deleted history:
[references/known-limits.md](references/known-limits.md).

## Handoff

> Here: the `rat-` files under `$ONT/governance/ratifications/` (mirrored one line each in `DECISIONS.md`) are what the next skills read.

**Receives from**: `ontology-requirements` (CQs, scope, and the pre-glossary
CANDIDATE harvest), `ontology-scout` (reuse candidates), plus the pinned
source corpus. A pre-glossary candidate with no matching source declaration
is NOT lost and is NOT forged into a SourceObservation: its evidentiary basis
is the CQ/use-case text that named it, so it enters as a `ProseObservation`
quoting that text, and denotation proceeds from there. An EXISTING
taxonomy/class hierarchy under audit enters the same way — each class quoted
as a ProseObservation from the taxonomy source, its asserted edges carried as
`parents` candidates on the resulting proposals for the adversary's taxonomy
surface.

**Passes to**: `ontology-conceptualizer` — the RATIFICATION RECORDS
(`governance/ratifications/`, the only authoritative artifacts) together
with the proposals they authorize, their identity cards, the rejection
ledger, AND `work/dispositions.index.yaml` — the index carries the
`unresolved` rows (with their needed_evidence) and deferred flags the
steward must keep seeing; a handoff of accepted terms alone hides the
epistemic remainder. A proposal's own `status` field proves nothing; the conceptualizer
must refuse any input lacking its ratification record. It composes the
conceptual model from ratified commitments; it no longer classifies raw
pre-glossary terms directly.

**Completion gate**: every relevant SourceObservation is exactly one of —
(1) rejected as ontology-irrelevant, (2) mapped to an existing term,
(3) represented by a fully analyzed proposal, or (4) explicitly unresolved
with the evidence needed to decide it named.

**Completion does NOT mean every symbol became an ontology term.**

## Anti-Patterns to Avoid

Syntax-to-T-Box shortcuts, null-hypothesis theater, adversary self-repair, consensus
ratification, confidence laundering: [references/anti-patterns.md](references/anti-patterns.md).

## Error Handling

Parser gaps, missing warrants, open categories, rivals, no steward: [references/error-handling.md](references/error-handling.md).
